"""Mongo job queue for work that sends transactions from the service wallet.

The API enqueues; the worker that holds a chain's lease runs that chain's jobs one at a time, so
the service wallet's nonces never collide. Handlers must be idempotent (check chain state before
sending): a job whose worker died mid-way is retried.
"""
from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def enqueue(
    db: AsyncDatabase,
    chain_id: int,
    kind: str,
    payload: dict[str, Any] | None = None,
    *,
    dedupe_key: str | None = None,
    delay_seconds: float = 0,
    max_attempts: int = 5,
) -> str:
    """Queue a job and return its id. With dedupe_key, an identical open job is reused instead."""
    now = _now()
    doc = {
        "chainId": chain_id,
        "kind": kind,
        "payload": payload or {},
        "status": "queued",
        "open": True,
        "attempts": 0,
        "maxAttempts": max_attempts,
        "runAt": now + timedelta(seconds=delay_seconds),
        "createdAt": now,
        "updatedAt": now,
    }
    if dedupe_key:
        doc["dedupeKey"] = dedupe_key
    try:
        result = await db.jobs.insert_one(doc)
        return str(result.inserted_id)
    except DuplicateKeyError:
        existing = await db.jobs.find_one({"dedupeKey": dedupe_key, "open": True}, {"_id": 1})
        if existing is None:  # finished between the insert and the lookup: queue a fresh one
            return await enqueue(db, chain_id, kind, payload, dedupe_key=dedupe_key, delay_seconds=delay_seconds, max_attempts=max_attempts)
        return str(existing["_id"])


async def get_job(db: AsyncDatabase, job_id: str) -> dict | None:
    if not ObjectId.is_valid(job_id):
        return None
    return await db.jobs.find_one({"_id": ObjectId(job_id)})


async def claim(db: AsyncDatabase, chain_id: int, owner: str) -> dict | None:
    now = _now()
    return await db.jobs.find_one_and_update(
        {"chainId": chain_id, "status": "queued", "runAt": {"$lte": now}},
        {"$set": {"status": "running", "lockedBy": owner, "startedAt": now, "updatedAt": now}, "$inc": {"attempts": 1}},
        sort=[("runAt", 1)],
        return_document=ReturnDocument.AFTER,
    )


async def complete(db: AsyncDatabase, job: dict, result: dict[str, Any] | None) -> None:
    now = _now()
    await db.jobs.update_one(
        {"_id": job["_id"]},
        {"$set": {"status": "done", "result": result or {}, "error": None, "finishedAt": now, "updatedAt": now}, "$unset": {"open": ""}},
    )


async def fail(db: AsyncDatabase, job: dict, error: str, *, retry: bool = True) -> bool:
    """Record a failure. Retries with back-off until maxAttempts; returns True if it will run again."""
    now = _now()
    again = retry and job.get("attempts", 1) < job.get("maxAttempts", 5)
    if again:
        delay = min(600, 15 * 2 ** (job.get("attempts", 1) - 1))
        update = {"$set": {"status": "queued", "error": error, "runAt": now + timedelta(seconds=delay), "updatedAt": now}}
    else:
        update = {"$set": {"status": "failed", "error": error, "finishedAt": now, "updatedAt": now}, "$unset": {"open": ""}}
    await db.jobs.update_one({"_id": job["_id"]}, update)
    return again


async def requeue_orphans(db: AsyncDatabase, chain_id: int) -> int:
    """Jobs left 'running' by a worker that died. Only call while holding the chain's worker lease."""
    result = await db.jobs.update_many(
        {"chainId": chain_id, "status": "running"},
        {"$set": {"status": "queued", "runAt": _now(), "updatedAt": _now()}},
    )
    return result.modified_count
