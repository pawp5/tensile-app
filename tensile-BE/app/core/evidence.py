"""Evidence files and attested reports.

Files (mint evidence, inspection photos) live in the GridFS bucket "evidence". A report is the JSON body an
attestation commits to: its keccak256 is the on-chain dataHash and `tensile://reports/<id>` the uri, so
anyone can fetch /v1/reports/<id> and check the hash. A mint draft's evidence bundle is
`tensile://evidence/<draftId>`, which is what goes into MintingController.requestMint as evidenceURI.
"""
import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from eth_utils import keccak
from fastapi import UploadFile
from fastapi.responses import StreamingResponse
from gridfs import AsyncGridFSBucket
from gridfs.errors import NoFile
from pymongo.asynchronous.database import AsyncDatabase

from app.core.errors import ApiError
from app.core.schemas import EvidenceFileOut

BUCKET = "evidence"
MAX_FILE_BYTES = 25 * 1024 * 1024
EVIDENCE_PREFIX = "tensile://evidence/"
REPORT_PREFIX = "tensile://reports/"
_MAGIC = ((b"%PDF", "application/pdf"), (b"\x89PNG", "image/png"), (b"\xff\xd8\xff", "image/jpeg"))


def now() -> datetime:
    return datetime.now(timezone.utc)


def bucket(db: AsyncDatabase) -> AsyncGridFSBucket:
    return AsyncGridFSBucket(db, bucket_name=BUCKET)


def sniff(head: bytes) -> str | None:
    return next((ctype for magic, ctype in _MAGIC if head.startswith(magic)), None)


def oid(value: str, what: str = "id") -> ObjectId:
    if not ObjectId.is_valid(value):
        raise ApiError(404, "not_found", f"Unknown {what}")
    return ObjectId(value)


# ------------------------------------------------------------------ hashes and uris


def canonical(body: dict[str, Any]) -> bytes:
    """Stable JSON bytes: sorted keys, no whitespace, datetimes as ISO strings."""
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=_json_default).encode()


def _json_default(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    if isinstance(value, ObjectId):
        return str(value)
    raise TypeError(f"{type(value).__name__} is not JSON serialisable")


def normalise(body: dict[str, Any]) -> dict[str, Any]:
    """Plain JSON values only (datetimes -> ISO strings), so what Mongo stores hashes the same when read back."""
    return json.loads(canonical(body))


def data_hash(body: dict[str, Any]) -> str:
    return "0x" + keccak(canonical(body)).hex()


def normalise_certificate(certificate_id: str) -> str:
    return " ".join(certificate_id.split()).upper()


def cert_hash(certificate_id: str) -> str:
    """bytes32 for MintingController: one certificate identifier can back one lot, on every network."""
    return "0x" + keccak(text=f"tensile:certificate:{normalise_certificate(certificate_id)}").hex()


def evidence_uri(draft_id: str) -> str:
    return EVIDENCE_PREFIX + draft_id


def draft_id_from_uri(uri: str | None) -> str | None:
    if uri and uri.startswith(EVIDENCE_PREFIX):
        rest = uri[len(EVIDENCE_PREFIX):]
        return rest if ObjectId.is_valid(rest) else None
    return None


def report_uri(report_id: str) -> str:
    return REPORT_PREFIX + report_id


# ------------------------------------------------------------------ files


def file_out(entry: dict[str, Any]) -> EvidenceFileOut:
    return EvidenceFileOut(
        id=entry["id"], kind=entry["kind"], filename=entry["filename"], content_type=entry["contentType"],
        size=entry["size"], sha256=entry["sha256"], uploaded_at=entry["uploadedAt"],
    )


async def store_upload(db: AsyncDatabase, upload: UploadFile, *, kind: str, metadata: dict[str, Any]) -> dict[str, Any]:
    """Stream an upload into GridFS (PDF/PNG/JPEG only). Returns the entry kept on the draft or report."""
    head = await upload.read(8)
    content_type = sniff(head)
    if content_type is None:
        raise ApiError(415, "unsupported_file", "Upload a PDF, PNG or JPEG file")
    default = f"{kind}.{content_type.split('/')[-1]}"
    filename = os.path.basename(upload.filename or default).strip()[:120] or default

    grid_in = bucket(db).open_upload_stream(filename, metadata={**metadata, "kind": kind, "contentType": content_type})
    sha, size, chunk = hashlib.sha256(), 0, head
    try:
        while chunk:
            size += len(chunk)
            if size > MAX_FILE_BYTES:
                raise ApiError(413, "file_too_large", f"Files can be up to {MAX_FILE_BYTES // (1024 * 1024)} MB")
            sha.update(chunk)
            await grid_in.write(chunk)
            chunk = await upload.read(256 * 1024)
        await grid_in.close()
    except BaseException:
        await grid_in.abort()
        raise
    digest = sha.hexdigest()
    await db[f"{BUCKET}.files"].update_one({"_id": grid_in._id}, {"$set": {"metadata.sha256": digest}})
    return {
        "id": str(grid_in._id), "kind": kind, "filename": filename, "contentType": content_type,
        "size": size, "sha256": digest, "uploadedAt": now(),
    }


async def file_meta(db: AsyncDatabase, file_id: str) -> dict[str, Any]:
    """The GridFS file document (metadata: chainId, uploader, scope draft|report, ref, kind, contentType)."""
    doc = await db[f"{BUCKET}.files"].find_one({"_id": oid(file_id, "file")})
    if doc is None:
        raise ApiError(404, "no_file", "No such file")
    return doc


async def stream_file(db: AsyncDatabase, doc: dict[str, Any]) -> StreamingResponse:
    try:
        grid_out = await bucket(db).open_download_stream(doc["_id"])
    except NoFile as exc:
        raise ApiError(404, "no_file", "The file is gone") from exc

    async def chunks():
        while True:
            data = await grid_out.readchunk()
            if not data:
                break
            yield data

    meta = doc.get("metadata") or {}
    return StreamingResponse(
        chunks(),
        media_type=meta.get("contentType", "application/octet-stream"),
        headers={"Content-Disposition": f'inline; filename="{doc.get("filename", "file")}"', "Cache-Control": "private, no-store"},
    )


async def read_file(db: AsyncDatabase, file_id: str, limit: int = MAX_FILE_BYTES) -> bytes:
    stream = await bucket(db).open_download_stream(oid(file_id, "file"))
    return await stream.read(limit)


async def delete_files(db: AsyncDatabase, file_ids: list[str]) -> None:
    b = bucket(db)
    for fid in file_ids:
        if ObjectId.is_valid(fid):
            try:
                await b.delete(ObjectId(fid))
            except Exception:  # already gone
                pass
