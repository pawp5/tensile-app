"""Copies Tensile contract logs into Mongo (`events`) and applies projection handlers.

Ranges are fetched in parallel while catching up but always applied in block order, and the
checkpoint (chain_status.logs.block) only moves after a range is fully stored and applied.
"""
import asyncio
import logging
import time
from typing import Any

from pymongo import UpdateOne
from pymongo.asynchronous.database import AsyncDatabase
from web3.exceptions import Web3RPCError

from app.core.chains import ChainContext, with_retries
from app.core.errors import ApiError
from app.core.evm import is_zero_address, to_doc, ts, utcnow
from app.indexer.handlers import Projector

# Tensile's own contracts (deployment names). Morpho, the IRM and USDC are not indexed.
INDEXED_CONTRACTS = (
    "TensileAccessManager", "IdentityRegistry", "WarehouseRegistry", "AttestationRegistry", "MaterialPassport",
    "MintingController", "RedemptionManager", "ReserveGuard", "PriceOracleAdapter", "MarketRegistry",
    "TensileCreditVault", "CreditRouter", "Marketplace", "FeeCollector", "PriceIndex",
)
# RPC error text that means "ask for fewer blocks"
_TOO_BIG = ("range", "too many", "more than", "limit", "exceed", "results", "response size", "too large")


def _hex(value: Any) -> str:
    return value if isinstance(value, str) else "0x" + bytes(value).hex()


class LogDecoder:
    def __init__(self, chain: ChainContext, log: logging.Logger) -> None:
        self.by_address: dict[str, tuple[str, dict[str, Any]]] = {}  # lower-case address -> (name, topic0 -> event)
        self.addresses: list[str] = []  # checksummed, for eth_getLogs
        for name in INDEXED_CONTRACTS:
            address = chain.config.addresses.get(name)
            if address is None:
                continue
            try:
                contract = chain.contract(name)
            except ApiError:
                log.warning("%s.json is missing from app/abis: its events are not indexed", name)
                continue
            events = {_hex(event.topic).lower(): event for event in contract.all_events()}
            self.by_address[address.lower()] = (name, events)
            self.addresses.append(address)

    def decode(self, chain_id: int, raw: dict[str, Any], log: logging.Logger) -> dict[str, Any] | None:
        entry = self.by_address.get(raw["address"].lower())
        if entry is None or not raw["topics"]:
            return None
        name, events = entry
        event = events.get(_hex(raw["topics"][0]).lower())
        if event is None:
            return None  # an event this ABI does not know (e.g. from a newer contract version)
        try:
            data = event.process_log(raw)
        except Exception as exc:  # ABI does not match the log: keep going, but say so
            log.warning("could not decode %s log at %s/%s: %s", name, raw["blockNumber"], raw["logIndex"], exc)
            return None
        args = to_doc(dict(data["args"]))
        doc: dict[str, Any] = {
            "chainId": chain_id,
            "blockNumber": int(raw["blockNumber"]),
            "logIndex": int(raw["logIndex"]),
            "txHash": _hex(raw["transactionHash"]),
            "address": data["address"],
            "contract": name,
            "event": data["event"],
            "args": args,
            "addresses": sorted({
                args[i["name"]] for i in event.abi["inputs"]
                if i["type"] == "address" and not is_zero_address(args.get(i["name"]))
            }),
        }
        if "tokenId" in args:
            doc["tokenId"] = int(args["tokenId"])
        return doc


class LogSync:
    def __init__(self, chain: ChainContext, db: AsyncDatabase, projector: Projector, parallel: int, log: logging.Logger) -> None:
        self.chain = chain
        self.db = db
        self.projector = projector
        self.parallel = max(1, parallel)
        self.log = log
        self.decoder = LogDecoder(chain, log)
        self.last: int | None = None  # last fully applied block
        self._progress_logged = 0.0

    @property
    def chain_id(self) -> int:
        return self.chain.chain_id

    async def _checkpoint(self) -> int:
        doc = await self.db.chain_status.find_one({"_id": self.chain_id}, {"logs.block": 1})
        block = (doc or {}).get("logs", {}).get("block")
        return int(block) if block is not None else self.chain.config.deploy_block - 1

    async def step(self) -> bool:
        """Index the next few ranges. Returns True while there is more to catch up on."""
        if self.last is None:
            self.last = await self._checkpoint()
            self.log.info("logs: resuming after block %s", self.last)
        head = await with_retries(lambda: self.chain.w3.eth.block_number, retries=3, timeout=20)
        safe = head - self.chain.config.confirmations
        if self.last >= safe:
            await self._save(self.last, head, caught_up=True)
            return False

        size = self.chain.config.logs_block_range
        ranges: list[tuple[int, int]] = []
        start = self.last + 1
        while start <= safe and len(ranges) < self.parallel:
            end = min(start + size - 1, safe)
            ranges.append((start, end))
            start = end + 1

        results = await asyncio.gather(*(self._fetch(a, b) for a, b in ranges), return_exceptions=True)
        for (_, end), logs in zip(ranges, results):
            if isinstance(logs, BaseException):
                raise logs  # earlier ranges are saved; this one is retried next step
            await self._apply(logs)
            self.last = end
            await self._save(end, head, caught_up=end >= safe)
        behind = safe - self.last
        if behind and time.monotonic() - self._progress_logged > 15:
            self._progress_logged = time.monotonic()
            self.log.info("logs: catching up, at block %s, %s blocks to go", self.last, behind)
        elif not behind and self._progress_logged:
            self._progress_logged = 0.0
            self.log.info("logs: caught up at block %s", self.last)
        return behind > 0

    async def _fetch(self, start: int, end: int) -> list[dict]:
        params = {"fromBlock": start, "toBlock": end, "address": self.decoder.addresses}
        try:
            return list(await with_retries(lambda: self.chain.w3.eth.get_logs(params), retries=4, timeout=30))
        except Web3RPCError as exc:
            message = str(exc).lower()
            if end > start and "rate" not in message and any(word in message for word in _TOO_BIG):
                await asyncio.sleep(0.25)
                mid = (start + end) // 2
                return await self._fetch(start, mid) + await self._fetch(mid + 1, end)
            raise

    async def _block_times(self, blocks: list[int], logs: list[dict]) -> dict[int, Any]:
        seconds: dict[int, int] = {}
        for raw in logs:  # many nodes include blockTimestamp in logs; saves a get_block per block
            value = raw.get("blockTimestamp")
            if value is not None:
                seconds[int(raw["blockNumber"])] = int(value, 16) if isinstance(value, str) else int(value)
        sem = asyncio.Semaphore(8)

        async def fetch(block: int) -> tuple[int, int]:
            async with sem:
                header = await with_retries(lambda: self.chain.w3.eth.get_block(block), retries=4)
                return block, int(header["timestamp"])

        missing = [b for b in blocks if b not in seconds]
        seconds.update(dict(await asyncio.gather(*(fetch(b) for b in missing))))
        return {b: ts(seconds[b]) for b in blocks}

    async def _apply(self, logs: list[dict]) -> None:
        events = [e for e in (self.decoder.decode(self.chain_id, raw, self.log) for raw in logs) if e]
        if not events:
            return
        times = await self._block_times(sorted({e["blockNumber"] for e in events}), logs)
        for e in events:
            e["timestamp"] = times[e["blockNumber"]]
        events.sort(key=lambda e: (e["blockNumber"], e["logIndex"]))
        await self.db.events.bulk_write(
            [
                UpdateOne(
                    {"chainId": e["chainId"], "blockNumber": e["blockNumber"], "logIndex": e["logIndex"]},
                    {"$setOnInsert": e},
                    upsert=True,
                )
                for e in events
            ],
            ordered=False,
        )
        for e in events:
            await self.projector.apply(e)

    async def _save(self, block: int, head: int, *, caught_up: bool) -> None:
        await self.db.chain_status.update_one(
            {"_id": self.chain_id},
            {
                "$set": {"chainId": self.chain_id, "logs.head": head, "logs.at": utcnow(), "logs.catchingUp": not caught_up, "logs.error": None},
                "$max": {"logs.block": block},
            },
            upsert=True,
        )
