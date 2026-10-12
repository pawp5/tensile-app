"""Tensile indexer: chain events and state -> Mongo.

Runs inside the API (RUN_INDEXER=true) or on its own (python -m app.indexer). Either way there is
one lease per chain, so any number of copies is safe: one indexes, the rest stand by.
"""
import asyncio
import logging

from app.core.chains import ChainContext
from app.core.evm import utcnow
from app.core.leases import Lease, process_id, run_as_leader
from app.core.process import Runtime
from app.indexer.handlers import PROJECTIONS, Projector
from app.indexer.logs import LogSync
from app.indexer.snapshots import Snapshotter


class ChainIndexer:
    def __init__(self, rt: Runtime, chain: ChainContext) -> None:
        self.rt = rt
        self.chain = chain
        self.log = logging.getLogger(f"tensile.indexer.{chain.chain_id}")
        self.wake = asyncio.Event()

    async def body(self) -> None:
        # fresh state each time this process becomes the leader
        projector = Projector(self.rt.db, self.chain.chain_id, self.rt.catalog)
        logs = LogSync(self.chain, self.rt.db, projector, self.rt.settings.indexer_parallel_ranges, self.log)
        snap = Snapshotter(self.chain, self.rt.db, self.rt.catalog, self.log)
        await asyncio.gather(self._log_loop(logs, projector), self._snapshot_loop(snap))

    async def _log_loop(self, logs: LogSync, projector: Projector) -> None:
        backoff = 2.0
        while True:
            try:
                more = await logs.step()
                backoff = 2.0
            except Exception as exc:
                self.log.warning("logs: %s: %s (retrying in %.0fs)", type(exc).__name__, str(exc)[:300], backoff)
                await self._error("logs", exc)
                await asyncio.sleep(backoff)
                backoff = min(60.0, backoff * 2)
                continue
            if projector.snapshot_due:
                projector.snapshot_due = False
                self.wake.set()
            if not more:
                await asyncio.sleep(self.rt.settings.indexer_poll_seconds)

    async def _snapshot_loop(self, snap: Snapshotter) -> None:
        while True:
            try:
                await snap.run()
            except Exception as exc:  # e.g. Mongo down; per-part chain errors are recorded by run()
                self.log.warning("snapshot: %s: %s", type(exc).__name__, str(exc)[:300])
            self.wake.clear()
            try:
                await asyncio.wait_for(self.wake.wait(), self.rt.settings.snapshot_seconds)
                await asyncio.sleep(3)  # an event woke us: let the rest of its block land first
            except TimeoutError:
                pass

    async def _error(self, part: str, exc: Exception) -> None:
        try:
            await self.rt.db.chain_status.update_one(
                {"_id": self.chain.chain_id},
                {"$set": {f"{part}.error": f"{type(exc).__name__}: {exc}"[:300], f"{part}.errorAt": utcnow()}},
                upsert=True,
            )
        except Exception:
            pass


async def rebuild(rt: Runtime, chain: ChainContext) -> None:
    log = logging.getLogger(f"tensile.indexer.{chain.chain_id}")
    lease = Lease(rt.db, f"indexer:{chain.chain_id}", process_id("rebuild"), ttl=600)
    if not await lease.acquire():
        raise SystemExit(f"the indexer for chain {chain.chain_id} is running: stop it first (or wait ~45 s after stopping it)")
    try:
        for name in PROJECTIONS:
            await rt.db[name].delete_many({"chainId": chain.chain_id})
        projector = Projector(rt.db, chain.chain_id, rt.catalog)
        count = 0
        async for ev in rt.db.events.find({"chainId": chain.chain_id}).sort([("blockNumber", 1), ("logIndex", 1)]):
            await projector.apply(ev)
            count += 1
        log.info("replayed %d events into %s", count, ", ".join(PROJECTIONS))
    finally:
        await lease.release()


async def serve(rt: Runtime, chains: list[ChainContext]) -> None:
    """Index every chain until cancelled (each chain independently, under its own lease)."""
    owner = process_id("indexer")
    for chain in chains:
        cfg = chain.config
        logging.getLogger("tensile.indexer").info(
            "chain %s (%s): from block %s, %s blocks per request, %s confirmations",
            cfg.chain_id, cfg.name, cfg.deploy_block, cfg.logs_block_range, cfg.confirmations,
        )
    await asyncio.gather(*(
        run_as_leader(
            Lease(rt.db, f"indexer:{chain.chain_id}", owner),
            ChainIndexer(rt, chain).body,
            logging.getLogger(f"tensile.indexer.{chain.chain_id}"),
        )
        for chain in chains
    ))