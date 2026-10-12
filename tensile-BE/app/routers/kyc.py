"""KYC: applications, documents (GridFS) and staff review.

An application is per wallet and shared by every chain: approving it queues a `kyc.set_identity`
job per chain, and the worker writes IdentityRegistry.setIdentity with the service wallet
(which holds KYC_ADMIN). Documents never go on-chain; only the pass/fail identity does.
"""
import hashlib
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from eth_utils import is_address, to_checksum_address
from fastapi import APIRouter, File, Form, Query, UploadFile
from fastapi.responses import StreamingResponse
from gridfs import AsyncGridFSBucket
from gridfs.errors import NoFile
from pymongo.asynchronous.database import AsyncDatabase

from app.core import jobs
from app.core.authz import KycAdmin, has_role_anywhere
from app.core.chains import ChainRegistry
from app.core.deps import CatalogDep, Db, Registry, User
from app.core.errors import ApiError
from app.core.present import short
from app.core.schemas import (
    KycApplicationIn, KycApplicationOut, KycApproveIn, KycChainStatus, KycDocumentOut, KycListOut, KycMeOut,
    KycRejectIn, KycRequirementOut,
)

router = APIRouter(prefix="/kyc", tags=["kyc"])

BUCKET = "kyc_docs"
MAX_DOC_BYTES = 10 * 1024 * 1024
DOC_KINDS = {
    "registration": ("Company registration", "Certificate of incorporation or equivalent"),
    "owners": ("Beneficial owners", "All owners above 25% identified"),
    "directors": ("Register of directors", "Current register, dated within 12 months"),
}
# Rule-based screen until a screening provider is wired in: countries under comprehensive sanctions.
SANCTIONED_COUNTRIES = {"CU": "Cuba", "IR": "Iran", "KP": "North Korea", "SY": "Syria"}
_MAGIC = ((b"%PDF", "application/pdf"), (b"\x89PNG", "image/png"), (b"\xff\xd8\xff", "image/jpeg"))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _bucket(db: AsyncDatabase) -> AsyncGridFSBucket:
    return AsyncGridFSBucket(db, bucket_name=BUCKET)


def _sniff(head: bytes) -> str | None:
    return next((ctype for magic, ctype in _MAGIC if head.startswith(magic)), None)


def _requirements(doc: dict) -> list[KycRequirementOut]:
    status = doc.get("status", "draft")
    docs = {d["kind"]: d for d in doc.get("documents", [])}
    out = [KycRequirementOut(key="wallet", title="Wallet ownership", detail=f"Signed message from {short(doc['address'])}", state="complete")]
    for key in ("registration", "owners"):
        title, detail = DOC_KINDS[key]
        d = docs.get(key)
        out.append(KycRequirementOut(key=key, title=title, detail=d["filename"] if d else detail, state="complete" if d else "required"))
    screening = doc.get("screening")
    if status == "approved" or screening == "clear":
        s_state, s_detail = "complete", "Entity screened · no matches"
    elif screening == "flagged":
        s_state, s_detail = ("failed" if status == "rejected" else "in_review"), "; ".join(doc.get("screeningNotes", [])) or "Flagged for manual review"
    else:
        s_state, s_detail = "required", "Runs automatically when you submit"
    out.append(KycRequirementOut(key="screening", title="Sanctions and PEP screening", detail=s_detail, state=s_state))
    title, detail = DOC_KINDS["directors"]
    d = docs.get("directors")
    out.append(KycRequirementOut(key="directors", title=title, detail=d["filename"] if d else detail, state="complete" if d else "required"))
    return out


async def _out(db: AsyncDatabase, registry: ChainRegistry, doc: dict) -> KycApplicationOut:
    chain_statuses: list[KycChainStatus] = []
    job_ids = (doc.get("approval") or {}).get("jobs") or {}
    if job_ids:
        found = {str(j["_id"]): j for j in await db.jobs.find({"_id": {"$in": [ObjectId(j) for j in job_ids.values()]}}).to_list(None)}
        for chain_id, job_id in sorted(job_ids.items()):
            ctx = registry.get(int(chain_id))
            j = found.get(job_id) or {}
            chain_statuses.append(KycChainStatus(
                chain_id=int(chain_id),
                chain_name=ctx.config.name if ctx else chain_id,
                status=j.get("status", "done" if not j else "queued"),
                tx_hash=(j.get("result") or {}).get("txHash"),
                error=j.get("error") if j.get("status") == "failed" else None,
            ))
    return KycApplicationOut(
        address=doc["address"],
        status=doc.get("status", "draft"),
        org_name=doc.get("orgName"),
        country=doc.get("country"),
        entity_type=doc.get("entityType"),
        tier=doc.get("tier"),
        contact_email=doc.get("contactEmail"),
        documents=[
            KycDocumentOut(id=d["id"], kind=d["kind"], filename=d["filename"], content_type=d["contentType"], size=d["size"], sha256=d["sha256"], uploaded_at=d["uploadedAt"])
            for d in doc.get("documents", [])
        ],
        requirements=_requirements(doc),
        screening=doc.get("screening"),
        screening_notes=doc.get("screeningNotes", []),
        submitted_at=doc.get("submittedAt"),
        reviewed_at=doc.get("reviewedAt"),
        reviewed_by=doc.get("reviewedBy"),
        reject_reason=doc.get("rejectReason"),
        approved_tier=doc.get("approvedTier"),
        expires_at=doc.get("expiresAt"),
        attestations=chain_statuses,
        created_at=doc.get("createdAt"),
        updated_at=doc.get("updatedAt"),
    )


async def _mine(db: AsyncDatabase, address: str) -> dict:
    doc = await db.kyc_applications.find_one({"address": address})
    if doc is None:
        raise ApiError(404, "no_application", "Save your organisation details first")
    return doc


def _editable(doc: dict) -> None:
    if doc.get("status") == "in_review":
        raise ApiError(409, "in_review", "Your application is in review and can't be changed right now")


# ------------------------------------------------------------------ applicant


@router.get("/me", response_model=KycMeOut)
async def get_my_application(user: User, db: Db, registry: Registry) -> KycMeOut:
    doc = await db.kyc_applications.find_one({"address": user.address})
    return KycMeOut(application=await _out(db, registry, doc) if doc else None)


@router.put("/me", response_model=KycApplicationOut)
async def save_my_application(body: KycApplicationIn, user: User, db: Db, registry: Registry) -> KycApplicationOut:
    existing = await db.kyc_applications.find_one({"address": user.address}, {"status": 1})
    if existing:
        _editable(existing)
    now = _now()
    await db.kyc_applications.update_one(
        {"address": user.address},
        {
            "$set": {
                "orgName": body.org_name, "country": body.country, "entityType": body.entity_type, "tier": body.tier,
                "contactEmail": body.contact_email, "status": "draft", "rejectReason": None, "updatedAt": now,
            },
            "$setOnInsert": {"address": user.address, "documents": [], "createdAt": now},
        },
        upsert=True,
    )
    return await _out(db, registry, await _mine(db, user.address))


@router.post("/me/documents", response_model=KycApplicationOut)
async def upload_document(
    user: User,
    db: Db,
    registry: Registry,
    kind: str = Form(...),
    file: UploadFile = File(...),
) -> KycApplicationOut:
    doc = await _mine(db, user.address)
    _editable(doc)
    if kind not in DOC_KINDS:
        raise ApiError(422, "bad_kind", f"kind must be one of {', '.join(DOC_KINDS)}")
    head = await file.read(8)
    content_type = _sniff(head)
    if content_type is None:
        raise ApiError(415, "unsupported_file", "Upload a PDF, PNG or JPEG file")
    filename = os.path.basename(file.filename or f"{kind}.pdf").strip()[:120] or f"{kind}.pdf"

    grid_in = _bucket(db).open_upload_stream(filename, metadata={"address": user.address, "kind": kind, "contentType": content_type})
    sha, size, chunk = hashlib.sha256(), 0, head
    try:
        while chunk:
            size += len(chunk)
            if size > MAX_DOC_BYTES:
                raise ApiError(413, "file_too_large", f"Files can be up to {MAX_DOC_BYTES // (1024 * 1024)} MB")
            sha.update(chunk)
            await grid_in.write(chunk)
            chunk = await file.read(256 * 1024)
        await grid_in.close()
    except BaseException:
        await grid_in.abort()
        raise

    now = _now()
    entry = {"id": str(grid_in._id), "kind": kind, "filename": filename, "contentType": content_type, "size": size, "sha256": sha.hexdigest(), "uploadedAt": now}
    replaced = [d for d in doc.get("documents", []) if d["kind"] == kind]
    kept = [d for d in doc.get("documents", []) if d["kind"] != kind]
    await db.kyc_applications.update_one(
        {"address": user.address}, {"$set": {"documents": kept + [entry], "status": "draft", "updatedAt": now}}
    )
    for old in replaced:  # one file per requirement: drop the one it replaces
        try:
            await _bucket(db).delete(ObjectId(old["id"]))
        except NoFile:
            pass
    return await _out(db, registry, await _mine(db, user.address))


@router.delete("/me/documents/{doc_id}", response_model=KycApplicationOut)
async def delete_document(doc_id: str, user: User, db: Db, registry: Registry) -> KycApplicationOut:
    doc = await _mine(db, user.address)
    _editable(doc)
    if not any(d["id"] == doc_id for d in doc.get("documents", [])):
        raise ApiError(404, "no_document", "No such document on your application")
    await db.kyc_applications.update_one(
        {"address": user.address}, {"$pull": {"documents": {"id": doc_id}}, "$set": {"status": "draft", "updatedAt": _now()}}
    )
    try:
        await _bucket(db).delete(ObjectId(doc_id))
    except NoFile:
        pass
    return await _out(db, registry, await _mine(db, user.address))


@router.post("/me/submit", response_model=KycApplicationOut)
async def submit_application(user: User, db: Db, registry: Registry) -> KycApplicationOut:
    doc = await _mine(db, user.address)
    _editable(doc)
    missing = [DOC_KINDS[k][0] for k in DOC_KINDS if not any(d["kind"] == k for d in doc.get("documents", []))]
    if missing:
        raise ApiError(422, "documents_missing", f"Upload: {', '.join(missing)}", {"missing": missing})
    notes: list[str] = []
    if doc.get("country") in SANCTIONED_COUNTRIES:
        notes.append(f"{SANCTIONED_COUNTRIES[doc['country']]} is under comprehensive sanctions")
    now = _now()
    await db.kyc_applications.update_one(
        {"address": user.address},
        {"$set": {
            "status": "in_review", "submittedAt": now, "updatedAt": now, "screening": "flagged" if notes else "clear",
            "screeningNotes": notes or ["No match on the sanctions country list (rule-based screen)"], "rejectReason": None,
        }},
    )
    return await _out(db, registry, await _mine(db, user.address))


# ------------------------------------------------------------------ documents (applicant or KYC staff)


@router.get("/documents/{doc_id}")
async def download_document(doc_id: str, user: User, db: Db, registry: Registry) -> StreamingResponse:
    app_doc = await db.kyc_applications.find_one({"documents.id": doc_id}, {"address": 1, "documents": 1})
    if app_doc is None or not ObjectId.is_valid(doc_id):
        raise ApiError(404, "no_document", "No such document")
    if app_doc["address"] != user.address and not await has_role_anywhere(registry, user.address, "KYC_ADMIN"):
        raise ApiError(403, "forbidden", "Only the applicant and KYC staff can open this document")
    meta = next(d for d in app_doc["documents"] if d["id"] == doc_id)
    try:
        grid_out = await _bucket(db).open_download_stream(ObjectId(doc_id))
    except NoFile as exc:
        raise ApiError(404, "no_document", "The file is gone") from exc

    async def chunks():
        while True:
            data = await grid_out.readchunk()
            if not data:
                break
            yield data

    return StreamingResponse(
        chunks(),
        media_type=meta["contentType"],
        headers={"Content-Disposition": f'inline; filename="{meta["filename"]}"', "Cache-Control": "private, no-store"},
    )


# ------------------------------------------------------------------ staff review (KYC_ADMIN on any chain)


@router.get("/applications", response_model=KycListOut)
async def list_applications(
    _: KycAdmin, db: Db, registry: Registry,
    status: str = Query("in_review", pattern="^(draft|in_review|approved|rejected|all)$"),
    limit: int = Query(100, ge=1, le=500),
) -> KycListOut:
    query: dict[str, Any] = {} if status == "all" else {"status": status}
    docs = await db.kyc_applications.find(query).sort([("submittedAt", -1), ("updatedAt", -1)]).limit(limit).to_list(None)
    return KycListOut(applications=[await _out(db, registry, d) for d in docs])


@router.get("/applications/{address}", response_model=KycApplicationOut)
async def get_application(address: str, _: KycAdmin, db: Db, registry: Registry) -> KycApplicationOut:
    return await _out(db, registry, await get_application_doc(db, address))


@router.post("/applications/{address}/approve", response_model=KycApplicationOut)
async def approve_application(
    address: str, body: KycApproveIn, staff: KycAdmin, db: Db, registry: Registry, catalog: CatalogDep
) -> KycApplicationOut:
    doc = await get_application_doc(db, address)
    if doc.get("status") != "in_review":
        raise ApiError(409, "not_in_review", "Only applications in review can be approved")
    tier = body.tier or int(doc.get("tier") or catalog.identity_defaults.get("tier", 2))
    days = body.valid_days or int(catalog.identity_defaults.get("validDays", 365))
    now = _now()
    expires_at = (now + timedelta(days=days)).replace(microsecond=0)
    expiry = int(expires_at.timestamp())
    job_ids = {}
    for chain in registry.all():
        job_ids[str(chain.chain_id)] = await jobs.enqueue(
            db, chain.chain_id, "kyc.set_identity",
            {"account": doc["address"], "country": doc["country"], "tier": tier, "expiry": expiry},
            dedupe_key=f"kyc:{chain.chain_id}:{doc['address']}:{expiry}",
        )
    await db.kyc_applications.update_one(
        {"_id": doc["_id"]},
        {"$set": {
            "status": "approved", "approvedTier": tier, "expiresAt": expires_at, "reviewedAt": now,
            "reviewedBy": staff.address, "approval": {"jobs": job_ids}, "updatedAt": now,
        }},
    )
    return await _out(db, registry, await db.kyc_applications.find_one({"_id": doc["_id"]}))


@router.post("/applications/{address}/reject", response_model=KycApplicationOut)
async def reject_application(address: str, body: KycRejectIn, staff: KycAdmin, db: Db, registry: Registry) -> KycApplicationOut:
    doc = await get_application_doc(db, address)
    if doc.get("status") != "in_review":
        raise ApiError(409, "not_in_review", "Only applications in review can be rejected")
    now = _now()
    await db.kyc_applications.update_one(
        {"_id": doc["_id"]},
        {"$set": {"status": "rejected", "rejectReason": body.reason, "reviewedAt": now, "reviewedBy": staff.address, "updatedAt": now}},
    )
    return await _out(db, registry, await db.kyc_applications.find_one({"_id": doc["_id"]}))


async def get_application_doc(db: AsyncDatabase, address: str) -> dict:
    if not is_address(address):
        raise ApiError(422, "bad_address", "Not an EVM address")
    doc = await db.kyc_applications.find_one({"address": to_checksum_address(address)})
    if doc is None:
        raise ApiError(404, "no_application", "No application for that address")
    return doc
