"""The signed-in wallet's view of a chain: portfolio (Overview), activity and notifications."""
import asyncio
from bisect import bisect_right
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query

from app.core.activity import describe, user_event_filter
from app.core.deps import CatalogDep, Chain, Db, OptionalUser, User
from app.core.errors import ApiError
from app.core.evm import as_int, utcnow
from app.core.present import Book, short
from app.core.schemas import (
    ActivityItemOut, ActivityOut, LotOut, MaterialHolding, NotificationsOut, PortfolioOut, PortfolioSite, ValuePoint,
    VaultPosition,
)

router = APIRouter(tags=["portfolio"])
LIVE = ["FREE", "REDEEMING"]
HISTORY_POINTS = 60


async def _vault_position(chain, address: str, decimals: int) -> VaultPosition | None:
    vault = chain.contract("TensileCreditVault")
    try:
        shares = int(await chain.call(vault.functions.balanceOf(address)))
        assets = int(await chain.call(vault.functions.convertToAssets(shares))) if shares else 0
    except Exception:  # the RPC is down: show the rest of the portfolio anyway
        return None
    return VaultPosition(shares=str(shares), assets_usdc=assets / 10**decimals)


async def _history(db, book: Book, lots: list[LotOut], days: int, constant_usd: float, debt: float) -> list[ValuePoint]:
    """Value of the lots held now, at each day's reference prices (plus the vault position)."""
    end = utcnow()
    start = end - timedelta(days=days)
    held: dict[tuple, float] = {}
    for lot in lots:
        if lot.material and lot.region:
            held[(lot.material, lot.region)] = held.get((lot.material, lot.region), 0) + lot.quantity_kg / 1000
    curves: dict[tuple, tuple[list[float], list[float]]] = {}
    for (material, region) in held:
        rows = await db.price_history.find(
            {"chainId": book.chain_id, "material": material, "region": region}, {"at": 1, "priceUsdPerTonne": 1}
        ).sort("roundId", 1).to_list(None)
        rows = [r for r in rows if r.get("at") and r.get("priceUsdPerTonne")]
        if rows:
            curves[(material, region)] = ([r["at"].timestamp() for r in rows], [r["priceUsdPerTonne"] for r in rows])
    points = []
    for i in range(HISTORY_POINTS + 1):
        t = start + (end - start) * i / HISTORY_POINTS
        gross = constant_usd
        for key, tonnes in held.items():
            if key in curves:
                times, prices = curves[key]
                j = bisect_right(times, t.timestamp()) - 1
                gross += tonnes * prices[max(j, 0)]  # before the first round: the first known price
        points.append(ValuePoint(at=t.replace(microsecond=0), gross_usd=round(gross, 2), net_usd=round(gross - debt, 2)))
    return points


@router.get("/chains/{chain_id}/portfolio", response_model=PortfolioOut)
async def portfolio(chain: Chain, db: Db, catalog: CatalogDep, user: User, days: int = Query(90, ge=7, le=3650)) -> PortfolioOut:
    cid = chain.chain_id
    book, docs, status = await asyncio.gather(
        Book.load(db, cid, catalog),
        db.lots.find({"chainId": cid, "owner": user.address, "state": {"$in": LIVE}}).sort("tokenId", -1).to_list(None),
        db.chain_status.find_one({"_id": cid}, {"vault.decimals": 1}),
    )
    decimals = ((status or {}).get("vault") or {}).get("decimals", 6)
    vault, _ = await asyncio.gather(_vault_position(chain, user.address, decimals), book.add_names(db, [user.address]))
    lots = [book.lot(d) for d in docs]
    lots_value = sum(lot.value_usd or 0 for lot in lots)
    vault_usd = vault.assets_usdc if vault else 0.0
    total = lots_value + vault_usd
    debt = 0.0  # Stage 5: open loans from the credit router

    groups: dict[str | None, list[LotOut]] = {}
    for lot in lots:
        groups.setdefault(lot.material, []).append(lot)
    by_material = sorted(
        (
            MaterialHolding(
                material=m,
                name=g[0].material_name or (m or "Unknown material"),
                symbol=g[0].symbol,
                quantity_kg=sum(x.quantity_kg for x in g),
                lots=len(g),
                value_usd=round(sum(x.value_usd or 0 for x in g), 2),
                share=round(sum(x.value_usd or 0 for x in g) / total, 4) if total else 0.0,
            )
            for m, g in groups.items()
        ),
        key=lambda h: -h.value_usd,
    )

    sites: dict[int, list[LotOut]] = {}
    for lot in lots:
        sites.setdefault(lot.warehouse_id, []).append(lot)
    site_out = []
    for wid, g in sites.items():
        w = book.warehouses.get(wid) or {}
        reserve, outstanding = as_int(w.get("reserveKg")), as_int(w.get("outstandingKg"))
        site_out.append(PortfolioSite(
            warehouse_id=wid, code=w.get("code"), name=w.get("name") or f"Warehouse {wid}", lat=w.get("lat"), lon=w.get("lon"),
            lots=len(g), quantity_kg=sum(x.quantity_kg for x in g),
            coverage=round(reserve / outstanding, 4) if outstanding else None,
            healthy=bool(w.get("healthy")), fresh=bool(w.get("fresh")), reported_at=w.get("reportedAt"),
        ))

    return PortfolioOut(
        chain_id=cid,
        address=user.address,
        display_name=book.name(user.address) or short(user.address),
        lots=lots,
        lot_count=len(lots),
        quantity_kg=sum(x.quantity_kg for x in lots),
        lots_value_usd=round(lots_value, 2),
        vault=vault,
        portfolio_value_usd=round(total, 2),
        debt_usdc=debt,
        borrow_capacity_usdc=round(sum(x.max_borrow_usdc or 0 for x in lots), 2),
        by_material=by_material,
        sites=sorted(site_out, key=lambda s: -s.quantity_kg),
        history=await _history(db, book, lots, days, vault_usd, debt),
        valued_at=max((p.get("snapshotAt") for p in book.prices.values() if p.get("snapshotAt")), default=None),
    )


# ------------------------------------------------------------------ activity + notifications


async def _feed(db, chain_id: int, catalog, query: dict, limit: int) -> list[ActivityItemOut]:
    events = await db.events.find(query).sort([("blockNumber", -1), ("logIndex", -1)]).limit(limit * 3).to_list(None)
    book = await Book.load(db, chain_id, catalog)
    return (await describe(db, book, events))[:limit]


@router.get("/chains/{chain_id}/activity", response_model=ActivityOut)
async def activity(
    chain: Chain, db: Db, catalog: CatalogDep, user: OptionalUser,
    scope: str = Query("mine", pattern="^(mine|all)$"), limit: int = Query(20, ge=1, le=100),
) -> ActivityOut:
    if scope == "mine":
        if user is None:
            raise ApiError(401, "not_authenticated", "Sign in to see your activity")
        query = await user_event_filter(db, chain.chain_id, user.address)
    else:
        query = {"chainId": chain.chain_id}
    return ActivityOut(chain_id=chain.chain_id, items=await _feed(db, chain.chain_id, catalog, query, limit))


async def _notifications(db, chain_id: int, catalog, address: str, limit: int) -> NotificationsOut:
    query = await user_event_filter(db, chain_id, address)
    items, user_doc = await asyncio.gather(
        _feed(db, chain_id, catalog, query, limit),
        db.users.find_one({"_id": address.lower()}, {"notificationsSeenAt": 1}),
    )
    seen = ((user_doc or {}).get("notificationsSeenAt") or {}).get(str(chain_id))
    unread = sum(1 for i in items if i.at and (seen is None or i.at > seen))
    return NotificationsOut(chain_id=chain_id, items=items, unread=unread, seen_at=seen)


@router.get("/chains/{chain_id}/notifications", response_model=NotificationsOut)
async def notifications(chain: Chain, db: Db, catalog: CatalogDep, user: User, limit: int = Query(20, ge=1, le=50)) -> NotificationsOut:
    return await _notifications(db, chain.chain_id, catalog, user.address, limit)


@router.post("/chains/{chain_id}/notifications/seen", response_model=NotificationsOut)
async def mark_seen(chain: Chain, db: Db, catalog: CatalogDep, user: User) -> NotificationsOut:
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"_id": user.address.lower()},
        {"$set": {f"notificationsSeenAt.{chain.chain_id}": now}, "$setOnInsert": {"address": user.address, "createdAt": now}},
        upsert=True,
    )
    return await _notifications(db, chain.chain_id, catalog, user.address, 20)
