"""Periodic reads of small, enumerable chain state into Mongo:

- warehouses: registry row + catalog.json details + reserve, outstanding kg and health
- prices:     every catalog (material, region) feed, with haircut and staleness
- vault:      credit vault totals
- history:    new reserve / price rounds (feeds number their rounds, so nothing is missed)
"""
import asyncio
import logging
from typing import Any

from pymongo import UpdateOne
from pymongo.asynchronous.database import AsyncDatabase

from app.core.catalog import Catalog, code_from_meta, region_bytes, region_str
from app.core.chains import ChainContext
from app.core.evm import as_int, bytes_to_text, is_zero_address, to_doc, ts, utcnow

HISTORY_BACKFILL = 50  # rounds fetched for a feed seen for the first time


class Snapshotter:
    def __init__(self, chain: ChainContext, db: AsyncDatabase, catalog: Catalog, log: logging.Logger) -> None:
        self.chain = chain
        self.db = db
        self.catalog = catalog
        self.log = log
        self._sem = asyncio.Semaphore(4)  # public RPCs rate-limit

    @property
    def chain_id(self) -> int:
        return self.chain.chain_id

    async def read(self, fn: Any) -> Any:
        async with self._sem:
            return await self.chain.call(fn, timeout=20, retries=3)

    async def run(self) -> None:
        parts = {"warehouses": self.warehouses, "prices": self.prices, "vault": self.vault}
        results = await asyncio.gather(*(fn() for fn in parts.values()), return_exceptions=True)
        errors = [f"{name}: {type(r).__name__}: {r}"[:300] for name, r in zip(parts, results) if isinstance(r, BaseException)]
        for message in errors:
            self.log.warning("snapshot %s", message)
        await self.db.chain_status.update_one(
            {"_id": self.chain_id},
            {"$set": {"chainId": self.chain_id, "snapshot.at": utcnow(), "snapshot.error": "; ".join(errors) or None}},
            upsert=True,
        )

    # ------------------------------------------------------------------ warehouses

    async def warehouses(self) -> None:
        c = self.chain.contract
        registry, guard, passport = c("WarehouseRegistry"), c("ReserveGuard"), c("MaterialPassport")
        count = await self.read(registry.functions.warehouseCount())
        ids = list(range(1, count + 1))
        rows = await asyncio.gather(*(self.read(registry.functions.getWarehouse(i)) for i in ids))

        async def live(wid: int, feed: str) -> tuple:
            (reserve, fresh), healthy, outstanding = await asyncio.gather(
                self.read(guard.functions.reserveOf(wid)),
                self.read(guard.functions.isHealthy(wid)),
                self.read(passport.functions.outstandingKg(wid)),
            )
            round_id, updated = 0, 0
            if not is_zero_address(feed):
                round_id, _answer, _, updated, _ = await self.read(self.chain.contract_at("TensileReserveFeed", feed).functions.latestRoundData())
            return reserve, fresh, healthy, outstanding, round_id, updated

        lives = await asyncio.gather(*(live(wid, row[2]) for wid, row in zip(ids, rows)))
        now = utcnow()
        for wid, row, (reserve, fresh, healthy, outstanding, round_id, updated) in zip(ids, rows, lives):
            operator, region, feed, active, frozen, meta = row
            code = code_from_meta(meta)
            info = self.catalog.warehouse(code) if code else None
            doc = {
                "code": code,
                "name": info.name if info else f"Warehouse {wid}",
                "operatorName": info.operator if info else None,
                "country": info.country if info else None,
                "place": info.place if info else None,
                "lat": info.lat if info else None,
                "lon": info.lon if info else None,
                "materials": list(info.materials) if info else [],
                "region": region_str(region),
                "operator": operator,
                "reserveFeed": None if is_zero_address(feed) else feed,
                "metaURI": meta,
                "active": bool(active),
                "frozen": bool(frozen),
                "frozenReason": await self._frozen_reason(wid) if frozen else None,
                "reserveKg": to_doc(int(reserve)),
                "fresh": bool(fresh),
                "healthy": bool(healthy),
                "outstandingKg": to_doc(int(outstanding)),
                "reserveRound": int(round_id),
                "reportedAt": ts(updated),
                "snapshotAt": now,
            }
            await self.db.warehouses.update_one(
                {"chainId": self.chain_id, "warehouseId": wid}, {"$set": doc}, upsert=True
            )
            if round_id:
                feed_contract = self.chain.contract_at("TensileReserveFeed", feed)
                await self._history(
                    "reserve_history", {"chainId": self.chain_id, "warehouseId": wid}, feed_contract, int(round_id),
                    lambda r: {"reserveKg": to_doc(int(r[1])), "observedAt": ts(r[3])},
                )

    async def _frozen_reason(self, wid: int) -> str | None:
        ev = await self.db.events.find_one(
            {"chainId": self.chain_id, "contract": "WarehouseRegistry", "event": "WarehouseFrozen", "args.id": wid},
            sort=[("blockNumber", -1), ("logIndex", -1)],
        )
        return bytes_to_text(ev["args"]["reason"]) if ev else None

    # ------------------------------------------------------------------ prices

    async def prices(self) -> None:
        adapter = self.chain.contract("PriceOracleAdapter")
        max_age = await self.read(adapter.functions.maxPriceStaleness())

        async def one(material: str, region: str) -> tuple:
            m, r = self.catalog.materials[material].hash, region_bytes(region)
            feed, haircut = await asyncio.gather(self.read(adapter.functions.feedOf(m, r)), self.read(adapter.functions.haircutBps(r)))
            if is_zero_address(feed):
                return material, region, None, haircut, (0, 0, 0)
            round_id, answer, _, updated, _ = await self.read(self.chain.contract_at("TensilePriceFeed", feed).functions.latestRoundData())
            return material, region, feed, haircut, (round_id, answer, updated)

        rows = await asyncio.gather(*(one(m, r) for m, r in self.catalog.price_pairs()))
        now = utcnow()
        for material, region, feed, haircut, (round_id, answer, updated) in rows:
            info = self.catalog.materials[material]
            await self.db.prices.update_one(
                {"chainId": self.chain_id, "material": material, "region": region},
                {"$set": {
                    "materialName": info.name,
                    "symbol": info.symbol,
                    "feed": feed,
                    "price8": to_doc(int(answer)),
                    "priceUsdPerTonne": int(answer) / 1e8 if answer > 0 else None,
                    "roundId": int(round_id),
                    "updatedAt": ts(updated),
                    "haircutBps": int(haircut),
                    "stale": not feed or not updated or now.timestamp() - updated > max_age,
                    "snapshotAt": now,
                }},
                upsert=True,
            )
            if feed and round_id:
                await self._history(
                    "price_history", {"chainId": self.chain_id, "material": material, "region": region},
                    self.chain.contract_at("TensilePriceFeed", feed), int(round_id),
                    lambda r: {"price8": to_doc(int(r[1])), "priceUsdPerTonne": int(r[1]) / 1e8, "at": ts(r[3])},
                )

    # ------------------------------------------------------------------ vault

    async def vault(self) -> None:
        vault, usdc = self.chain.contract("TensileCreditVault"), self.chain.contract("USDC")
        total, supplied, shares, decimals = await asyncio.gather(
            self.read(vault.functions.totalAssets()),
            self.read(vault.functions.totalSuppliedAssets()),
            self.read(vault.functions.totalSupply()),
            self.read(usdc.functions.decimals()),
        )
        await self.db.chain_status.update_one(
            {"_id": self.chain_id},
            {"$set": {"vault": {
                "totalAssets": to_doc(int(total)),
                "supplied": to_doc(int(supplied)),
                "idle": to_doc(int(total) - int(supplied)),
                "shares": to_doc(int(shares)),
                "decimals": int(decimals),
                "at": utcnow(),
            }}},
            upsert=True,
        )

    # ------------------------------------------------------------------ feed rounds

    async def _history(self, collection: str, key: dict, feed: Any, latest: int, fields: Any) -> None:
        """Store rounds we have not seen yet (feeds number rounds 1..latest)."""
        last = await self.db[collection].find_one(key, {"roundId": 1}, sort=[("roundId", -1)])
        start = max(as_int(last["roundId"]) + 1 if last else 1, latest - HISTORY_BACKFILL + 1)
        if start > latest:
            return
        rounds = await asyncio.gather(*(self.read(feed.functions.getRoundData(r)) for r in range(start, latest + 1)))
        await self.db[collection].bulk_write(
            [UpdateOne({**key, "roundId": int(r[0])}, {"$setOnInsert": fields(r)}, upsert=True) for r in rounds],
            ordered=False,
        )
