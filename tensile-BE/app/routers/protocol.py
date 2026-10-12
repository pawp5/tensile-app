"""Read-only protocol data. Served from Mongo (kept fresh by python -m app.indexer), never from the RPC,
so these stay fast and work for every chain regardless of RPC rate limits."""
import asyncio
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Path, Query, Response

from app.core.catalog import Catalog
from app.core.deps import CatalogDep, Chain, Db
from app.core.errors import ApiError
from app.core.evm import as_int, utcnow
from app.core.schemas import (
    MaterialRef, PriceHistoryOut, PriceOut, PricePoint, PricesOut, ProtocolStatsOut, ReservePoint, SyncOut,
    VaultStats, WarehouseDetailOut, WarehouseOut, WarehousesOut,
)

router = APIRouter(tags=["protocol"])
LIVE_LOTS = ("FREE", "REDEEMING")


def _cache(response: Response, seconds: int = 5) -> None:
    response.headers["Cache-Control"] = f"public, max-age={seconds}"


def _latest(*values: datetime | None) -> datetime | None:
    return max((v for v in values if v is not None), default=None)


def _warehouse(doc: dict[str, Any], catalog: Catalog) -> WarehouseOut:
    reserve, outstanding = as_int(doc.get("reserveKg")), as_int(doc.get("outstandingKg"))
    materials = [catalog.materials[c] for c in doc.get("materials", []) if c in catalog.materials]
    return WarehouseOut(
        warehouse_id=doc["warehouseId"],
        code=doc.get("code"),
        name=doc.get("name") or f"Warehouse {doc['warehouseId']}",
        operator_name=doc.get("operatorName"),
        operator=doc.get("operator", ""),
        region=doc.get("region", ""),
        country=doc.get("country"),
        place=doc.get("place"),
        lat=doc.get("lat"),
        lon=doc.get("lon"),
        materials=[MaterialRef(code=m.code, name=m.name, symbol=m.symbol) for m in materials],
        reserve_feed=doc.get("reserveFeed"),
        active=bool(doc.get("active")),
        frozen=bool(doc.get("frozen")),
        frozen_reason=doc.get("frozenReason"),
        healthy=bool(doc.get("healthy")),
        fresh=bool(doc.get("fresh")),
        reserve_kg=reserve,
        outstanding_kg=outstanding,
        coverage=round(reserve / outstanding, 4) if outstanding else None,
        reported_at=doc.get("reportedAt"),
        updated_at=doc.get("snapshotAt"),
    )


def _price(doc: dict[str, Any]) -> PriceOut:
    return PriceOut(
        material=doc["material"],
        material_name=doc.get("materialName"),
        symbol=doc.get("symbol"),
        region=doc["region"],
        feed=doc.get("feed"),
        price_usd_per_tonne=doc.get("priceUsdPerTonne"),
        haircut_bps=doc.get("haircutBps", 0),
        round_id=doc.get("roundId", 0),
        updated_at=doc.get("updatedAt"),
        stale=bool(doc.get("stale", True)),
    )


# ------------------------------------------------------------------ warehouses


@router.get("/chains/{chain_id}/warehouses", response_model=WarehousesOut)
async def list_warehouses(chain: Chain, db: Db, catalog: CatalogDep, response: Response) -> WarehousesOut:
    docs = await db.warehouses.find({"chainId": chain.chain_id}).sort("warehouseId", 1).to_list(None)
    _cache(response)
    return WarehousesOut(
        chain_id=chain.chain_id,
        warehouses=[_warehouse(d, catalog) for d in docs],
        updated_at=_latest(*(d.get("snapshotAt") for d in docs)),
    )


@router.get("/chains/{chain_id}/warehouses/{warehouse_id}", response_model=WarehouseDetailOut)
async def get_warehouse(
    chain: Chain,
    db: Db,
    catalog: CatalogDep,
    response: Response,
    warehouse_id: int = Path(ge=1),
    history: int = Query(30, ge=0, le=500, description="reserve reports to include, newest last"),
) -> WarehouseDetailOut:
    key = {"chainId": chain.chain_id, "warehouseId": warehouse_id}

    async def reports() -> list[dict]:
        if not history:  # limit(0) would mean "no limit"
            return []
        return await db.reserve_history.find(key).sort("roundId", -1).limit(history).to_list(None)

    doc, rows = await asyncio.gather(db.warehouses.find_one(key), reports())
    if doc is None:
        raise ApiError(404, "warehouse_not_found", f"No warehouse {warehouse_id} on chain {chain.chain_id}")
    _cache(response)
    return WarehouseDetailOut(
        **_warehouse(doc, catalog).model_dump(),
        reserve_history=[
            ReservePoint(round_id=r["roundId"], reserve_kg=as_int(r.get("reserveKg")), observed_at=r.get("observedAt"))
            for r in reversed(rows)
        ],
    )


# ------------------------------------------------------------------ prices


@router.get("/chains/{chain_id}/prices", response_model=PricesOut)
async def list_prices(chain: Chain, db: Db, response: Response) -> PricesOut:
    docs = await db.prices.find({"chainId": chain.chain_id}).sort([("material", 1), ("region", 1)]).to_list(None)
    _cache(response)
    return PricesOut(chain_id=chain.chain_id, prices=[_price(d) for d in docs], updated_at=_latest(*(d.get("snapshotAt") for d in docs)))


@router.get("/chains/{chain_id}/prices/{material}/{region}/history", response_model=PriceHistoryOut)
async def price_history(
    chain: Chain, db: Db, response: Response, material: str, region: str, limit: int = Query(200, ge=1, le=2000)
) -> PriceHistoryOut:
    rows = await (
        db.price_history.find({"chainId": chain.chain_id, "material": material, "region": region})
        .sort("roundId", -1)
        .limit(limit)
        .to_list(None)
    )
    _cache(response, 30)
    return PriceHistoryOut(
        chain_id=chain.chain_id,
        material=material,
        region=region,
        points=[PricePoint(round_id=r["roundId"], price_usd_per_tonne=r["priceUsdPerTonne"], at=r.get("at")) for r in reversed(rows)],
    )


# ------------------------------------------------------------------ stats + sync


async def _lot_groups(db: Any, chain_id: int) -> list[dict]:
    cursor = await db.lots.aggregate([
        {"$match": {"chainId": chain_id, "state": {"$in": list(LIVE_LOTS)}}},
        {"$group": {"_id": {"material": "$material", "warehouseId": "$warehouseId"}, "kg": {"$sum": "$quantityKg"}, "lots": {"$sum": 1}}},
    ])
    return await cursor.to_list(None)


@router.get("/chains/{chain_id}/protocol/stats", response_model=ProtocolStatsOut)
async def protocol_stats(chain: Chain, db: Db, response: Response) -> ProtocolStatsOut:
    cid = chain.chain_id
    warehouses, prices, status, minted, groups = await asyncio.gather(
        db.warehouses.find({"chainId": cid}).to_list(None),
        db.prices.find({"chainId": cid}).to_list(None),
        db.chain_status.find_one({"_id": cid}),
        db.lots.count_documents({"chainId": cid}),
        _lot_groups(db, cid),
    )
    region_of = {w["warehouseId"]: w.get("region") for w in warehouses}
    price_of = {(p["material"], p["region"]): p.get("priceUsdPerTonne") or 0.0 for p in prices}
    value = sum(
        as_int(g["kg"]) / 1000 * price_of.get((g["_id"].get("material"), region_of.get(g["_id"].get("warehouseId"))), 0.0)
        for g in groups
    )

    vault = None
    v = (status or {}).get("vault")
    if v:
        scale = 10 ** v.get("decimals", 6)
        total, supplied = as_int(v.get("totalAssets")) / scale, as_int(v.get("supplied")) / scale
        vault = VaultStats(
            total_assets_usdc=total,
            deployed_usdc=supplied,
            idle_usdc=as_int(v.get("idle")) / scale,
            utilization=round(supplied / total, 6) if total else 0.0,
            updated_at=v.get("at"),
        )

    _cache(response)
    return ProtocolStatsOut(
        chain_id=cid,
        warehouses=len(warehouses),
        active_warehouses=sum(1 for w in warehouses if w.get("active")),
        healthy_warehouses=sum(1 for w in warehouses if w.get("healthy")),
        frozen_warehouses=sum(1 for w in warehouses if w.get("frozen")),
        custody_kg=sum(as_int(w.get("reserveKg")) for w in warehouses),
        tokenized_kg=sum(as_int(w.get("outstandingKg")) for w in warehouses),
        active_lots=sum(g["lots"] for g in groups),
        lots_minted=minted,
        material_value_usd=round(value, 2),
        vault=vault,
        updated_at=_latest(*(w.get("snapshotAt") for w in warehouses), vault.updated_at if vault else None),
    )


@router.get("/chains/{chain_id}/sync", response_model=SyncOut)
async def sync_status(chain: Chain, db: Db) -> SyncOut:
    cid = chain.chain_id
    status, leases = await asyncio.gather(
        db.chain_status.find_one({"_id": cid}),
        db.leases.find({"_id": {"$in": [f"indexer:{cid}", f"worker:{cid}"]}}).to_list(None),
    )
    now = utcnow()
    live = {lease["_id"].split(":")[0] for lease in leases if lease.get("expiresAt") and lease["expiresAt"] > now}
    status = status or {}
    logs, snap, worker = status.get("logs", {}), status.get("snapshot", {}), status.get("worker", {})
    block, head = logs.get("block"), logs.get("head")
    return SyncOut(
        chain_id=cid,
        indexer_live="indexer" in live,
        indexed_block=block,
        head_block=head,
        lag_blocks=max(0, head - block) if block is not None and head is not None else None,
        catching_up=bool(logs.get("catchingUp", block is None)),
        indexed_at=logs.get("at"),
        snapshot_at=snap.get("at"),
        worker_live="worker" in live,
        upkeep_at=worker.get("upkeepAt"),
        low_gas=bool(worker.get("lowGas")),
        error=logs.get("error") or snap.get("error") or worker.get("error"),
    )
