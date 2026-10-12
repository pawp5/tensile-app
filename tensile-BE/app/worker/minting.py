"""Mint keeper: drives open mint requests forward from the service wallet.

Every few seconds the keeper looks at open requests (Mongo projection) and queues:
  mint.review   automated review -> AttestationRegistry.attest(AI_REVIEW, REQUEST, id, score, dataHash, uri)
  mint.custody  once inspected, confirm custody as warehouse operator -> MintingController.confirmCustody
                (only for warehouses whose on-chain operator is this backend's service wallet)
  mint.expire   past the TTL -> MintingController.expireRequest (frees the certificate)
Handlers re-read the chain first, so a retried or duplicated job does nothing twice.

The review is rule-based: it reads the evidence (PDF text via pypdf) and scores seven checks out of 100.
It is advisory; the contract still needs an inspector attestation and custody to mint.
"""
import asyncio
import io
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import pypdf
from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core import jobs
from app.core.chains import ChainContext
from app.core.config import Settings
from app.core.evidence import cert_hash, data_hash, normalise, read_file, report_uri
from app.core.minting import controller_params, draft_for_request, link_submitted_drafts, live_cert_claims
from app.core.txsender import Tx, TxSender

KIND_CODES = {"CUSTODY": 0, "INSPECTION": 1, "REINSPECTION": 2, "AI_REVIEW": 3, "RELEASE": 4}
REQUESTED = 1  # MintingController.Status.REQUESTED
KEYWORDS = {
    "CU": ("copper", "cathode"),
    "AL": ("aluminium", "aluminum", "p1020"),
    "NI": ("nickel", "briquette"),
    "ZN": ("zinc", "shg"),
    "RB": ("rebar", "b500b"),
}
REVIEWER = "Tensile automated review (rule-based)"
FAILED_JOB_COOLDOWN = timedelta(minutes=30)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _compact(text: str | None) -> str:
    return re.sub(r"[^A-Z0-9]", "", (text or "").upper())


def _tx_hash(receipt: dict) -> str:
    return "0x" + bytes(receipt["transactionHash"]).hex()


# ------------------------------------------------------------------ keeper


class MintKeeper:
    def __init__(self, chain: ChainContext, db: AsyncDatabase, settings: Settings, service_address: str) -> None:
        self.chain = chain
        self.db = db
        self.settings = settings
        self.service = service_address

    async def run(self) -> dict[str, int]:
        cid = self.chain.chain_id
        linked = await link_submitted_drafts(self.db, cid)
        open_requests = await self.db.mint_requests.find({"chainId": cid, "status": "REQUESTED"}).to_list(500)
        queued = {"linked": linked, "review": 0, "custody": 0, "expire": 0}
        if not open_requests:
            return queued
        ids = [int(r["requestId"]) for r in open_requests]
        atts = await self.db.attestations.find(
            {"chainId": cid, "subjectType": "REQUEST", "subject": {"$in": ids}}, {"subject": 1, "kind": 1}
        ).to_list(None)
        kinds: dict[int, set[str]] = {}
        for a in atts:
            kinds.setdefault(int(a["subject"]), set()).add(a["kind"])
        operators = {
            w["warehouseId"]: w.get("operator")
            for w in await self.db.warehouses.find({"chainId": cid}, {"warehouseId": 1, "operator": 1}).to_list(None)
        }
        ttl = (await controller_params(self.chain))["requestTTL"]
        now = _now()

        for r in open_requests:
            rid, have = int(r["requestId"]), kinds.get(int(r["requestId"]), set())
            created = r.get("createdAt")
            if created and created + timedelta(seconds=ttl) < now:
                queued["expire"] += await self._queue("mint.expire", rid)
                continue
            if "AI_REVIEW" not in have and not await self._reported("AI_REVIEW", rid):
                queued["review"] += await self._queue("mint.review", rid)
            if (
                self.settings.auto_custody and "INSPECTION" in have and "CUSTODY" not in have and not r.get("custodyAt")
                and operators.get(r.get("warehouseId")) == self.service and not await self._reported("CUSTODY", rid)
            ):
                queued["custody"] += await self._queue("mint.custody", rid)
        return queued

    async def _reported(self, kind: str, rid: int) -> bool:
        """A report already posted (or being posted) for this request: its attestation may not be indexed yet."""
        return bool(await self.db.reports.find_one(
            {"chainId": self.chain.chain_id, "kind": kind, "subject": rid, "status": {"$in": ["posting", "posted"]}}, {"_id": 1}
        ))

    async def _queue(self, kind: str, rid: int) -> int:
        cid = self.chain.chain_id
        failed = await self.db.jobs.find_one(
            {"chainId": cid, "kind": kind, "payload.requestId": rid, "status": "failed", "finishedAt": {"$gte": _now() - FAILED_JOB_COOLDOWN}},
            {"_id": 1},
        )
        if failed:
            return 0
        open_job = await self.db.jobs.find_one({"dedupeKey": f"{kind}:{cid}:{rid}", "open": True}, {"_id": 1})
        if open_job:
            return 0
        await jobs.enqueue(self.db, cid, kind, {"requestId": rid}, dedupe_key=f"{kind}:{cid}:{rid}", max_attempts=4)
        return 1


# ------------------------------------------------------------------ automated review


async def _pdf_text(data: bytes) -> str:
    def extract() -> str:
        try:
            reader = pypdf.PdfReader(io.BytesIO(data))
            return " ".join((page.extract_text() or "") for page in reader.pages[:20])
        except Exception:
            return ""

    return await asyncio.to_thread(extract)


def _check(key: str, label: str, result: str, tone: str, points: int, max_points: int) -> dict[str, Any]:
    return {"key": key, "label": label, "result": result, "tone": tone, "points": points, "maxPoints": max_points}


async def review_checks(db: AsyncDatabase, request: dict[str, Any], draft: dict[str, Any] | None, symbol: str | None) -> list[dict[str, Any]]:
    """Seven checks, 100 points. Text checks only apply to PDFs; images get partial credit (the inspector sees them)."""
    docs = (draft or {}).get("documents", [])
    by_kind: dict[str, list[dict]] = {}
    for d in docs:
        by_kind.setdefault(d["kind"], []).append(d)
    texts: dict[str, str] = {}
    for d in docs:
        if d["contentType"] == "application/pdf" and d["kind"] in ("certificate", "receipt", "weighbridge"):
            try:
                texts[d["id"]] = await _pdf_text(await read_file(db, d["id"], limit=10 * 1024 * 1024))
            except Exception:
                texts[d["id"]] = ""

    def text_of(kind: str) -> tuple[str, bool]:
        """(compacted text of every PDF of that kind, whether any of them is an image)"""
        files = by_kind.get(kind, [])
        return _compact(" ".join(texts.get(f["id"], "") for f in files)), any(f["contentType"] != "application/pdf" for f in files)

    cert_id = (draft or {}).get("certificateId")
    receipt_no = (draft or {}).get("receiptNo")
    checks: list[dict[str, Any]] = []

    cert = by_kind.get("certificate")
    checks.append(_check("certificate", "Certificate of analysis on file", "On file" if cert else "Missing",
                         "t-success" if cert else "t-danger", 20 if cert else 0, 20))

    cert_text, cert_image = text_of("certificate")
    if not cert:
        checks.append(_check("certificate_id", "Certificate identifier on the certificate", "No certificate", "t-danger", 0, 20))
    elif cert_id and _compact(cert_id) in cert_text:
        checks.append(_check("certificate_id", "Certificate identifier on the certificate", f"Matches {cert_id}", "t-success", 20, 20))
    elif cert_image and not cert_text:
        checks.append(_check("certificate_id", "Certificate identifier on the certificate", "Image only · left to the inspector", "t-warning", 10, 20))
    else:
        checks.append(_check("certificate_id", "Certificate identifier on the certificate", "Not found in the document", "t-danger", 0, 20))

    receipt_text, receipt_image = text_of("receipt")
    if not by_kind.get("receipt"):
        checks.append(_check("receipt", "Certificate matches warehouse receipt", "No receipt", "t-danger", 0, 15))
    elif (receipt_no and _compact(receipt_no) in receipt_text) or (cert_id and _compact(cert_id) in receipt_text):
        checks.append(_check("receipt", "Certificate matches warehouse receipt", "Consistent", "t-success", 15, 15))
    elif receipt_image and not receipt_text:
        checks.append(_check("receipt", "Certificate matches warehouse receipt", "Image only · left to the inspector", "t-warning", 8, 15))
    else:
        checks.append(_check("receipt", "Certificate matches warehouse receipt", "Receipt number not found", "t-warning", 7, 15))

    words = KEYWORDS.get(symbol or "", ())
    if cert and words and any(_compact(w) in cert_text for w in words):
        checks.append(_check("grade", "Brand and grade on certificate", "Recognised", "t-success", 15, 15))
    elif cert and cert_image and not cert_text:
        checks.append(_check("grade", "Brand and grade on certificate", "Image only · left to the inspector", "t-warning", 7, 15))
    else:
        checks.append(_check("grade", "Brand and grade on certificate", "Material not named on the certificate" if cert else "No certificate", "t-danger", 0, 15))

    qty = int(request.get("quantityKg") or 0)
    variants = {f"{qty / 1000:.3f}", f"{qty / 1000:,.3f}", f"{qty / 1000:.2f}", f"{qty:,}", str(qty)}
    weigh_text, _ = text_of("weighbridge")
    if by_kind.get("weighbridge") and any(_compact(v) in weigh_text for v in variants if len(_compact(v)) >= 3):
        checks.append(_check("weight", "Declared weight vs weighbridge", f"{qty / 1000:,.3f} t on the tickets", "t-success", 10, 10))
    elif by_kind.get("weighbridge"):
        checks.append(_check("weight", "Declared weight vs weighbridge", "Total not found on the tickets", "t-warning", 5, 10))
    else:
        checks.append(_check("weight", "Declared weight vs weighbridge", "No weighbridge tickets", "t-warning", 3, 10))

    photos = [d for d in by_kind.get("photos", []) if d["contentType"].startswith("image/")]
    checks.append(_check("photos", "Bundle photographs", f"{len(photos)} photograph{'s' if len(photos) != 1 else ''}" if photos else "None",
                         "t-success" if photos else "t-warning", 10 if photos else 3, 10))

    exact = near = 0
    if draft is not None:
        others = draft["_id"]
        if cert_id:
            exact += await live_cert_claims(db, cert_hash(cert_id), exclude_id=others)
        hashes = [d["sha256"] for d in docs]
        if hashes:
            near = await db.mint_drafts.count_documents({"_id": {"$ne": others}, "documents.sha256": {"$in": hashes}})
    if exact:
        checks.append(_check("duplicates", "Duplicate certificate search", "Certificate already used", "t-danger", 0, 10))
    elif near:
        checks.append(_check("duplicates", "Duplicate certificate search", f"{near} near match{'es' if near != 1 else ''} · same file elsewhere", "t-warning", 5, 10))
    else:
        checks.append(_check("duplicates", "Duplicate certificate search", "No matches", "t-success", 10, 10))
    return checks


# ------------------------------------------------------------------ job handlers (registered in app.worker.service)


async def _open_request(w: Any, rid: int) -> tuple[Any, ...] | None:
    """The on-chain request tuple if it is still REQUESTED, else None."""
    req = await w.chain.call(w.chain.contract("MintingController").functions.getRequest(rid), timeout=20, retries=3)
    return req if int(req[5]) == REQUESTED else None


async def _post_report(w: Any, kind: str, rid: int, body: dict[str, Any], make_tx) -> dict[str, Any]:
    """Store the report, send the attestation tx built by make_tx(dataHash bytes, uri), record the outcome."""
    db, cid = w.rt.db, w.chain.chain_id
    report_id = ObjectId()
    body = normalise(body)
    digest, uri = data_hash(body), report_uri(str(report_id))
    await db.reports.update_many({"chainId": cid, "kind": kind, "subject": rid, "status": "posting"}, {"$set": {"status": "failed", "error": "superseded"}})
    await db.reports.insert_one({
        "_id": report_id, "chainId": cid, "kind": kind, "subjectType": "REQUEST", "subject": rid, "body": body,
        "dataHash": digest, "uri": uri, "status": "posting", "createdBy": w.sender.address, "createdAt": _now(),
    })
    try:
        receipt = (await w.sender.send([make_tx(bytes.fromhex(digest[2:]), uri)]))[0]
    except BaseException as exc:
        await db.reports.update_one({"_id": report_id}, {"$set": {"status": "failed", "error": f"{type(exc).__name__}: {exc}"[:300]}})
        raise
    await db.reports.update_one({"_id": report_id}, {"$set": {"status": "posted", "txHash": _tx_hash(receipt)}})
    return {"sent": True, "reportId": str(report_id), "dataHash": digest, "txHash": _tx_hash(receipt), "block": receipt["blockNumber"]}


async def mint_review(w: Any, payload: dict[str, Any]) -> dict[str, Any]:
    rid = int(payload["requestId"])
    chain, db = w.chain, w.rt.db
    registry = chain.contract("AttestationRegistry")
    if await _open_request(w, rid) is None:
        return {"sent": False, "reason": "request is no longer open"}
    existing = await chain.call(registry.functions.latest(KIND_CODES["AI_REVIEW"], 0, rid), timeout=20, retries=3)
    if int(existing[3], 16) != 0:
        return {"sent": False, "reason": "already reviewed on-chain"}
    request = await db.mint_requests.find_one({"chainId": chain.chain_id, "requestId": rid})
    if request is None:
        raise RuntimeError(f"request {rid} is not indexed yet")
    params = await controller_params(chain)
    draft = await draft_for_request(db, request)
    material = w.rt.catalog.materials.get(request.get("material") or "")
    checks = await review_checks(db, request, draft, material.symbol if material else None)
    score = max(0, min(100, sum(c["points"] for c in checks)))
    body = {
        "type": "tensile.mint-review/v1",
        "chainId": chain.chain_id,
        "requestId": rid,
        "owner": request.get("owner"),
        "material": request.get("material"),
        "warehouseId": request.get("warehouseId"),
        "quantityKg": request.get("quantityKg"),
        "certHash": request.get("certHash"),
        "evidenceURI": request.get("evidenceURI"),
        "documents": [{"kind": d["kind"], "filename": d["filename"], "sha256": d["sha256"], "size": d["size"]} for d in (draft or {}).get("documents", [])],
        "checks": checks,
        "score": score,
        "threshold": params["minAiScore"],
        "reviewer": REVIEWER,
        "reviewedAt": _now(),
    }
    w.log.info("review MR-%04d: score %d", rid, score)
    return await _post_report(w, "AI_REVIEW", rid, body, lambda digest, uri: Tx(
        f"review MR-{rid:04d} score {score}", registry.functions.attest(KIND_CODES["AI_REVIEW"], 0, rid, score, digest, uri)))


async def mint_custody(w: Any, payload: dict[str, Any]) -> dict[str, Any]:
    rid = int(payload["requestId"])
    chain, db = w.chain, w.rt.db
    req = await _open_request(w, rid)
    if req is None:
        return {"sent": False, "reason": "request is no longer open"}
    if int(req[4]) != 0:
        return {"sent": False, "reason": "custody already confirmed"}
    wid = int(req[1])
    operator = await chain.call(chain.contract("WarehouseRegistry").functions.operatorOf(wid), timeout=20, retries=3)
    if operator != w.sender.address:
        return {"sent": False, "reason": f"warehouse {wid} is operated by {operator}, not this backend"}
    registry = chain.contract("AttestationRegistry")
    insp = await chain.call(registry.functions.latest(KIND_CODES["INSPECTION"], 0, rid), timeout=20, retries=3)
    if int(insp[3], 16) == 0:
        return {"sent": False, "reason": "not inspected yet"}
    insp_hash = "0x" + bytes(insp[6]).hex()
    insp_report = await db.reports.find_one({"chainId": chain.chain_id, "dataHash": insp_hash}) or {}
    request = await db.mint_requests.find_one({"chainId": chain.chain_id, "requestId": rid}) or {}
    draft = await draft_for_request(db, request) if request else None
    warehouse = await db.warehouses.find_one({"chainId": chain.chain_id, "warehouseId": wid}) or {}
    body = {
        "type": "tensile.custody/v1",
        "chainId": chain.chain_id,
        "requestId": rid,
        "warehouse": {"id": wid, "code": warehouse.get("code"), "name": warehouse.get("name"), "operator": operator, "operatorName": warehouse.get("operatorName")},
        "quantityKg": int(req[2]),
        "receiptNo": (draft or {}).get("receiptNo"),
        "seals": (insp_report.get("body") or {}).get("seals"),
        "inspection": {"dataHash": insp_hash, "attestor": insp[3]},
        "statement": "The sealed material is held for Tensile and will only be released against a redemption.",
        "confirmedBy": "Warehouse operator desk",
        "confirmedAt": _now(),
    }
    controller = chain.contract("MintingController")
    return await _post_report(w, "CUSTODY", rid, body, lambda digest, uri: Tx(
        f"custody MR-{rid:04d}", controller.functions.confirmCustody(rid, digest, uri)))


async def mint_expire(w: Any, payload: dict[str, Any]) -> dict[str, Any]:
    rid = int(payload["requestId"])
    req = await _open_request(w, rid)
    if req is None:
        return {"sent": False, "reason": "request is no longer open"}
    ttl = (await controller_params(w.chain))["requestTTL"]
    head = await w.chain.w3.eth.get_block("latest")
    if int(head["timestamp"]) <= int(req[3]) + ttl:
        return {"sent": False, "reason": "not expired yet"}
    controller = w.chain.contract("MintingController")
    receipt = (await w.sender.send([Tx(f"expire MR-{rid:04d}", controller.functions.expireRequest(rid))]))[0]
    return {"sent": True, "txHash": _tx_hash(receipt), "block": receipt["blockNumber"]}


JOBS = {"mint.review": mint_review, "mint.custody": mint_custody, "mint.expire": mint_expire}


def keeper_for(chain: ChainContext, db: AsyncDatabase, settings: Settings, sender: TxSender) -> MintKeeper:
    return MintKeeper(chain, db, settings, sender.address)
