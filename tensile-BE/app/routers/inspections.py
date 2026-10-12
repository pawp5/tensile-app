"""Inspector workspace: queue, measured reports, history and reinspection orders.

An inspector uploads photos/weigh reports, then seals a report: the API stores it and returns its dataHash and
uri. The inspector signs from their own wallet: AttestationRegistry.attest(INSPECTION | REINSPECTION, ...) for
a pass, MintingController.rejectRequest(id, reasonCode) for a failed mint inspection. A failed reinspection of a
lot is recorded here and raised to operations (disputes come with Stage 7).
"""
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from pymongo import ReturnDocument

from app.core.authz import STAFF_ROLES, require_chain_role, roles_on
from app.core.catalog import Catalog
from app.core.deps import CatalogDep, Chain, CurrentUser, Db, User
from app.core.errors import ApiError
from app.core.evidence import data_hash, file_out, normalise, oid, report_uri, store_upload
from app.core.evm import as_int
from app.core.minting import INSPECTION_CONDITIONS, draft_for_request
from app.core.present import Book, lot_display_id, request_display_id
from app.core.reports import inspection_out, reports_by_hash
from app.core.schemas import (
    EvidenceFileOut, InspectionHistoryOut, InspectionHistoryRowOut, InspectionQueueItemOut, InspectionQueueOut,
    InspectionReportIn, InspectionReportOut, InspectionSealOut, InspectorProfileIn, InspectorProfileOut,
    ReinspectionOrderIn, ReinspectionOrderOut,
)

router = APIRouter(tags=["inspections"])

InspectorUser = Annotated[CurrentUser, Depends(require_chain_role("INSPECTOR"))]
ViewerUser = Annotated[CurrentUser, Depends(require_chain_role("INSPECTOR", "RISK_ADMIN", "ADMIN"))]
RiskUser = Annotated[CurrentUser, Depends(require_chain_role("RISK_ADMIN", "ADMIN"))]

FAILED_REASON = "INSPECTION_FAILED"
MINT_INSPECTION_DAYS = 2  # target: an inspector visits within 2 days of the request
DUE_WARNING_DAYS = 7  # lots enter the queue this long before their attestation goes stale
FILE_KINDS = ("weigh", "photos", "assay", "report")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _bytes32(text: str) -> str:
    return "0x" + text.encode()[:32].ljust(32, b"\0").hex()


def attestation_age_limit(catalog: Catalog) -> timedelta:
    return timedelta(days=int(catalog.class_defaults.get("maxAttestationAgeDays", 30)))


async def _profile(db, chain, address: str) -> InspectorProfileOut:
    doc, roles = await asyncio.gather(db.inspectors.find_one({"address": address}), roles_on(chain, address, ("INSPECTOR",)))
    return InspectorProfileOut(
        address=address, name=(doc or {}).get("name"), organisation=(doc or {}).get("organisation"),
        licence=(doc or {}).get("licence"), is_inspector="INSPECTOR" in roles, updated_at=(doc or {}).get("updatedAt"),
    )


def _order_out(doc: dict, book: Book, lot: dict | None) -> ReinspectionOrderOut:
    return ReinspectionOrderOut(
        id=str(doc["_id"]), ref=f"RI-{int(doc['seq']):04d}", chain_id=doc["chainId"], token_id=int(doc["tokenId"]),
        lot_ref=lot_display_id(int(doc["tokenId"]), book.symbol((lot or {}).get("material"))), reason=doc["reason"],
        status=doc["status"], due_at=doc["dueAt"], created_by=doc["createdBy"], created_at=doc["createdAt"],
        done_at=doc.get("doneAt"), report_id=doc.get("reportId"),
    )


async def close_finished_orders(db, chain_id: int) -> None:
    """An open order is done once its lot gets a REINSPECTION attestation: one sealed against the order, or any
    attested since the order was raised (block times are whole seconds, hence the slack)."""
    async for order in db.reinspection_orders.find({"chainId": chain_id, "status": "open"}):
        att = report_id = None
        async for rep in db.reports.find({"chainId": chain_id, "kind": "REINSPECTION", "orderId": str(order["_id"])}):
            att = await db.attestations.find_one({"chainId": chain_id, "dataHash": rep["dataHash"]})
            if att:
                report_id = str(rep["_id"])
                break
        if att is None:
            att = await db.attestations.find_one(
                {"chainId": chain_id, "kind": "REINSPECTION", "subjectType": "LOT", "subject": int(order["tokenId"]),
                 "at": {"$gte": order["createdAt"] - timedelta(minutes=2)}},
                sort=[("index", -1)],
            )
            if att:
                report = await db.reports.find_one({"chainId": chain_id, "dataHash": att.get("dataHash")}, {"_id": 1})
                report_id = str(report["_id"]) if report else None
        if att:
            await db.reinspection_orders.update_one(
                {"_id": order["_id"]}, {"$set": {"status": "done", "doneAt": att.get("at"), "reportId": report_id}}
            )


async def due_lots(db, chain_id: int, catalog: Catalog, now: datetime) -> list[dict]:
    """Lots whose last attestation goes stale within DUE_WARNING_DAYS (oracles stop valuing stale lots)."""
    limit = attestation_age_limit(catalog)
    cutoff = now - limit + timedelta(days=DUE_WARNING_DAYS)
    lots = await db.lots.find({"chainId": chain_id, "state": {"$in": ["FREE", "REDEEMING"]}}).to_list(None)
    out = []
    for lot in lots:
        last = lot.get("lastAttestedAt") or lot.get("mintedAt")
        if last and last < cutoff:
            out.append({**lot, "dueAt": last + limit})
    return out


# ------------------------------------------------------------------ profile


@router.get("/chains/{chain_id}/inspectors/me", response_model=InspectorProfileOut)
async def my_profile(chain: Chain, db: Db, user: User) -> InspectorProfileOut:
    return await _profile(db, chain, user.address)


@router.put("/chains/{chain_id}/inspectors/me", response_model=InspectorProfileOut)
async def save_profile(body: InspectorProfileIn, chain: Chain, db: Db, user: InspectorUser) -> InspectorProfileOut:
    """Name, organisation and licence go into every report this inspector seals."""
    await db.inspectors.update_one(
        {"address": user.address},
        {"$set": {"name": body.name.strip(), "organisation": body.organisation.strip(), "licence": (body.licence or "").strip() or None, "updatedAt": _now()},
         "$setOnInsert": {"address": user.address}},
        upsert=True,
    )
    return await _profile(db, chain, user.address)


# ------------------------------------------------------------------ queue


@router.get("/chains/{chain_id}/inspections/queue", response_model=InspectionQueueOut)
async def inspection_queue(chain: Chain, db: Db, catalog: CatalogDep, user: ViewerUser) -> InspectionQueueOut:  # noqa: C901
    cid, now = chain.chain_id, _now()
    await close_finished_orders(db, cid)
    book, requests, orders, due, profile = await asyncio.gather(
        Book.load(db, cid, catalog),
        db.mint_requests.find({"chainId": cid, "status": "REQUESTED"}).sort("createdAt", 1).to_list(500),
        db.reinspection_orders.find({"chainId": cid, "status": "open"}).sort("dueAt", 1).to_list(500),
        due_lots(db, cid, catalog, now),
        _profile(db, chain, user.address),
    )
    rids = [int(r["requestId"]) for r in requests]
    inspected = {
        int(a["subject"]) for a in await db.attestations.find(
            {"chainId": cid, "kind": "INSPECTION", "subjectType": "REQUEST", "subject": {"$in": rids}}, {"subject": 1}
        ).to_list(None)
    }
    sealed = {
        (r["subjectType"], int(r["subject"])): str(r["_id"]) for r in await db.reports.find(
            {"chainId": cid, "kind": {"$in": ["INSPECTION", "REINSPECTION"]}, "createdBy": user.address, "status": "sealed"}, {"subjectType": 1, "subject": 1}
        ).sort("createdAt", 1).to_list(None)
    }
    order_lots = {int(o["tokenId"]) for o in orders}
    lot_ids = sorted(order_lots | {int(lot["tokenId"]) for lot in due})
    lots = {d["tokenId"]: d for d in await db.lots.find({"chainId": cid, "tokenId": {"$in": lot_ids}}).to_list(None)}
    await book.add_names(db, [r.get("owner") for r in requests] + [d.get("owner") for d in lots.values()])

    items: list[InspectionQueueItemOut] = []
    for r in requests:
        rid = int(r["requestId"])
        if rid in inspected:
            continue
        wid = int(r.get("warehouseId") or 0)
        w = book.warehouses.get(wid) or {}
        material = catalog.materials.get(r.get("material") or "")
        draft = await draft_for_request(db, r)
        frozen = bool(w.get("frozen"))
        items.append(InspectionQueueItemOut(
            kind="mint", ref=request_display_id(rid), subject_type="REQUEST", subject=rid,
            title=f"{as_int(r.get('quantityKg')) / 1000:,.3f} t {(material.family if material else 'material').lower()} · {book.label(r.get('owner'))}",
            owner=r.get("owner"), owner_name=book.name(r.get("owner")), material=r.get("material"), material_name=material.name if material else None,
            warehouse_id=wid, warehouse_code=w.get("code"), warehouse_name=w.get("name"), declared_kg=as_int(r.get("quantityKg")),
            certificate_id=(draft or {}).get("certificateId"), receipt_no=(draft or {}).get("receiptNo"),
            status="ON HOLD" if frozen else ("SEALED" if ("REQUEST", rid) in sealed else "REQUESTED"),
            tone="t-warning" if frozen else "t-info",
            due_at=(r["createdAt"] + timedelta(days=MINT_INSPECTION_DAYS)) if r.get("createdAt") else None,
            note=f"Inspection paused: {w.get('name')} is frozen. A mint inspection there cannot lead to a mint until it is unfrozen." if frozen else None,
            order_id=None, evidence=[file_out(d) for d in (draft or {}).get("documents", [])], sealed_report_id=sealed.get(("REQUEST", rid)),
        ))

    def lot_item(lot: dict, *, kind: str, ref: str, status: str, tone: str, due_at, note, order_id) -> InspectionQueueItemOut:
        tid = int(lot["tokenId"])
        material = catalog.materials.get(lot.get("material") or "")
        w = book.warehouses.get(int(lot.get("warehouseId") or 0)) or {}
        return InspectionQueueItemOut(
            kind=kind, ref=ref, subject_type="LOT", subject=tid,
            title=f"{as_int(lot.get('quantityKg')) / 1000:,.3f} t {(material.family if material else 'material').lower()} · {lot_display_id(tid, material.symbol if material else None)}",
            owner=lot.get("owner"), owner_name=book.name(lot.get("owner")), material=lot.get("material"), material_name=material.name if material else None,
            warehouse_id=lot.get("warehouseId"), warehouse_code=w.get("code"), warehouse_name=w.get("name"), declared_kg=as_int(lot.get("quantityKg")),
            certificate_id=None, receipt_no=None, status="SEALED" if ("LOT", tid) in sealed else status, tone=tone, due_at=due_at, note=note,
            order_id=order_id, evidence=[], sealed_report_id=sealed.get(("LOT", tid)),
        )

    for o in orders:
        lot = lots.get(int(o["tokenId"]))
        if lot is None:
            continue
        late = o["dueAt"] < now
        items.append(lot_item(lot, kind="reinspection", ref=f"RI-{int(o['seq']):04d}", status="OVERDUE" if late else "ORDERED",
                              tone="t-danger" if late else "t-info", due_at=o["dueAt"], note=f"Ordered by operations: {o['reason']}", order_id=str(o["_id"])))
    for lot in due:
        if int(lot["tokenId"]) in order_lots:
            continue
        late = lot["dueAt"] < now
        items.append(lot_item(lot, kind="due", ref=lot_display_id(int(lot["tokenId"]), book.symbol(lot.get("material"))),
                              status="OVERDUE" if late else "DUE", tone="t-danger" if late else "t-warning", due_at=lot["dueAt"],
                              note="Last attestation is past the oracle limit; lending against it is paused" if late else "Attestation goes stale soon", order_id=None))

    rank = {"OVERDUE": 0, "SEALED": 1, "REQUESTED": 2, "ORDERED": 2, "DUE": 3, "ON HOLD": 4}
    items.sort(key=lambda i: (rank.get(i.status, 5), i.due_at or now))
    end_of_day = now.replace(hour=23, minute=59, second=59)
    actionable = [i for i in items if i.status != "ON HOLD"]
    return InspectionQueueOut(
        chain_id=cid, profile=profile, items=items, pending=len(actionable),
        due_today=sum(1 for i in actionable if i.due_at and i.due_at <= end_of_day),
    )


# ------------------------------------------------------------------ files and reports


@router.post("/chains/{chain_id}/inspections/files", response_model=EvidenceFileOut)
async def upload_inspection_file(
    chain: Chain, db: Db, user: InspectorUser, kind: str = Form("report"), file: UploadFile = File(...),
) -> EvidenceFileOut:
    """Upload before sealing; pass the returned ids as file_ids."""
    if kind not in FILE_KINDS:
        raise ApiError(422, "bad_kind", f"kind must be one of {', '.join(FILE_KINDS)}")
    entry = await store_upload(db, file, kind=kind, metadata={"chainId": chain.chain_id, "uploader": user.address, "scope": "inspection"})
    return file_out(entry)


@router.post("/chains/{chain_id}/inspections/reports", response_model=InspectionSealOut, status_code=201)
async def seal_report(body: InspectionReportIn, chain: Chain, db: Db, catalog: CatalogDep, user: InspectorUser) -> InspectionSealOut:  # noqa: C901
    cid = chain.chain_id
    if body.subject_type == "REQUEST":
        req = await db.mint_requests.find_one({"chainId": cid, "requestId": body.subject})
        if req is None or req.get("status") != "REQUESTED":
            raise ApiError(409, "request_closed", f"Mint request {body.subject} is not open")
        kind, material, wid, declared = "INSPECTION", req.get("material"), int(req.get("warehouseId") or 0), as_int(req.get("quantityKg"))
        w = await db.warehouses.find_one({"chainId": cid, "warehouseId": wid}) or {}
        if w.get("frozen") and body.outcome == "pass":
            raise ApiError(409, "warehouse_frozen", f"{w.get('name')} is frozen: a passing inspection cannot lead to a mint until it is unfrozen")
    else:
        lot = await db.lots.find_one({"chainId": cid, "tokenId": body.subject})
        if lot is None or lot.get("state") == "BURNED":
            raise ApiError(409, "lot_unavailable", f"Lot {body.subject} does not exist or has been redeemed")
        kind, material, wid, declared = "REINSPECTION", lot.get("material"), int(lot.get("warehouseId") or 0), as_int(lot.get("quantityKg"))
    if body.outcome == "pass" and body.measured_kg is None:
        raise ApiError(422, "measured_required", "Enter the measured net weight")
    if body.outcome == "fail" and not (body.reason or body.notes):
        raise ApiError(422, "reason_required", "Say why the inspection failed")
    order = None
    if body.order_id:
        order = await db.reinspection_orders.find_one({"_id": oid(body.order_id, "order"), "chainId": cid, "status": "open", "tokenId": body.subject})
        if order is None or body.subject_type != "LOT":
            raise ApiError(404, "no_order", "No open reinspection order for this lot")

    ids = [oid(f, "file") for f in dict.fromkeys(body.file_ids)]
    files = await db["evidence.files"].find(
        {"_id": {"$in": ids}, "metadata.uploader": user.address, "metadata.chainId": cid, "metadata.scope": "inspection"}
    ).to_list(None)
    if len(files) != len(ids):
        raise ApiError(422, "bad_files", "Some files are unknown, already used in a report, or not yours")
    entries = [{
        "id": str(f["_id"]), "kind": f["metadata"].get("kind", "report"), "filename": f.get("filename", "file"),
        "contentType": f["metadata"].get("contentType", "application/octet-stream"), "size": int(f.get("length", 0)),
        "sha256": f["metadata"].get("sha256") or "", "uploadedAt": f.get("uploadDate"),
    } for f in files]

    profile = await db.inspectors.find_one({"address": user.address}) or {}
    report_id = ObjectId()
    raw = {
        "type": "tensile.inspection/v1",
        "kind": kind,
        "chainId": cid,
        "subjectType": body.subject_type,
        "subject": body.subject,
        "material": material,
        "warehouseId": wid,
        "declaredKg": declared,
        "outcome": body.outcome,
        "measuredKg": body.measured_kg,
        "bundlesDeclared": body.bundles_declared,
        "bundlesCounted": body.bundles_counted,
        "assayPct": body.assay_pct,
        "seals": (body.seals or "").strip() or None,
        "inspectedAt": body.inspected_at or _now(),
        "conditions": {k: bool(v) for k, v in body.conditions.items() if k in INSPECTION_CONDITIONS},
        "notes": (body.notes or "").strip() or None,
        "reason": (body.reason or "").strip() or None,
        "inspector": {"address": user.address, "name": profile.get("name"), "organisation": profile.get("organisation"), "licence": profile.get("licence")},
        "files": [{"kind": e["kind"], "filename": e["filename"], "sha256": e["sha256"], "size": e["size"]} for e in entries],
        "orderId": str(order["_id"]) if order else None,
        "sealedAt": _now(),
    }
    sealed_body = normalise(raw)
    digest, uri = data_hash(sealed_body), report_uri(str(report_id))
    doc = {
        "_id": report_id, "chainId": cid, "kind": kind, "subjectType": body.subject_type, "subject": body.subject,
        "body": sealed_body, "dataHash": digest, "uri": uri, "status": "sealed", "outcome": body.outcome, "files": entries,
        "orderId": str(order["_id"]) if order else None, "createdBy": user.address, "createdAt": _now(),
    }
    await db.reports.insert_one(doc)
    await db["evidence.files"].update_many({"_id": {"$in": ids}}, {"$set": {"metadata.scope": "report", "metadata.ref": str(report_id)}})
    book = await Book.load(db, cid, catalog)
    return InspectionSealOut(
        report=inspection_out(doc, None, book),
        kind_code=1 if kind == "INSPECTION" else 2,
        subject_type_code=0 if body.subject_type == "REQUEST" else 1,
        data_hash=digest,
        uri=uri,
        reason_code=_bytes32(FAILED_REASON) if body.outcome == "fail" and body.subject_type == "REQUEST" else None,
        registry=chain.config.addresses.get("AttestationRegistry", ""),
        controller=chain.config.addresses.get("MintingController", ""),
    )


@router.get("/chains/{chain_id}/inspections/reports/{report_id}", response_model=InspectionReportOut)
async def get_inspection_report(report_id: str, chain: Chain, db: Db, catalog: CatalogDep, user: User) -> InspectionReportOut:
    cid = chain.chain_id
    doc = await db.reports.find_one({"_id": oid(report_id, "report"), "chainId": cid, "kind": {"$in": ["INSPECTION", "REINSPECTION"]}})
    if doc is None:
        raise ApiError(404, "no_report", "No such inspection report")
    if doc["createdBy"] != user.address and not await roles_on(chain, user.address, STAFF_ROLES):
        owner_query = {"chainId": cid, "owner": user.address}
        coll = db.mint_requests if doc["subjectType"] == "REQUEST" else db.lots
        key = "requestId" if doc["subjectType"] == "REQUEST" else "tokenId"
        if not await coll.find_one({**owner_query, key: int(doc["subject"])}, {"_id": 1}):
            raise ApiError(403, "forbidden", "Only the inspector, the owner and Tensile staff can see this report")
    att = await db.attestations.find_one({"chainId": cid, "dataHash": doc["dataHash"]})
    rejected = False
    if doc["subjectType"] == "REQUEST" and doc.get("outcome") == "fail":
        req = await db.mint_requests.find_one({"chainId": cid, "requestId": int(doc["subject"])}, {"status": 1})
        rejected = (req or {}).get("status") == "REJECTED"
    return inspection_out(doc, att, await Book.load(db, cid, catalog), rejected=rejected)


# ------------------------------------------------------------------ history


@router.get("/chains/{chain_id}/inspections/history", response_model=InspectionHistoryOut)
async def inspection_history(
    chain: Chain, db: Db, catalog: CatalogDep, user: ViewerUser,
    scope: str = Query("all", pattern="^(mine|all)$"), limit: int = Query(50, ge=1, le=200),
) -> InspectionHistoryOut:
    cid = chain.chain_id
    att_query: dict = {"chainId": cid, "kind": {"$in": ["INSPECTION", "REINSPECTION"]}}
    fail_query: dict = {"chainId": cid, "kind": {"$in": ["INSPECTION", "REINSPECTION"]}, "outcome": "fail"}
    if scope == "mine":
        att_query["attestor"] = user.address
        fail_query["createdBy"] = user.address
    atts, failed, book = await asyncio.gather(
        db.attestations.find(att_query).sort("index", -1).to_list(limit),
        db.reports.find(fail_query).sort("createdAt", -1).to_list(limit),
        Book.load(db, cid, catalog),
    )
    reports = await reports_by_hash(db, cid, [a.get("dataHash") for a in atts])
    rids = {int(a["subject"]) for a in atts if a["subjectType"] == "REQUEST"} | {int(r["subject"]) for r in failed if r["subjectType"] == "REQUEST"}
    tids = {int(a["subject"]) for a in atts if a["subjectType"] == "LOT"} | {int(r["subject"]) for r in failed if r["subjectType"] == "LOT"}
    reqs = {d["requestId"]: d for d in await db.mint_requests.find({"chainId": cid, "requestId": {"$in": sorted(rids)}}).to_list(None)}
    lots = {d["tokenId"]: d for d in await db.lots.find({"chainId": cid, "tokenId": {"$in": sorted(tids)}}).to_list(None)}
    await book.add_names(db, [a.get("attestor") for a in atts] + [r.get("createdBy") for r in failed])

    def subject_info(subject_type: str, subject: int) -> tuple[str, str, str | None, int | None, str]:
        if subject_type == "REQUEST":
            r = reqs.get(subject) or {}
            code = (book.warehouses.get(r.get("warehouseId")) or {}).get("code")
            return request_display_id(subject), "Mint", code, as_int(r.get("quantityKg")) or None, f"/tokenize?request={subject}"
        lot = lots.get(subject) or {}
        code = (book.warehouses.get(lot.get("warehouseId")) or {}).get("code")
        return lot_display_id(subject, book.symbol(lot.get("material"))), "Reinspection", code, as_int(lot.get("quantityKg")) or None, f"/lots/{subject}"

    rows: list[InspectionHistoryRowOut] = []
    for a in atts:
        rep = reports.get(a.get("dataHash")) or {}
        ref, typ, code, declared, href = subject_info(a["subjectType"], int(a["subject"]))
        body = rep.get("body") or {}
        rows.append(InspectionHistoryRowOut(
            at=a.get("at"), ref=ref, type=typ, warehouse_code=code, declared_kg=declared, measured_kg=body.get("measuredKg"),
            result="ATTESTED", tone="t-success", inspector=a.get("attestor"),
            inspector_name=(body.get("inspector") or {}).get("organisation") or book.name(a.get("attestor")),
            report_id=str(rep["_id"]) if rep else None, data_hash=a.get("dataHash"), uri=a.get("uri"), tx_hash=a.get("tx"), href=href,
        ))
    for r in failed:
        ref, typ, code, declared, href = subject_info(r["subjectType"], int(r["subject"]))
        body = r.get("body") or {}
        rejected = r["subjectType"] == "REQUEST" and (reqs.get(int(r["subject"])) or {}).get("status") == "REJECTED"
        rows.append(InspectionHistoryRowOut(
            at=r.get("createdAt"), ref=ref, type=typ, warehouse_code=code, declared_kg=declared, measured_kg=body.get("measuredKg"),
            result="REJECTED" if rejected else "FAILED", tone="t-danger", inspector=r.get("createdBy"),
            inspector_name=(body.get("inspector") or {}).get("organisation") or book.name(r.get("createdBy")),
            report_id=str(r["_id"]), data_hash=r.get("dataHash"), uri=r.get("uri"), tx_hash=None, href=href,
        ))
    rows.sort(key=lambda r: r.at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return InspectionHistoryOut(chain_id=cid, rows=rows[:limit])


# ------------------------------------------------------------------ reinspection orders (operations)


@router.get("/chains/{chain_id}/inspections/orders", response_model=list[ReinspectionOrderOut])
async def list_orders(
    chain: Chain, db: Db, catalog: CatalogDep, user: ViewerUser, status: str = Query("open", pattern="^(open|done|cancelled|all)$"),
) -> list[ReinspectionOrderOut]:
    cid = chain.chain_id
    await close_finished_orders(db, cid)
    query: dict = {"chainId": cid} if status == "all" else {"chainId": cid, "status": status}
    docs, book = await asyncio.gather(db.reinspection_orders.find(query).sort("dueAt", 1).to_list(500), Book.load(db, cid, catalog))
    lots = {d["tokenId"]: d for d in await db.lots.find({"chainId": cid, "tokenId": {"$in": [int(d["tokenId"]) for d in docs]}}).to_list(None)}
    return [_order_out(d, book, lots.get(int(d["tokenId"]))) for d in docs]


@router.post("/chains/{chain_id}/inspections/orders", response_model=ReinspectionOrderOut, status_code=201)
async def create_order(body: ReinspectionOrderIn, chain: Chain, db: Db, catalog: CatalogDep, user: RiskUser) -> ReinspectionOrderOut:
    cid = chain.chain_id
    lot = await db.lots.find_one({"chainId": cid, "tokenId": body.token_id})
    if lot is None or lot.get("state") == "BURNED":
        raise ApiError(404, "no_lot", f"Lot {body.token_id} does not exist or has been redeemed")
    if await db.reinspection_orders.find_one({"chainId": cid, "tokenId": body.token_id, "status": "open"}, {"_id": 1}):
        raise ApiError(409, "already_ordered", "This lot already has an open reinspection order")
    counter = await db.counters.find_one_and_update(
        {"_id": f"reinspection:{cid}"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    now = _now()
    doc = {
        "chainId": cid, "seq": int(counter["seq"]), "tokenId": body.token_id, "reason": body.reason.strip(), "status": "open",
        "dueAt": now + timedelta(days=body.due_days), "createdBy": user.address, "createdAt": now,
    }
    doc["_id"] = (await db.reinspection_orders.insert_one(doc)).inserted_id
    return _order_out(doc, await Book.load(db, cid, catalog), lot)


@router.delete("/chains/{chain_id}/inspections/orders/{order_id}", response_model=ReinspectionOrderOut)
async def cancel_order(order_id: str, chain: Chain, db: Db, catalog: CatalogDep, user: RiskUser) -> ReinspectionOrderOut:
    cid = chain.chain_id
    doc = await db.reinspection_orders.find_one_and_update(
        {"_id": oid(order_id, "order"), "chainId": cid, "status": "open"},
        {"$set": {"status": "cancelled", "doneAt": _now(), "cancelledBy": user.address}},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise ApiError(404, "no_order", "No open order with that id")
    lot = await db.lots.find_one({"chainId": cid, "tokenId": int(doc["tokenId"])})
    return _order_out(doc, await Book.load(db, cid, catalog), lot)
