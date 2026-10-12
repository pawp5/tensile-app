"""Static catalog (catalog.json): warehouses, materials, reference prices.

On-chain, materials are keccak256(code) and regions are bytes32 strings; warehouses carry
metaURI "catalog:<CODE>" so any chain's registry can be mapped back to this file.
"""
import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from eth_utils import keccak

META_PREFIX = "catalog:"


def material_hash(code: str) -> bytes:
    return keccak(text=code)


def region_bytes(region: str) -> bytes:
    raw = region.encode()
    if not 0 < len(raw) <= 32:
        raise ValueError(f"region {region!r} must be 1-32 bytes")
    return raw.ljust(32, b"\0")


def region_str(raw: bytes) -> str:
    return raw.rstrip(b"\0").decode("ascii", "ignore")


def usd_to_price8(usd: float) -> int:
    """USD per tonne -> the feeds' 8-decimal integer."""
    return int(round(usd * 10**8))


def meta_uri(code: str) -> str:
    return META_PREFIX + code


def code_from_meta(uri: str) -> str | None:
    return uri[len(META_PREFIX):] if uri.startswith(META_PREFIX) else None


@dataclass(frozen=True)
class Material:
    code: str
    name: str
    symbol: str
    family: str
    grade: str

    @property
    def hash(self) -> bytes:
        return material_hash(self.code)


@dataclass(frozen=True)
class Warehouse:
    code: str
    name: str
    operator: str
    region: str
    country: str
    place: str
    lat: float
    lon: float
    reserve_kg: int
    materials: tuple[str, ...]


@dataclass(frozen=True)
class Catalog:
    materials: dict[str, Material]
    prices: dict[tuple[str, str], float]  # (material, region) -> USD/t
    warehouses: tuple[Warehouse, ...]
    class_defaults: dict = field(default_factory=dict)
    identity_defaults: dict = field(default_factory=dict)

    def warehouse(self, code: str) -> Warehouse | None:
        return next((w for w in self.warehouses if w.code == code), None)

    def material_by_hash(self, h: bytes) -> Material | None:
        return next((m for m in self.materials.values() if m.hash == bytes(h)), None)

    def price_pairs(self) -> list[tuple[str, str]]:
        """Every (material, region) that some warehouse needs a price feed for."""
        pairs = {(m, w.region) for w in self.warehouses for m in w.materials}
        return sorted(pairs)


@lru_cache
def load_catalog(path: Path) -> Catalog:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    materials = {code: Material(code=code, **m) for code, m in raw["materials"].items()}
    prices = {(m, r): float(v) for m, by_region in raw["pricesUsdPerTonne"].items() for r, v in by_region.items()}
    warehouses = tuple(
        Warehouse(
            code=w["code"], name=w["name"], operator=w["operator"], region=w["region"], country=w["country"],
            place=w["place"], lat=w["lat"], lon=w["lon"], reserve_kg=int(w["reserveKg"]), materials=tuple(w["materials"]),
        )
        for w in raw["warehouses"]
    )
    cat = Catalog(materials, prices, warehouses, raw.get("classDefaults", {}), raw.get("identityDefaults", {}))
    for w in cat.warehouses:
        region_bytes(w.region)
        for m in w.materials:
            if m not in cat.materials:
                raise ValueError(f"catalog: {w.code} uses unknown material {m}")
            if (m, w.region) not in cat.prices:
                raise ValueError(f"catalog: no price for {m} in {w.region}")
    return cat