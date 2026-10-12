"""Top-bar search: lot IDs, mint requests, warehouses and wallet addresses (Mongo only)."""
import re

from eth_utils import is_address, to_checksum_address
from fastapi import APIRouter, Query

from app.core.deps import CatalogDep, Chain, Db
from app.core.present import Book, request_display_id, short
from app.core.schemas import SearchOut, SearchResultOut

router = APIRouter(tags=["search"])

_LOT = re.compile(r"^(?:TNS-[A-Z]{1,4}-)?#?0*(\d{1,9})$", re.I)
_REQUEST = re.compile(r"^MR-?0*(\d{1,9})$", re.I)


@router.get("/chains/{chain_id}/search", response_model=SearchOut)
async def search(chain: Chain, db: Db, catalog: CatalogDep, q: str = Query(..., min_length=1, max_length=80)) -> SearchOut:
    cid, text = chain.chain_id, q.strip()
    book = await Book.load(db, cid, catalog)
    results: list[SearchResultOut] = []

    if is_address(text):
        address = to_checksum_address(text)
        await book.add_names(db, [address])
        lots = await db.lots.count_documents({"chainId": cid, "owner": address, "state": {"$in": ["FREE", "REDEEMING"]}})
        results.append(SearchResultOut(
            type="address", id=address, title=book.name(address) or short(address),
            subtitle=f"{address} · {lots} active lot{'s' if lots != 1 else ''}", href=f"/portfolio?address={address}",
        ))

    if m := _REQUEST.match(text):
        rid = int(m.group(1))
        req = await db.mint_requests.find_one({"chainId": cid, "requestId": rid})
        if req:
            results.append(SearchResultOut(
                type="request", id=str(rid), title=request_display_id(rid),
                subtitle=f"{req.get('status', '').title()} · {as_tonnes(req.get('quantityKg'))} · {book.warehouse_name(req.get('warehouseId')) or ''}",
                href=f"/tokenize?request={rid}",
            ))
    elif m := _LOT.match(text):
        tid = int(m.group(1))
        lot = await db.lots.find_one({"chainId": cid, "tokenId": tid})
        if lot:
            out = book.lot(lot)
            results.append(SearchResultOut(
                type="lot", id=str(tid), title=out.display_id,
                subtitle=f"{out.material_name or 'Material lot'} · {as_tonnes(out.quantity_kg)} · {out.warehouse_name or ''} · {out.state}",
                href=f"/lots/{tid}",
            ))

    needle = text.lower()
    for w in book.warehouses.values():
        hay = " ".join(str(w.get(k) or "") for k in ("code", "name", "place", "operatorName", "region")).lower()
        if needle in hay and len(results) < 8:
            results.append(SearchResultOut(
                type="warehouse", id=str(w["warehouseId"]), title=w.get("name") or f"Warehouse {w['warehouseId']}",
                subtitle=" · ".join(x for x in (w.get("code"), w.get("place"), "frozen" if w.get("frozen") else None) if x),
                href=f"/reserve?wh={w.get('code') or w['warehouseId']}",
            ))

    if len(text) >= 2 and len(results) < 8:  # materials: newest lots of a matching material
        codes = [c for c, mat in catalog.materials.items() if needle in f"{c} {mat.name} {mat.family} {mat.symbol}".lower()]
        if codes:
            lots = await db.lots.find({"chainId": cid, "material": {"$in": codes}, "state": {"$in": ["FREE", "REDEEMING"]}}).sort("tokenId", -1).limit(8 - len(results)).to_list(None)
            for lot in lots:
                out = book.lot(lot)
                results.append(SearchResultOut(
                    type="lot", id=str(out.token_id), title=out.display_id,
                    subtitle=f"{out.material_name} · {as_tonnes(out.quantity_kg)} · {out.warehouse_name or ''}", href=f"/lots/{out.token_id}",
                ))

    seen, unique = set(), []
    for r in results:
        if (r.type, r.id) not in seen:
            seen.add((r.type, r.id))
            unique.append(r)
    return SearchOut(query=text, results=unique[:8])


def as_tonnes(kg) -> str:
    return f"{int(kg or 0) / 1000:,.3f} t"

