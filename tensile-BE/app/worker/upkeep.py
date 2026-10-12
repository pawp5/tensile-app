"""Keeps the protocol's feeds fresh so nothing goes stale between demo sessions.

- Reserve reports: re-submits each warehouse's latest reserve (co-signed by the two reserve signer
  keys) before ReserveGuard's 24 h staleness limit. The worker never changes a reserve number by
  itself; a different number is only sent through a `reserve.report` job.
- Prices: PRICE_UPDATER heartbeat (`update` with the current answer) before the adapter's 3-day limit.
- Gas: records the service wallet's balance and warns when it runs low.
"""
import asyncio
import logging
import time
from typing import Any

from eth_account import Account
from pymongo.asynchronous.database import AsyncDatabase

from app.core.catalog import Catalog, code_from_meta, region_bytes
from app.core.chains import ChainContext, with_retries
from app.core.config import Settings
from app.core.evm import is_zero_address, to_doc, utcnow
from app.core.txsender import Tx, TxFailed, TxSender


class Upkeep:
    def __init__(self, chain: ChainContext, db: AsyncDatabase, catalog: Catalog, settings: Settings, sender: TxSender, log: logging.Logger) -> None:
        self.chain = chain
        self.db = db
        self.catalog = catalog
        self.settings = settings
        self.sender = sender
        self.log = log
        self._sem = asyncio.Semaphore(4)
        a, b = settings.reserve_signer_a_key, settings.reserve_signer_b_key
        self.keys = (a.get_secret_value(), b.get_secret_value()) if a and b else None
        self.signers = tuple(Account.from_key(k).address for k in self.keys) if self.keys else None
        self._warned: set[str] = set()

    async def read(self, fn: Any) -> Any:
        async with self._sem:
            return await self.chain.call(fn, timeout=20, retries=3)

    async def chain_time(self) -> int:
        block = await with_retries(lambda: self.chain.w3.eth.get_block("latest"))
        return int(block["timestamp"])

    def warn_once(self, key: str, message: str, *args: Any) -> None:
        if key not in self._warned:
            self._warned.add(key)
            self.log.warning(message, *args)

    # ------------------------------------------------------------------ reserve reports

    async def report_tx(self, wid: int, reserve_kg: int | None = None, *, max_age: float | None = None, now: int | None = None) -> Tx | None:
        """A co-signed reserve report for one warehouse, or None if not needed / not possible.

        reserve_kg None means "re-report the latest number". max_age set means "only if older than this".
        """
        if self.keys is None:
            self.warn_once("keys", "RESERVE_SIGNER_A_KEY / RESERVE_SIGNER_B_KEY missing: reserve reports are off")
            return None
        registry, passport = self.chain.contract("WarehouseRegistry"), self.chain.contract("MaterialPassport")
        feed = await self.read(registry.functions.reserveFeedOf(wid))
        if is_zero_address(feed):
            return None
        rf = self.chain.contract_at("TensileReserveFeed", feed)
        (_, answer, _, updated, _), last, outstanding, ws, ins = await asyncio.gather(
            self.read(rf.functions.latestRoundData()),
            self.read(rf.functions.lastObservedAt()),
            self.read(passport.functions.outstandingKg(wid)),
            self.read(rf.functions.warehouseSigner()),
            self.read(rf.functions.inspectorSigner()),
        )
        if (ws, ins) != self.signers:
            self.warn_once(f"signers:{wid}", "warehouse %s: reserve feed signers are not this backend's keys (run scripts/seed.py)", wid)
            return None
        now = now or await self.chain_time()
        if max_age is not None and updated and now - updated < max_age:
            return None
        if reserve_kg is None:
            if answer > 0:
                reserve_kg = int(answer)
            else:  # never reported: start from catalog.json, covering whatever is tokenized
                meta = (await self.read(registry.functions.getWarehouse(wid)))[5]
                info = self.catalog.warehouse(code_from_meta(meta) or "")
                reserve_kg = max(info.reserve_kg if info else 0, int(outstanding) * 11 // 10)
        observed = max(now - 15, int(last) + 1)
        digest = await self.read(rf.functions.reportDigest(reserve_kg, observed))
        sig_a, sig_b = (bytes(Account.unsafe_sign_hash(digest, k).signature) for k in self.keys)
        return Tx(f"reserve report wh {wid}: {reserve_kg:,} kg", rf.functions.submit(reserve_kg, observed, sig_a, sig_b))

    async def reserve_txs(self, now: int) -> list[Tx]:
        count = await self.read(self.chain.contract("WarehouseRegistry").functions.warehouseCount())
        max_age = self.settings.reserve_refresh_hours * 3600
        txs = await asyncio.gather(*(self.report_tx(wid, max_age=max_age, now=now) for wid in range(1, count + 1)))
        return [t for t in txs if t]

    # ------------------------------------------------------------------ price heartbeats

    async def price_txs(self, now: int) -> list[Tx]:
        adapter = self.chain.contract("PriceOracleAdapter")
        max_age = self.settings.price_refresh_hours * 3600

        async def one(material: str, region: str) -> Tx | None:
            feed = await self.read(adapter.functions.feedOf(self.catalog.materials[material].hash, region_bytes(region)))
            if is_zero_address(feed):
                return None
            pf = self.chain.contract_at("TensilePriceFeed", feed)
            (_, answer, _, updated, _), interval = await asyncio.gather(
                self.read(pf.functions.latestRoundData()), self.read(pf.functions.minUpdateInterval())
            )
            if answer <= 0:
                self.warn_once(f"price:{material}:{region}", "%s/%s has no price: a RISK_ADMIN must forceUpdate it (scripts/seed.py)", material, region)
                return None
            if now - updated < max_age or now < updated + interval:
                return None
            return Tx(f"price heartbeat {material}/{region}", pf.functions.update(answer))

        txs = await asyncio.gather(*(one(m, r) for m, r in self.catalog.price_pairs()))
        return [t for t in txs if t]

    # ------------------------------------------------------------------ run

    async def send(self, txs: list[Tx], what: str, errors: list[str]) -> list[str]:
        if not txs:
            return []
        try:
            await self.sender.send(txs)
            return [t.label for t in txs]
        except TxFailed as exc:
            errors.append(f"{what}: {exc}")
            self.log.error("%s failed: %s", what, exc)
            return []

    async def run(self) -> dict[str, Any]:
        started = time.monotonic()
        now = await self.chain_time()
        errors: list[str] = []
        reserve_txs, price_txs = await asyncio.gather(self.reserve_txs(now), self.price_txs(now))
        sent = await self.send(reserve_txs, "reserve reports", errors)
        sent += await self.send(price_txs, "price heartbeats", errors)
        for label in sent:
            self.log.info("upkeep: %s", label)

        balance = await with_retries(lambda: self.chain.w3.eth.get_balance(self.sender.address))
        low = balance < self.settings.low_gas_native * 10**18
        symbol = self.chain.config.native_currency.get("symbol", "")
        if low:
            self.log.warning("service wallet %s is low on gas: %.4f %s", self.sender.address, balance / 1e18, symbol)
        result = {"sent": sent, "errors": errors, "seconds": round(time.monotonic() - started, 1)}
        await self.db.chain_status.update_one(
            {"_id": self.chain.chain_id},
            {"$set": {
                "chainId": self.chain.chain_id,
                "worker.address": self.sender.address,
                "worker.balance": to_doc(int(balance)),
                "worker.balanceNative": balance / 1e18,
                "worker.symbol": symbol,
                "worker.lowGas": low,
                "worker.upkeepAt": utcnow(),
                "worker.lastUpkeep": result,
                "worker.error": "; ".join(errors)[:300] or None,
            }},
            upsert=True,
        )
        return result
