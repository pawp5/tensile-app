"""Mongo projection docs -> API models, with names and values attached.

A Book holds one chain's lookup tables (warehouses, prices, display names) for the duration of a
request, so turning 50 lots into LotOut costs three queries, not 150.
"""
import asyncio
from collections.abc import Iterable
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.core.catalog import Catalog
from app.core.evm import as_int
from app.core.schemas import AttestationOut, LotOut, MintRequestOut

AI_REVIEWER = "Tensile automated review"


def lot_display_id(token_id: int, symbol: str | None) -> str:
    return f"TNS-{symbol or 'XX'}-{token_id:05d}"


def request_display_id(request_id: int) -> str:
    return f"MR-{request_id:04d}"


def short(address: str | None) -> str:
    return f"{address[:6]}…{address[-4:]}" if address else "—"


async def org_names(db: AsyncDatabase, addresses: Iterable[str]) -> dict[str, str]:
    """Approved KYC organisation names by address."""
    wanted = sorted({a for a in addresses if a})
    if not wanted:
        return {}
    docs = await db.kyc_applications.find(
        {"address": {"$in": wanted}, "status": "approved"}, {"address": 1, "orgName": 1}
    ).to_list(None)
    return {d["address"]: d["orgName"] for d in docs if d.get("orgName")}


class Book:
    def __init__(self, chain_id: int, catalog: Catalog, warehouses: list[dict], prices: list[dict]) -> None:
        self.chain_id = chain_id
        self.catalog = catalog
        self.warehouses = {w["warehouseId"]: w for w in warehouses}
        self.prices = {(p["material"], p["region"]): p for p in prices}
        self.names: dict[str, str] = {}
        self.max_ltv = int(catalog.class_defaults.get("routerMaxLtvBps", 6500)) / 10_000

    @classmethod
    async def load(cls, db: AsyncDatabase, chain_id: int, catalog: Catalog) -> "Book":
        warehouses, prices = await asyncio.gather(
            db.warehouses.find({"chainId": chain_id}).to_list(None),
            db.prices.find({"chainId": chain_id}).to_list(None),
        )
        return cls(chain_id, catalog, warehouses, prices)

    async def add_names(self, db: AsyncDatabase, addresses: Iterable[str]) -> None:
        missing = [a for a in addresses if a and a not in self.names]
        self.names.update(await org_names(db, missing))

    # ------------------------------------------------------------------ lookups

    def name(self, address: str | None) -> str | None:
        return self.names.get(address) if address else None

    def label(self, address: str | None) -> str:
        """Organisation name, else the short address."""
        return self.name(address) or short(address)

    def warehouse_name(self, warehouse_id: int | None) -> str | None:
        w = self.warehouses.get(warehouse_id)
        return w.get("name") if w else None

    def operator_name(self, warehouse_id: int | None) -> str | None:
        w = self.warehouses.get(warehouse_id)
        return (w.get("operatorName") or short(w.get("operator"))) if w else None

    def symbol(self, material: str | None) -> str | None:
        m = self.catalog.materials.get(material or "")
        return m.symbol if m else None

    def price(self, material: str | None, warehouse_id: int) -> tuple[float | None, int]:
        """(USD per tonne, haircut bps) for a material held in a warehouse."""
        region = (self.warehouses.get(warehouse_id) or {}).get("region")
        p = self.prices.get((material, region))
        return (p.get("priceUsdPerTonne"), int(p.get("haircutBps", 0))) if p else (None, 0)

    # ------------------------------------------------------------------ models

    def lot(self, doc: dict[str, Any]) -> LotOut:
        token_id = int(doc["tokenId"])
        material = doc.get("material")
        info = self.catalog.materials.get(material or "")
        wid = int(doc.get("warehouseId") or 0)
        w = self.warehouses.get(wid) or {}
        qty = as_int(doc.get("quantityKg"))
        price, haircut = self.price(material, wid)
        value = qty / 1000 * price if price else None
        collateral = value * (1 - haircut / 10_000) if value is not None else None
        return LotOut(
            token_id=token_id,
            display_id=lot_display_id(token_id, info.symbol if info else None),
            material=material,
            material_name=info.name if info else None,
            symbol=info.symbol if info else None,
            material_code=doc.get("materialCode", ""),
            warehouse_id=wid,
            warehouse_code=w.get("code"),
            warehouse_name=w.get("name"),
            region=w.get("region"),
            quantity_kg=qty,
            owner=doc.get("owner", ""),
            owner_name=self.name(doc.get("owner")),
            state=doc.get("state", "FREE"),
            minted_at=doc.get("mintedAt"),
            last_attested_at=doc.get("lastAttestedAt"),
            cert_hash=doc.get("certHash"),
            evidence_uri=doc.get("evidenceURI"),
            request_id=doc.get("requestId"),
            price_usd_per_tonne=price,
            value_usd=round(value, 2) if value is not None else None,
            haircut_bps=haircut,
            collateral_value_usd=round(collateral, 2) if collateral is not None else None,
            max_borrow_usdc=round(collateral * self.max_ltv, 2) if collateral is not None else None,
        )

    def request(self, doc: dict[str, Any]) -> MintRequestOut:
        return MintRequestOut(
            request_id=int(doc["requestId"]),
            display_id=request_display_id(int(doc["requestId"])),
            owner=doc.get("owner", ""),
            warehouse_id=int(doc.get("warehouseId") or 0),
            material=doc.get("material"),
            quantity_kg=as_int(doc.get("quantityKg")),
            status=doc.get("status", "REQUESTED"),
            created_at=doc.get("createdAt"),
            custody_at=doc.get("custodyAt"),
            ai_override=bool(doc.get("aiOverride")),
            token_id=doc.get("tokenId"),
            evidence_uri=doc.get("evidenceURI"),
            cert_hash=doc.get("certHash"),
        )

    def attestation(self, doc: dict[str, Any], warehouse_id: int | None = None) -> AttestationOut:
        kind = doc["kind"]
        if kind == "AI_REVIEW":
            who = AI_REVIEWER
        elif kind in ("CUSTODY", "RELEASE") and warehouse_id:
            who = self.operator_name(warehouse_id)
        else:
            who = self.name(doc.get("attestor"))
        return AttestationOut(
            index=int(doc["index"]),
            kind=kind,
            subject_type=doc["subjectType"],
            subject=int(doc["subject"]),
            attestor=doc.get("attestor", ""),
            attestor_name=who,
            score=int(doc.get("score") or 0),
            data_hash=doc.get("dataHash", ""),
            uri=doc.get("uri", ""),
            at=doc.get("at"),
            tx_hash=doc.get("tx"),
        )
