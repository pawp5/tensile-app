"""Event -> projection handlers.

Every decoded log is stored in `events` first; handlers then keep query-friendly collections up to
date. Handlers only *set* fields (never increment), so re-applying the same events in the same
order is harmless, and `python -m app.indexer --rebuild` can replay `events` into fresh
projections whenever a later stage adds a handler.

Warehouses, prices and the vault are small, enumerable state: they are read straight from the
chain by snapshots.py instead. Events for them only wake the snapshot early.
"""
from collections.abc import Awaitable, Callable
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.core.catalog import Catalog
from app.core.evm import ZERO_ADDRESS, as_int, bytes_to_text, hex_to_bytes, is_zero_address, ts
from app.core.roles import ROLE_NAMES

Handler = Callable[["Projector", dict[str, Any]], Awaitable[None]]
HANDLERS: dict[tuple[str, str], Handler] = {}

# Collections fully derived from `events` (cleared by --rebuild).
PROJECTIONS = ("lots", "roles", "identities", "mint_requests", "attestations")

# Events that change something snapshots.py reads: refresh the snapshot right away.
SNAPSHOT_TRIGGERS: dict[str, set[str] | None] = {
    "WarehouseRegistry": None,  # all events
    "PriceOracleAdapter": None,
    "MaterialPassport": {"LotMinted", "LotBurned"},  # outstandingKg changes
    "ReserveGuard": None,
}

LOT_STATES = ("BURNED", "FREE", "REDEEMING")  # IMaterialPassport.LotState; NONE after burn
ATTESTATION_KINDS = ("CUSTODY", "INSPECTION", "REINSPECTION", "AI_REVIEW", "RELEASE")  # IAttestationRegistry.Kind
SUBJECT_TYPES = ("REQUEST", "LOT")  # IAttestationRegistry.SubjectType


def on(contract: str, *events: str) -> Callable[[Handler], Handler]:
    def register(fn: Handler) -> Handler:
        for event in events:
            HANDLERS[(contract, event)] = fn
        return fn

    return register


class Projector:
    def __init__(self, db: AsyncDatabase, chain_id: int, catalog: Catalog) -> None:
        self.db = db
        self.chain_id = chain_id
        self.catalog = catalog
        self.snapshot_due = False

    async def apply(self, ev: dict[str, Any]) -> None:
        triggers = SNAPSHOT_TRIGGERS.get(ev["contract"], set())
        if triggers is None or ev["event"] in triggers:
            self.snapshot_due = True
        handler = HANDLERS.get((ev["contract"], ev["event"]))
        if handler is not None:
            await handler(self, ev)

    async def lot(self, ev: dict[str, Any], token_id: int, fields: dict[str, Any]) -> None:
        await self.db.lots.update_one(
            {"chainId": self.chain_id, "tokenId": token_id},
            {"$set": {**fields, "updatedBlock": ev["blockNumber"], "updatedAt": ev["timestamp"]}},
            upsert=True,
        )


# ------------------------------------------------------------------ lots (MaterialPassport)


@on("MaterialPassport", "LotMinted")
async def lot_minted(p: Projector, ev: dict) -> None:
    a = ev["args"]
    material = p.catalog.material_by_hash(hex_to_bytes(a["materialCode"]))
    await p.lot(ev, as_int(a["tokenId"]), {
        "owner": a["owner"],
        "materialCode": a["materialCode"],
        "material": material.code if material else None,
        "warehouseId": as_int(a["warehouseId"]),
        "quantityKg": as_int(a["quantityKg"]),
        "certHash": a["certHash"],
        "evidenceURI": a["evidenceURI"],
        "state": "FREE",
        "mintedAt": ev["timestamp"],
        "mintedBlock": ev["blockNumber"],
        "mintTx": ev["txHash"],
        "lastAttestedAt": ev["timestamp"],
    })


@on("MaterialPassport", "Transfer")
async def lot_transfer(p: Projector, ev: dict) -> None:
    a = ev["args"]
    if is_zero_address(a["to"]):  # burn: LotBurned sets the state
        return
    await p.lot(ev, as_int(a["tokenId"]), {"owner": a["to"]})


@on("MaterialPassport", "LotStateChanged")
async def lot_state(p: Projector, ev: dict) -> None:
    a = ev["args"]
    await p.lot(ev, as_int(a["tokenId"]), {"state": LOT_STATES[as_int(a["to"])]})


@on("MaterialPassport", "LotBurned")
async def lot_burned(p: Projector, ev: dict) -> None:
    await p.lot(ev, as_int(ev["args"]["tokenId"]), {"state": "BURNED", "burnedAt": ev["timestamp"], "owner": ZERO_ADDRESS})


@on("MaterialPassport", "LotAttested")
async def lot_attested(p: Projector, ev: dict) -> None:
    a = ev["args"]
    await p.lot(ev, as_int(a["tokenId"]), {"lastAttestedAt": ts(as_int(a["timestamp"]))})


# ------------------------------------------------------------------ roles (TensileAccessManager)


@on("TensileAccessManager", "RoleGranted", "RoleRevoked")
async def role_changed(p: Projector, ev: dict) -> None:
    a = ev["args"]
    await p.db.roles.update_one(
        {"chainId": p.chain_id, "role": ROLE_NAMES.get(a["role"], a["role"]), "account": a["account"]},
        {"$set": {
            "roleHash": a["role"],
            "active": ev["event"] == "RoleGranted",
            "by": a["sender"],
            "updatedBlock": ev["blockNumber"],
            "updatedAt": ev["timestamp"],
        }},
        upsert=True,
    )


# ------------------------------------------------------------------ identities (IdentityRegistry)


async def _identity(p: Projector, ev: dict, account: str, fields: dict[str, Any]) -> None:
    await p.db.identities.update_one(
        {"chainId": p.chain_id, "account": account},
        {"$set": {**fields, "updatedBlock": ev["blockNumber"], "updatedAt": ev["timestamp"]}},
        upsert=True,
    )


@on("IdentityRegistry", "IdentitySet")
async def identity_set(p: Projector, ev: dict) -> None:
    a = ev["args"]
    await _identity(p, ev, a["account"], {
        "country": bytes_to_text(a["country"]) or None,
        "tier": as_int(a["tier"]),
        "expiresAt": ts(as_int(a["expiry"])),
        "revoked": False,
    })


@on("IdentityRegistry", "IdentityRevoked")
async def identity_revoked(p: Projector, ev: dict) -> None:
    await _identity(p, ev, ev["args"]["account"], {"revoked": True})


@on("IdentityRegistry", "ProtocolSet")
async def protocol_set(p: Projector, ev: dict) -> None:
    a = ev["args"]
    await _identity(p, ev, a["account"], {"protocol": bool(a["allowed"])})


# ------------------------------------------------------------------ mint requests (MintingController)


async def _request(p: Projector, ev: dict, request_id: int, fields: dict[str, Any]) -> None:
    await p.db.mint_requests.update_one(
        {"chainId": p.chain_id, "requestId": request_id},
        {"$set": {**fields, "updatedBlock": ev["blockNumber"], "updatedAt": ev["timestamp"]}},
        upsert=True,
    )


@on("MintingController", "MintRequested")
async def mint_requested(p: Projector, ev: dict) -> None:
    a = ev["args"]
    material = p.catalog.material_by_hash(hex_to_bytes(a["materialCode"]))
    await _request(p, ev, as_int(a["requestId"]), {
        "owner": a["owner"],
        "warehouseId": as_int(a["warehouseId"]),
        "materialCode": a["materialCode"],
        "material": material.code if material else None,
        "quantityKg": as_int(a["quantityKg"]),
        "certHash": a["certHash"],
        "evidenceURI": a["evidenceURI"],
        "status": "REQUESTED",
        "createdAt": ev["timestamp"],
        "requestTx": ev["txHash"],
    })


@on("MintingController", "CustodyConfirmed")
async def custody_confirmed(p: Projector, ev: dict) -> None:
    a = ev["args"]
    await _request(p, ev, as_int(a["requestId"]), {"custodyAt": ev["timestamp"], "custodyBy": a["operator"]})


@on("MintingController", "AiOverridden")
async def ai_overridden(p: Projector, ev: dict) -> None:
    a = ev["args"]
    await _request(p, ev, as_int(a["requestId"]), {"aiOverride": True, "aiOverrideBy": a["by"]})


@on("MintingController", "MintFinalized")
async def mint_finalized(p: Projector, ev: dict) -> None:
    a = ev["args"]
    request_id, token_id = as_int(a["requestId"]), as_int(a["tokenId"])
    await _request(p, ev, request_id, {"status": "FINALIZED", "tokenId": token_id, "finalizedAt": ev["timestamp"]})
    await p.lot(ev, token_id, {"requestId": request_id})


@on("MintingController", "MintRejected")
async def mint_rejected(p: Projector, ev: dict) -> None:
    a = ev["args"]
    await _request(p, ev, as_int(a["requestId"]), {"status": "REJECTED", "rejectedBy": a["by"], "rejectReason": bytes_to_text(a["reason"]) or None})


@on("MintingController", "MintCancelled", "MintExpired")
async def mint_closed(p: Projector, ev: dict) -> None:
    status = "CANCELLED" if ev["event"] == "MintCancelled" else "EXPIRED"
    await _request(p, ev, as_int(ev["args"]["requestId"]), {"status": status})


# ------------------------------------------------------------------ attestations (AttestationRegistry)


@on("AttestationRegistry", "Attested")
async def attested(p: Projector, ev: dict) -> None:
    a = ev["args"]
    await p.db.attestations.update_one(
        {"chainId": p.chain_id, "index": as_int(a["index"])},
        {"$set": {
            "kind": ATTESTATION_KINDS[as_int(a["kind"])],
            "subjectType": SUBJECT_TYPES[as_int(a["subjectType"])],
            "subject": as_int(a["subject"]),
            "attestor": a["attestor"],
            "score": as_int(a["score"]),
            "dataHash": a["dataHash"],
            "uri": a["uri"],
            "at": ev["timestamp"],
            "tx": ev["txHash"],
            "block": ev["blockNumber"],
        }},
        upsert=True,
    )
