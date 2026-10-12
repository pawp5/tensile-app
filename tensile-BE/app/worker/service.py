"""Tensile worker: sends transactions from the service wallet (SERVICE_PRIVATE_KEY, else DEPLOYER_PRIVATE_KEY).

Runs inside the API (RUN_WORKER=true) or on its own (python -m app.worker). Per chain, one worker
holds the lease and is the only sender for that wallet, so nonces never collide. It runs upkeep
(reserve reports, price heartbeats), the mint keeper (automated review, custody, expiry) and queued jobs.

Don't run scripts/seed.py while a worker is running: they use the same wallet.
"""
import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from typing import Any

from eth_utils import to_checksum_address
from web3.exceptions import ContractLogicError

from app.core import jobs
from app.core.chains import ChainContext
from app.core.evm import bytes_to_text, utcnow
from app.core.leases import Lease, process_id, run_as_leader
from app.core.process import Runtime
from app.core.txsender import Tx, TxFailed, TxSender, error_selectors
from app.worker import minting
from app.worker.upkeep import Upkeep

JobHandler = Callable[["ChainWorker", dict[str, Any]], Awaitable[dict[str, Any] | None]]
JOB_HANDLERS: dict[str, JobHandler] = {}


def job(kind: str) -> Callable[[JobHandler], JobHandler]:
    def register(fn: JobHandler) -> JobHandler:
        JOB_HANDLERS[kind] = fn
        return fn

    return register


class ChainWorker:
    def __init__(self, rt: Runtime, chain: ChainContext, owner: str) -> None:
        self.rt = rt
        self.chain = chain
        self.owner = owner
        self.log = logging.getLogger(f"tensile.worker.{chain.chain_id}")
        key = rt.settings.service_key
        if key is None:
            raise RuntimeError("SERVICE_PRIVATE_KEY / DEPLOYER_PRIVATE_KEY is missing from backend/.env")
        self.sender = TxSender(chain.w3, key.get_secret_value(), errors=error_selectors(chain.abis))
        self.upkeep = Upkeep(chain, rt.db, rt.catalog, rt.settings, self.sender, self.log)
        self.keeper = minting.keeper_for(chain, rt.db, rt.settings, self.sender)

    async def body(self) -> None:
        self.sender.reset_nonce()  # another process may have used the wallet while we were standing by
        orphans = await jobs.requeue_orphans(self.rt.db, self.chain.chain_id)
        if orphans:
            self.log.info("requeued %d job(s) left running by a previous worker", orphans)
        self.log.info("service wallet %s", self.sender.address)
        next_upkeep = next_keep = 0.0
        while True:
            if time.monotonic() >= next_upkeep:
                await self._upkeep()
                next_upkeep = time.monotonic() + self.rt.settings.upkeep_seconds
            if time.monotonic() >= next_keep:
                await self._keep()
                next_keep = time.monotonic() + self.rt.settings.mint_keeper_seconds
            if not await self._run_one_job():
                await asyncio.sleep(2)

    async def _keep(self) -> None:
        try:
            queued = await self.keeper.run()
            if any(queued.values()):
                self.log.info("mint keeper: %s", queued)
        except Exception as exc:
            self.log.warning("mint keeper: %s: %s", type(exc).__name__, str(exc)[:300])

    async def _upkeep(self) -> None:
        try:
            await self.upkeep.run()
        except Exception as exc:
            self.log.warning("upkeep: %s: %s", type(exc).__name__, str(exc)[:300])
            await self.rt.db.chain_status.update_one(
                {"_id": self.chain.chain_id},
                {"$set": {"worker.error": f"{type(exc).__name__}: {exc}"[:300], "worker.errorAt": utcnow()}},
                upsert=True,
            )

    async def _run_one_job(self) -> bool:
        claimed = await jobs.claim(self.rt.db, self.chain.chain_id, self.owner)
        if claimed is None:
            return False
        handler = JOB_HANDLERS.get(claimed["kind"])
        if handler is None:
            await jobs.fail(self.rt.db, claimed, f"unknown job kind {claimed['kind']!r}", retry=False)
            return True
        self.log.info("job %s %s (attempt %s)", claimed["_id"], claimed["kind"], claimed["attempts"])
        try:
            result = await handler(self, claimed["payload"])
        except (TxFailed, ContractLogicError) as exc:  # the chain refused it: retrying will not help
            self.log.warning("job %s failed: %s", claimed["_id"], exc)
            await jobs.fail(self.rt.db, claimed, f"{type(exc).__name__}: {exc}"[:500], retry=False)
        except Exception as exc:
            again = await jobs.fail(self.rt.db, claimed, f"{type(exc).__name__}: {exc}"[:500])
            self.log.warning("job %s: %s: %s%s", claimed["_id"], type(exc).__name__, str(exc)[:200], " (will retry)" if again else "")
        else:
            await jobs.complete(self.rt.db, claimed, result)
        return True


# ------------------------------------------------------------------ job handlers (later stages add theirs here)


@job("upkeep")
async def run_upkeep(w: ChainWorker, payload: dict) -> dict:
    return await w.upkeep.run()


@job("reserve.report")
async def reserve_report(w: ChainWorker, payload: dict) -> dict:
    """payload: {"warehouseId": 2, "reserveKg": 520000}   (reserveKg optional: re-report the latest)"""
    wid = int(payload["warehouseId"])
    reserve = payload.get("reserveKg")
    tx = await w.upkeep.report_tx(wid, int(reserve) if reserve is not None else None)
    if tx is None:
        return {"sent": False, "reason": "no reserve feed, or its signers are not this backend's keys"}
    receipt = (await w.sender.send([tx]))[0]
    return {"sent": True, "txHash": "0x" + bytes(receipt["transactionHash"]).hex(), "block": receipt["blockNumber"]}


@job("kyc.set_identity")
async def kyc_set_identity(w: ChainWorker, payload: dict) -> dict:
    """payload: {"account", "country": "NG", "tier": 2, "expiry": unix seconds}. Skips if the chain already says so."""
    account = to_checksum_address(payload["account"])
    country, tier, expiry = str(payload["country"]), int(payload["tier"]), int(payload["expiry"])
    identity = w.chain.contract("IdentityRegistry")
    _, cur_country, cur_tier, cur_expiry = await w.chain.call(identity.functions.identityOf(account), timeout=20, retries=3)
    if bytes_to_text(cur_country) == country and int(cur_tier) == tier and int(cur_expiry) >= expiry:
        return {"sent": False, "reason": "identity already set"}
    tx = Tx(f"KYC {account[:6]}…{account[-4:]} tier {tier}", identity.functions.setIdentity(account, country.encode(), tier, expiry))
    receipt = (await w.sender.send([tx]))[0]
    return {"sent": True, "txHash": "0x" + bytes(receipt["transactionHash"]).hex(), "block": receipt["blockNumber"]}


JOB_HANDLERS.update(minting.JOBS)  # mint.review, mint.custody, mint.expire (Stage 4)


# ------------------------------------------------------------------ entry points


async def serve(rt: Runtime, chains: list[ChainContext]) -> None:
    """Run every chain's worker until cancelled (each under its own lease)."""
    log = logging.getLogger("tensile.worker")
    if rt.settings.service_key is None:
        log.error("worker not started: SERVICE_PRIVATE_KEY / DEPLOYER_PRIVATE_KEY is missing from backend/.env")
        return
    owner = process_id("worker")
    workers = [ChainWorker(rt, chain, owner) for chain in chains]
    await asyncio.gather(*(
        run_as_leader(Lease(rt.db, f"worker:{w.chain.chain_id}", owner), w.body, w.log) for w in workers
    ))


async def upkeep_once(rt: Runtime, chains: list[ChainContext]) -> None:
    """One upkeep pass per chain (needs the chain's worker lease, so stop running workers first)."""
    owner = process_id("worker-once")
    for chain in chains:
        w = ChainWorker(rt, chain, owner)
        lease = Lease(rt.db, f"worker:{chain.chain_id}", owner, ttl=600)
        if not await lease.acquire():
            raise SystemExit(f"a worker for chain {chain.chain_id} is running (API with RUN_WORKER=true, or python -m app.worker): stop it first")
        try:
            w.log.info("upkeep: %s", await w.upkeep.run())
        finally:
            await lease.release()
