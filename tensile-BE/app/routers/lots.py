"""Lots (material passports), their provenance and history. All from Mongo."""
import asyncio
from typing import Any

from eth_utils import is_address, to_checksum_address
from fastapi import APIRouter, Path, Query, Response

from app.core.activity import describe, lot_event_filter
from app.core.deps import CatalogDep, Chain, Db
from app.core.errors import ApiError
from app.core.present import Book
from app.core.schemas import LotDetailOut, LotsOut
from app.routers.protocol import _warehouse  # same WarehouseOut as /warehouses

router = APIRouter(tags=["lots"])


@router.get("/chains/{chain_id}/lots", response_model=LotsOut)
async def list_lots(
    chain: Chain,
    db: Db,
    catalog: CatalogDep,
    response: Response,
    owner: str | None = Query(None, description="wallet address"),
    warehouse_id: int | None = Query(None, alias="warehouseId"),
    material: str | None = None,
    state: str = Query("live", pattern="^(live|all|FREE|REDEEMING|BURNED)$"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
) -> LotsOut:
    query: dict[str, Any] = {"chainId": chain.chain_id}
    if owner:
        if not is_address(owner):
            raise ApiError(422, "bad_address", "owner is not an EVM address")
        query["owner"] = to_checksum_address(owner)
    if warehouse_id is not None:
        query["warehouseId"] = warehouse_id
    if material:
        query["material"] = material
    if state == "live":
        query["state"] = {"$in": ["FREE", "REDEEMING"]}
    elif state != "all":
        query["state"] = state
    docs, total, book = await asyncio.gather(
        db.lots.find(query).sort("tokenId", -1).skip(skip).limit(limit).to_list(None),
        db.lots.count_documents(query),
        Book.load(db, chain.chain_id, catalog),
    )
    await book.add_names(db, [d.get("owner") for d in docs])
    response.headers["Cache-Control"] = "public, max-age=5"
    return LotsOut(chain_id=chain.chain_id, lots=[book.lot(d) for d in docs], total=total)


@router.get("/chains/{chain_id}/lots/{token_id}", response_model=LotDetailOut)
async def get_lot(chain: Chain, db: Db, catalog: CatalogDep, response: Response, token_id: int = Path(ge=1)) -> LotDetailOut:
    cid = chain.chain_id
    doc, book = await asyncio.gather(db.lots.find_one({"chainId": cid, "tokenId": token_id}), Book.load(db, cid, catalog))
    if doc is None:
        raise ApiError(404, "lot_not_found", f"No lot {token_id} on {chain.config.name}")
    request_id = doc.get("requestId")

    async def mint_request() -> dict | None:
        return await db.mint_requests.find_one({"chainId": cid, "requestId": request_id}) if request_id is not None else None

    request, attestations, events = await asyncio.gather(
        mint_request(),
        db.attestations.find({"chainId": cid, "$or": [
            {"subjectType": "LOT", "subject": token_id},
            *([{"subjectType": "REQUEST", "subject": request_id}] if request_id is not None else []),
        ]}).sort("index", 1).to_list(None),
        db.events.find(lot_event_filter(cid, token_id, request_id)).sort([("blockNumber", 1), ("logIndex", 1)]).limit(500).to_list(None),
    )
    await book.add_names(db, [doc.get("owner"), *(a.get("attestor") for a in attestations)])
    history = await describe(db, book, events)
    wid = doc.get("warehouseId")
    w = book.warehouses.get(wid)
    response.headers["Cache-Control"] = "public, max-age=5"
    return LotDetailOut(
        **book.lot(doc).model_dump(),
        warehouse=_warehouse(w, catalog) if w else None,
        request=book.request(request) if request else None,
        attestations=[book.attestation(a, wid) for a in attestations],
        history=history,
    )
