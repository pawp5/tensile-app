"""Leader election in Mongo, so only one indexer / worker acts per chain.

Run as many copies of a process as you like: one holds the lease and works, the others wait and
take over within `ttl` seconds if it dies. A lease is released on clean shutdown (Ctrl+C).
"""
import asyncio
import logging
import os
import socket
import uuid
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone

from pymongo import ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError, PyMongoError


def process_id(kind: str) -> str:
    return f"{kind}@{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:6]}"


class Lease:
    def __init__(self, db: AsyncDatabase, name: str, owner: str, ttl: float = 45.0) -> None:
        self.db = db
        self.name = name
        self.owner = owner
        self.ttl = ttl
        self.expires_at: datetime | None = None

    async def acquire(self) -> bool:
        """Take or renew the lease. False if another live process holds it."""
        now = datetime.now(timezone.utc)
        expires = now + timedelta(seconds=self.ttl)
        try:
            await self.db.leases.find_one_and_update(
                {"_id": self.name, "$or": [{"owner": self.owner}, {"expiresAt": {"$lt": now}}]},
                {"$set": {"owner": self.owner, "expiresAt": expires, "renewedAt": now}},
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:  # the document exists and someone else's lease is still valid
            return False
        self.expires_at = expires
        return True

    async def release(self) -> None:
        try:
            await self.db.leases.delete_one({"_id": self.name, "owner": self.owner})
        except PyMongoError:
            pass
        self.expires_at = None

    async def keepalive(self) -> None:
        """Renew every ttl/3. Returns once the lease is lost (taken over, or Mongo unreachable too long)."""
        while True:
            await asyncio.sleep(self.ttl / 3)
            try:
                if not await asyncio.wait_for(self.acquire(), self.ttl / 3):
                    return
            except (PyMongoError, TimeoutError):
                if self.expires_at is None or datetime.now(timezone.utc) >= self.expires_at:
                    return


async def run_as_leader(lease: Lease, body: Callable[[], Awaitable[None]], log: logging.Logger, standby_seconds: float = 15.0) -> None:
    """Forever: wait for the lease, then run body() while holding it. body() is cancelled if the lease is lost."""
    waiting_logged = False
    try:
        while True:
            try:
                got = await lease.acquire()
            except PyMongoError as exc:
                log.warning("%s: mongo unavailable (%s)", lease.name, type(exc).__name__)
                got = False
            if not got:
                if not waiting_logged:
                    log.info("%s: another process is active; standing by", lease.name)
                    waiting_logged = True
                await asyncio.sleep(standby_seconds)
                continue
            waiting_logged = False
            log.info("%s: active", lease.name)
            work = asyncio.create_task(body(), name=f"{lease.name}:body")
            keep = asyncio.create_task(lease.keepalive(), name=f"{lease.name}:keepalive")
            try:
                done, _ = await asyncio.wait({work, keep}, return_when=asyncio.FIRST_COMPLETED)
            finally:
                for task in (work, keep):
                    task.cancel()
                await asyncio.gather(work, keep, return_exceptions=True)
            if work in done and not work.cancelled() and work.exception():
                log.error("%s: stopped with an error", lease.name, exc_info=work.exception())
                await asyncio.sleep(5)
            elif keep in done:
                log.warning("%s: lease lost; standing by", lease.name)
    finally:
        await lease.release()
