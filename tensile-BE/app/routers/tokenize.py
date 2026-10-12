"""Tokenize material (F-1): drafts and evidence, the requestMint parameters, and request tracking.

Steps 1-2 (details, evidence) are an off-chain draft. `prepare` freezes it and returns the arguments for
MintingController.requestMint, which the owner signs. The worker then posts the automated review and, once an
inspector has attested, confirms custody as warehouse operator. The owner signs finalizeMint at the end.
"""
import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, Query, UploadFile

from app.core.activity import describe
from app.core.authz import STAFF_ROLES, roles_on
from app.core.catalog import material_hash
from app.core.chains import ABI_ALIASES, ChainContext
from app.core.deps import CatalogDep, Chain, Db, User
from app.core.errors import ApiError
from app.core.evidence import (
    cert_hash, data_hash, delete_files, evidence_uri, file_meta, file_out, oid, store_upload, stream_file,
)
from app.core.evm import as_int
from app.core.minting import (
    DOC_KINDS, MIN_LOT_KG, build_steps, controller_params, draft_for_request, draft_out, expires_at, latest_by_kind,
    link_submitted_drafts, live_cert_claims, missing_docs, reserve_check, simulate, title_for,
)
from app.core.present import Book
from app.core.reports import custody_out, inspection_out, latest_job, reports_by_hash, review_out
from app.core.schemas import (
    EvidenceManifestOut, MintActionsOut, MintConfigOut, MintDocKindOut, MintDraftIn, MintDraftOut, MintDraftsOut,
    MintMaterialOut, MintPrepareOut, MintRequestDetailOut, MintRequestRowOut, MintRequestsOut, MintWarehouseOut, ReportOut,
)
from app.routers.protocol import _warehouse

router = APIRouter(tags=["tokenize"])

MAX_OPEN_DRAFTS = 20
MAX_FILES_PER_DRAFT = 30


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _is_staff(chain: ChainContext, address: str) -> bool:
    return bool(await roles_on(chain, address, STAFF_ROLES))


async def _draft(db, chain_id: int, draft_id: str) -> dict:
    doc = await db.mint_drafts.find_one({"_id": oid(draft_id, "draft"), "chainId": chain_id})
    if doc is None:
        raise ApiError(404, "no_draft", "No such draft on this network")
    return doc


def _own(doc: dict, address: str) -> None:
    if doc["owner"] != address:
        raise ApiError(403, "forbidden", "Only the owner can change this draft")


def _editable(doc: dict) -> None:
    if doc.get("status") != "draft":
        raise ApiError(409, "submitted", "This draft has been submitted; its evidence can no longer change")


async def _check_fields(db, chain_id: int, catalog, body: MintDraftIn) -> None:
    if body.material not in catalog.materials:
        raise ApiError(422, "bad_material", f"Unknown material {body.material}")
    w = await db.warehouses.find_one({"chainId": chain_id, "warehouseId": body.warehouse_id})
    if w is None:
        raise ApiError(422, "bad_warehouse", f"No warehouse {body.warehouse_id} on this network")
    if w.get("materials") and body.material not in w["materials"]:
        raise ApiError(422, "material_not_stored", f"{w.get('name')} does not store {catalog.materials[body.material].name}")
    if body.quantity_kg < MIN_LOT_KG:
        raise ApiError(422, "below_minimum", f"The minimum lot is {MIN_LOT_KG / 1000:.3f} t")


# ------------------------------------------------------------------ configuration


@router.get("/chains/{chain_id}/mint/config", response_model=MintConfigOut)
async def mint_config(chain: Chain, db: Db, catalog: CatalogDep) -> MintConfigOut:
    params, warehouses = await asyncio.gather(
        controller_params(chain), db.warehouses.find({"chainId": chain.chain_id}).sort("warehouseId", 1).to_list(None)
    )
    symbol = decimals = None
    if params["feeToken"]:
        token = chain.contract_at(ABI_ALIASES.get("USDC", "USDC"), params["feeToken"])
        try:
            symbol, decimals = await asyncio.gather(chain.call(token.functions.symbol()), chain.call(token.functions.decimals()))
        except Exception:
            pass
    rows = []
    for w in warehouses:
        reason = None
        if not w.get("active", True):
            reason = "Inactive"
        elif w.get("frozen"):
            reason = f"Frozen · {(w.get('frozenReason') or 'reserve review').replace('_', ' ').lower()}"
        elif not w.get("fresh"):
            reason = "Reserve feed is stale"
        rows.append(MintWarehouseOut(
            warehouse_id=w["warehouseId"], code=w.get("code"), name=w.get("name") or f"Warehouse {w['warehouseId']}",
            operator_name=w.get("operatorName"), region=w.get("region", ""), place=w.get("place"), materials=w.get("materials", []),
            eligible=reason is None, reason=reason, fresh=bool(w.get("fresh")), frozen=bool(w.get("frozen")),
            headroom_kg=max(0, as_int(w.get("reserveKg")) - as_int(w.get("outstandingKg"))),
        ))
    return MintConfigOut(
        chain_id=chain.chain_id,
        controller=chain.config.addresses.get("MintingController", ""),
        min_ai_score=params["minAiScore"],
        request_ttl_seconds=params["requestTTL"],
        min_lot_kg=MIN_LOT_KG,
        mint_fee=str(params["mintFee"]),
        fee_token=params["feeToken"],
        fee_token_symbol=symbol,
        fee_token_decimals=int(decimals) if decimals is not None else None,
        max_file_mb=25,
        materials=[MintMaterialOut(code=m.code, name=m.name, symbol=m.symbol, family=m.family, grade=m.grade) for m in catalog.materials.values()],
        warehouses=rows,
        doc_kinds=[MintDocKindOut(kind=k, title=t, detail=d, required=r, multiple=m) for k, (t, d, r, m) in DOC_KINDS.items()],
    )


# ------------------------------------------------------------------ drafts (steps 1-2)


@router.get("/chains/{chain_id}/mint/drafts", response_model=MintDraftsOut)
async def list_drafts(
    chain: Chain, db: Db, catalog: CatalogDep, user: User,
    status: str = Query("open", pattern="^(open|all)$"),
) -> MintDraftsOut:
    cid = chain.chain_id
    await link_submitted_drafts(db, cid)
    states = ["draft", "submitted"] if status == "open" else ["draft", "submitted", "requested"]
    docs, book = await asyncio.gather(
        db.mint_drafts.find({"chainId": cid, "owner": user.address, "status": {"$in": states}}).sort("updatedAt", -1).to_list(100),
        Book.load(db, cid, catalog),
    )
    return MintDraftsOut(chain_id=cid, drafts=[draft_out(d, book) for d in docs])


@router.post("/chains/{chain_id}/mint/drafts", response_model=MintDraftOut, status_code=201)
async def create_draft(body: MintDraftIn, chain: Chain, db: Db, catalog: CatalogDep, user: User) -> MintDraftOut:
    cid = chain.chain_id
    await _check_fields(db, cid, catalog, body)
    if await db.mint_drafts.count_documents({"chainId": cid, "owner": user.address, "status": {"$in": ["draft", "submitted"]}}) >= MAX_OPEN_DRAFTS:
        raise ApiError(409, "too_many_drafts", f"You have {MAX_OPEN_DRAFTS} open drafts; submit or discard some first")
    now = _now()
    doc = {
        "chainId": cid, "owner": user.address, "status": "draft", "material": body.material, "warehouseId": body.warehouse_id,
        "quantityKg": body.quantity_kg, "certificateId": body.certificate_id, "receiptNo": body.receipt_no, "documents": [],
        "createdAt": now, "updatedAt": now,
    }
    doc["_id"] = (await db.mint_drafts.insert_one(doc)).inserted_id
    return draft_out(doc, await Book.load(db, cid, catalog))


@router.get("/chains/{chain_id}/mint/drafts/{draft_id}", response_model=MintDraftOut)
async def get_draft(draft_id: str, chain: Chain, db: Db, catalog: CatalogDep, user: User) -> MintDraftOut:
    await link_submitted_drafts(db, chain.chain_id)
    doc = await _draft(db, chain.chain_id, draft_id)
    if doc["owner"] != user.address and not await _is_staff(chain, user.address):
        raise ApiError(403, "forbidden", "Only the owner and Tensile staff can see this draft")
    return draft_out(doc, await Book.load(db, chain.chain_id, catalog))


@router.put("/chains/{chain_id}/mint/drafts/{draft_id}", response_model=MintDraftOut)
async def update_draft(draft_id: str, body: MintDraftIn, chain: Chain, db: Db, catalog: CatalogDep, user: User) -> MintDraftOut:
    doc = await _draft(db, chain.chain_id, draft_id)
    _own(doc, user.address)
    _editable(doc)
    await _check_fields(db, chain.chain_id, catalog, body)
    update = {"material": body.material, "warehouseId": body.warehouse_id, "quantityKg": body.quantity_kg,
              "certificateId": body.certificate_id, "receiptNo": body.receipt_no, "updatedAt": _now()}
    await db.mint_drafts.update_one({"_id": doc["_id"]}, {"$set": update})
    return draft_out({**doc, **update}, await Book.load(db, chain.chain_id, catalog))


@router.delete("/chains/{chain_id}/mint/drafts/{draft_id}", status_code=204)
async def discard_draft(draft_id: str, chain: Chain, db: Db, user: User) -> None:
    doc = await _draft(db, chain.chain_id, draft_id)
    _own(doc, user.address)
    _editable(doc)
    await db.mint_drafts.delete_one({"_id": doc["_id"]})
    await delete_files(db, [d["id"] for d in doc.get("documents", [])])


@router.post("/chains/{chain_id}/mint/drafts/{draft_id}/documents", response_model=MintDraftOut)
async def upload_evidence(
    draft_id: str, chain: Chain, db: Db, catalog: CatalogDep, user: User,
    kind: str = Form(...), file: UploadFile = File(...),
) -> MintDraftOut:
    doc = await _draft(db, chain.chain_id, draft_id)
    _own(doc, user.address)
    _editable(doc)
    if kind not in DOC_KINDS:
        raise ApiError(422, "bad_kind", f"kind must be one of {', '.join(DOC_KINDS)}")
    if len(doc.get("documents", [])) >= MAX_FILES_PER_DRAFT:
        raise ApiError(409, "too_many_files", f"A draft holds up to {MAX_FILES_PER_DRAFT} files")
    entry = await store_upload(db, file, kind=kind, metadata={
        "chainId": chain.chain_id, "uploader": user.address, "scope": "draft", "ref": str(doc["_id"]),
    })
    multiple = DOC_KINDS[kind][3]
    replaced = [] if multiple else [d for d in doc.get("documents", []) if d["kind"] == kind]
    documents = [d for d in doc.get("documents", []) if d not in replaced] + [entry]
    await db.mint_drafts.update_one({"_id": doc["_id"]}, {"$set": {"documents": documents, "updatedAt": _now()}})
    await delete_files(db, [d["id"] for d in replaced])
    return draft_out({**doc, "documents": documents}, await Book.load(db, chain.chain_id, catalog))


@router.delete("/chains/{chain_id}/mint/drafts/{draft_id}/documents/{file_id}", response_model=MintDraftOut)
async def delete_evidence(draft_id: str, file_id: str, chain: Chain, db: Db, catalog: CatalogDep, user: User) -> MintDraftOut:
    doc = await _draft(db, chain.chain_id, draft_id)
    _own(doc, user.address)
    _editable(doc)
    documents = [d for d in doc.get("documents", []) if d["id"] != file_id]
    if len(documents) == len(doc.get("documents", [])):
        raise ApiError(404, "no_file", "No such file on this draft")
    await db.mint_drafts.update_one({"_id": doc["_id"]}, {"$set": {"documents": documents, "updatedAt": _now()}})
    await delete_files(db, [file_id])
    return draft_out({**doc, "documents": documents}, await Book.load(db, chain.chain_id, catalog))


@router.post("/chains/{chain_id}/mint/drafts/{draft_id}/prepare", response_model=MintPrepareOut)
async def prepare_request(draft_id: str, chain: Chain, db: Db, catalog: CatalogDep, user: User) -> MintPrepareOut:
    """Freeze the evidence and return requestMint's arguments. Safe to call again until the request is indexed."""
    cid = chain.chain_id
    await link_submitted_drafts(db, cid)
    doc = await _draft(db, cid, draft_id)
    _own(doc, user.address)
    if doc.get("status") == "requested":
        raise ApiError(409, "already_requested", f"This draft is already mint request {doc.get('requestId')}")
    missing = missing_docs(doc)
    if missing:
        titles = [DOC_KINDS[k][0] for k in missing]
        raise ApiError(422, "documents_missing", f"Upload: {', '.join(titles)}", {"missing": missing})

    wid, qty = int(doc["warehouseId"]), int(doc["quantityKg"])
    cert, uri = cert_hash(doc["certificateId"]), evidence_uri(str(doc["_id"]))
    if await live_cert_claims(db, cert, exclude_id=doc["_id"], chain_id=cid):
        raise ApiError(409, "certificate_in_use", "This certificate is already on another mint request")

    identity, registry, passport = chain.contract("IdentityRegistry"), chain.contract("WarehouseRegistry"), chain.contract("MaterialPassport")
    controller, guard = chain.contract("MintingController"), chain.contract("ReserveGuard")
    verified, active, frozen, used, pending, can_add, params = await asyncio.gather(
        chain.call(identity.functions.isVerified(user.address)),
        chain.call(registry.functions.isActive(wid)),
        chain.call(registry.functions.isFrozen(wid)),
        chain.call(passport.functions.certUsed(cert)),
        chain.call(controller.functions.pendingCertRequest(cert)),
        chain.call(guard.functions.canAdd(wid, qty)),
        controller_params(chain),
    )
    if not verified:
        raise ApiError(403, "not_verified", "Your wallet is not verified on this network yet")
    if not active or frozen:
        raise ApiError(409, "warehouse_unavailable", "This warehouse is frozen or inactive; choose another")
    if used or int(pending):
        raise ApiError(409, "certificate_in_use", "This certificate has already been tokenized or is on an open request")

    warnings = [] if can_add else ["The warehouse's attested reserve does not cover this lot right now. You can submit; minting waits until it does."]
    fee, token, allowance_needed = params["mintFee"], params["feeToken"], False
    if fee and token:
        erc20 = chain.contract_at(ABI_ALIASES.get("USDC", "USDC"), token)
        allowance = await chain.call(erc20.functions.allowance(user.address, controller.address))
        allowance_needed = int(allowance) < fee

    now = _now()
    update = {"status": "submitted", "certHash": cert, "evidenceUri": uri, "updatedAt": now, "submittedAt": doc.get("submittedAt") or now}
    await db.mint_drafts.update_one({"_id": doc["_id"]}, {"$set": update})
    return MintPrepareOut(
        draft=draft_out({**doc, **update}, await Book.load(db, cid, catalog)),
        controller=controller.address,
        warehouse_id=wid,
        material_code="0x" + material_hash(doc["material"]).hex(),
        quantity_kg=qty,
        cert_hash=cert,
        evidence_uri=uri,
        mint_fee=str(fee),
        fee_token=token,
        allowance_needed=allowance_needed,
        warnings=warnings,
    )


@router.post("/chains/{chain_id}/mint/drafts/{draft_id}/reopen", response_model=MintDraftOut)
async def reopen_draft(draft_id: str, chain: Chain, db: Db, catalog: CatalogDep, user: User) -> MintDraftOut:
    """Back to editing after the wallet refused or the requestMint transaction failed."""
    cid = chain.chain_id
    await link_submitted_drafts(db, cid)
    doc = await _draft(db, cid, draft_id)
    _own(doc, user.address)
    if doc.get("status") == "requested":
        raise ApiError(409, "already_requested", f"This draft is already mint request {doc.get('requestId')}")
    if doc.get("status") == "submitted":
        await db.mint_drafts.update_one({"_id": doc["_id"]}, {"$set": {"status": "draft", "updatedAt": _now()}})
        doc["status"] = "draft"
    return draft_out(doc, await Book.load(db, cid, catalog))


# ------------------------------------------------------------------ requests (steps 3-7)


async def _review_states(db, chain_id: int, request_ids: list[int]) -> dict[int, str]:
    jobs = await db.jobs.find(
        {"chainId": chain_id, "kind": "mint.review", "payload.requestId": {"$in": request_ids}}, {"payload": 1, "status": 1, "createdAt": 1}
    ).sort("createdAt", 1).to_list(None)
    return {int(j["payload"]["requestId"]): {"done": "running"}.get(j["status"], j["status"]) for j in jobs}


@router.get("/chains/{chain_id}/mint/requests", response_model=MintRequestsOut)
async def list_requests(
    chain: Chain, db: Db, catalog: CatalogDep, user: User,
    scope: str = Query("mine", pattern="^(mine|all)$"),
    state: str = Query("all", pattern="^(open|closed|all)$"),
    limit: int = Query(100, ge=1, le=500),
) -> MintRequestsOut:
    cid = chain.chain_id
    query: dict = {"chainId": cid}
    if scope == "mine":
        query["owner"] = user.address
    elif not await _is_staff(chain, user.address):
        raise ApiError(403, "forbidden", "Only Tensile staff can list every request")
    if state == "open":
        query["status"] = "REQUESTED"
    elif state == "closed":
        query["status"] = {"$ne": "REQUESTED"}
    docs = await db.mint_requests.find(query).sort("createdAt", -1).to_list(limit)
    ids = [int(d["requestId"]) for d in docs]
    book, atts, review_states = await asyncio.gather(
        Book.load(db, cid, catalog),
        db.attestations.find({"chainId": cid, "subjectType": "REQUEST", "subject": {"$in": ids}}).to_list(None),
        _review_states(db, cid, ids),
    )
    try:
        min_score = (await controller_params(chain))["minAiScore"]
    except Exception:
        min_score = 70
    await book.add_names(db, [d.get("owner") for d in docs])
    by_request: dict[int, list] = {}
    for a in atts:
        by_request.setdefault(int(a["subject"]), []).append(a)
    rows = []
    for d in docs:
        rid = int(d["requestId"])
        latest = latest_by_kind(by_request.get(rid, []))
        frozen = bool((book.warehouses.get(d.get("warehouseId")) or {}).get("frozen"))
        steps, current = build_steps(d, draft=None, atts=latest, min_score=min_score, review_state=review_states.get(rid), frozen=frozen, reserve=None)
        step = next(s for s in steps if s.key == current)
        rows.append(MintRequestRowOut(
            request=book.request(d), title=title_for(d, catalog), owner_name=book.name(d.get("owner")),
            warehouse_code=(book.warehouses.get(d.get("warehouseId")) or {}).get("code"),
            current_step=current, current_label=f"{step.label} · {step.detail}" if step.detail else step.label,
            review_score=int(latest["AI_REVIEW"]["score"]) if "AI_REVIEW" in latest else None,
            inspected="INSPECTION" in latest, custody=bool(d.get("custodyAt")) or "CUSTODY" in latest,
        ))
    return MintRequestsOut(chain_id=cid, requests=rows)


@router.get("/chains/{chain_id}/mint/requests/{request_id}", response_model=MintRequestDetailOut)
async def get_request(request_id: int, chain: Chain, db: Db, catalog: CatalogDep, user: User) -> MintRequestDetailOut:  # noqa: C901
    cid = chain.chain_id
    req = await db.mint_requests.find_one({"chainId": cid, "requestId": request_id})
    if req is None:
        raise ApiError(404, "no_request", f"No mint request {request_id} on {chain.config.name} (yet)")
    roles = await roles_on(chain, user.address, STAFF_ROLES)
    owner = req.get("owner")
    if owner != user.address and not roles:
        raise ApiError(403, "forbidden", "Only the owner and Tensile staff can see this request")

    events_filter = {"chainId": cid, "$or": [
        {"contract": "MintingController", "args.requestId": request_id},
        {"contract": "AttestationRegistry", "args.subjectType": 0, "args.subject": request_id},
    ]}
    book, atts, draft, review_job, custody_job, events = await asyncio.gather(
        Book.load(db, cid, catalog),
        db.attestations.find({"chainId": cid, "subjectType": "REQUEST", "subject": request_id}).sort("index", 1).to_list(None),
        draft_for_request(db, req),
        latest_job(db, cid, "mint.review", request_id),
        latest_job(db, cid, "mint.custody", request_id),
        db.events.find(events_filter).sort([("blockNumber", 1), ("logIndex", 1)]).to_list(200),
    )
    latest = latest_by_kind(atts)
    reports = await reports_by_hash(db, cid, [a.get("dataHash") for a in atts])
    await book.add_names(db, [owner, req.get("aiOverrideBy"), *(a.get("attestor") for a in atts)])

    try:
        params = await controller_params(chain)
    except Exception:
        params = {"minAiScore": 70, "requestTTL": 14 * 86400}
    open_ = req.get("status") == "REQUESTED"
    wid, qty = int(req.get("warehouseId") or 0), int(req.get("quantityKg") or 0)
    warehouse_doc = book.warehouses.get(wid)
    frozen = bool((warehouse_doc or {}).get("frozen"))

    reserve = blocker = None
    if open_:
        controller = chain.contract("MintingController")
        try:
            reserve, blocker = await asyncio.gather(
                reserve_check(chain, warehouse_doc, wid, qty), simulate(chain, controller.functions.finalizeMint(request_id), owner),
            )
        except Exception:  # RPC trouble: show the rest
            reserve, blocker = None, ("Unavailable", "Could not reach the network to check")

    # review: the attested one, else the report / job in flight
    review_att = latest.get("AI_REVIEW")
    review_report = reports.get(review_att["dataHash"]) if review_att else await db.reports.find_one(
        {"chainId": cid, "kind": "AI_REVIEW", "subject": request_id}, sort=[("createdAt", -1)])
    review = review_out(review_att, review_report, review_job, threshold=params["minAiScore"],
                        override=bool(req.get("aiOverride")), override_by=book.label(req.get("aiOverrideBy")) if req.get("aiOverrideBy") else None)

    # inspection: attested, else sealed-but-unsigned, else the failed report behind a rejection
    insp_att = latest.get("INSPECTION")
    inspection = None
    if insp_att and reports.get(insp_att["dataHash"]):
        inspection = inspection_out(reports[insp_att["dataHash"]], insp_att, book)
    else:
        pending = await db.reports.find_one({"chainId": cid, "kind": "INSPECTION", "subjectType": "REQUEST", "subject": request_id}, sort=[("createdAt", -1)])
        if pending:
            inspection = inspection_out(pending, None, book, rejected=req.get("status") == "REJECTED")

    custody_att = latest.get("CUSTODY")
    custody_report = reports.get(custody_att["dataHash"]) if custody_att else await db.reports.find_one(
        {"chainId": cid, "kind": "CUSTODY", "subject": request_id}, sort=[("createdAt", -1)])
    custody = custody_out(req, custody_att, custody_report, custody_job, book)

    review_state = None if review_job is None else {"done": "running"}.get(review_job.get("status"), review_job.get("status"))
    steps, current = build_steps(req, draft=draft, atts=latest, min_score=params["minAiScore"], review_state=review_state, frozen=frozen, reserve=reserve)

    expiry = expires_at(req, params["requestTTL"])
    review_low = review_att is not None and int(review_att.get("score") or 0) < params["minAiScore"]
    actions = MintActionsOut(
        can_cancel=open_ and owner == user.address,
        can_finalize=open_ and blocker is None,
        finalize_blocker=blocker[0] if blocker else None,
        finalize_message=blocker[1] if blocker else None,
        can_expire=open_ and expiry is not None and _now() > expiry,
        can_override=open_ and "RISK_ADMIN" in roles and review_low and not req.get("aiOverride"),
        can_reject=open_ and bool(roles & {"RISK_ADMIN", "INSPECTOR"}),
        can_inspect=open_ and "INSPECTOR" in roles and insp_att is None and not frozen,
    )

    material = catalog.materials.get(req.get("material") or "")
    lot_like = {"tokenId": 0, "material": req.get("material"), "warehouseId": wid, "quantityKg": qty}
    lot = book.lot(lot_like)
    return MintRequestDetailOut(
        request=book.request(req),
        title=title_for(req, catalog) if req.get("status") != "FINALIZED" else "Passport issued",
        material_name=material.name if material else None,
        symbol=material.symbol if material else None,
        owner_name=book.name(owner),
        warehouse=_warehouse(warehouse_doc, catalog) if warehouse_doc else None,
        expires_at=expiry,
        min_ai_score=params["minAiScore"],
        indicative_value_usd=lot.value_usd,
        borrow_capacity_usdc=lot.max_borrow_usdc,
        steps=steps,
        current_step=current,
        draft=draft_out(draft, book) if draft else None,
        review=review,
        inspection=inspection,
        custody=custody,
        reserve=reserve,
        actions=actions,
        attestations=[book.attestation(a, wid) for a in atts],
        history=await describe(db, book, events),
        reject_reason=req.get("rejectReason"),
    )


# ------------------------------------------------------------------ files and public records


@router.get("/chains/{chain_id}/evidence/files/{file_id}")
async def download_evidence(file_id: str, chain: Chain, db: Db, user: User):
    doc = await file_meta(db, file_id)
    meta = doc.get("metadata") or {}
    if meta.get("chainId") != chain.chain_id:
        raise ApiError(404, "no_file", "No such file on this network")
    allowed = meta.get("uploader") == user.address
    if not allowed and meta.get("scope") == "report":
        report = await db.reports.find_one({"_id": oid(meta.get("ref", ""), "report")}, {"subjectType": 1, "subject": 1})
        if report and report["subjectType"] == "REQUEST":
            allowed = bool(await db.mint_requests.find_one({"chainId": chain.chain_id, "requestId": report["subject"], "owner": user.address}, {"_id": 1}))
        elif report:
            allowed = bool(await db.lots.find_one({"chainId": chain.chain_id, "tokenId": report["subject"], "owner": user.address}, {"_id": 1}))
    if not allowed and not await _is_staff(chain, user.address):
        raise ApiError(403, "forbidden", "Only the owner and Tensile staff can open this file")
    return await stream_file(db, doc)


@router.get("/evidence/{draft_id}", response_model=EvidenceManifestOut)
async def evidence_manifest(draft_id: str, db: Db) -> EvidenceManifestOut:
    """Resolves tensile://evidence/<id>: the file list with hashes (contents need sign-in)."""
    doc = await db.mint_drafts.find_one({"_id": oid(draft_id, "evidence bundle"), "status": {"$in": ["submitted", "requested"]}})
    if doc is None:
        raise ApiError(404, "no_evidence", "No such evidence bundle")
    return EvidenceManifestOut(
        draft_id=str(doc["_id"]), chain_id=doc["chainId"], owner=doc["owner"], cert_hash=doc.get("certHash"),
        evidence_uri=doc.get("evidenceUri") or evidence_uri(str(doc["_id"])), request_id=doc.get("requestId"),
        documents=[file_out(d) for d in doc.get("documents", [])], submitted_at=doc.get("submittedAt"),
    )


@router.get("/reports/{report_id}", response_model=ReportOut)
async def get_report(report_id: str, db: Db) -> ReportOut:
    """Resolves tensile://reports/<id>: the body an attestation's dataHash commits to."""
    doc = await db.reports.find_one({"_id": oid(report_id, "report")})
    if doc is None:
        raise ApiError(404, "no_report", "No such report")
    return ReportOut(
        id=str(doc["_id"]), chain_id=doc["chainId"], kind=doc["kind"], subject_type=doc["subjectType"], subject=int(doc["subject"]),
        data_hash=doc["dataHash"], uri=doc["uri"], verified=data_hash(doc["body"]) == doc["dataHash"], body=doc["body"],
    )
