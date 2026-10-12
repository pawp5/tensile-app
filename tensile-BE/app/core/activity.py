"""Indexed events -> human activity items (Overview activity, notifications, lot history).

Later stages only need to add a branch to `_describe` for any new event they care about.
"""
from datetime import datetime, timezone
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.core.evm import as_int, bytes_to_text, is_zero_address
from app.core.present import Book, lot_display_id, request_display_id
from app.core.roles import ROLE_NAMES
from app.core.schemas import ActivityItemOut

KIND_TITLES = {
    "INSPECTION": ("insp", "Inspection attested"),
    "REINSPECTION": ("insp", "Reinspection attested"),
    "AI_REVIEW": ("insp", "Automated review"),
    "CUSTODY": ("insp", "Custody evidence recorded"),
    "RELEASE": ("redeem", "Release proof recorded"),
}
ATTESTATION_KINDS = ("CUSTODY", "INSPECTION", "REINSPECTION", "AI_REVIEW", "RELEASE")


def _t(kg: Any) -> str:
    return f"{as_int(kg) / 1000:,.3f} t"


def _usdc(raw: Any, decimals: int = 6) -> str:
    return f"{as_int(raw) / 10**decimals:,.2f} USDC"


def _usd(raw: Any, decimals: int = 6) -> str:
    return f"${as_int(raw) / 10**decimals:,.2f}"


class _Ctx:
    def __init__(self, book: Book, lots: dict[int, dict], requests: dict[int, dict]) -> None:
        self.book = book
        self.lots = lots
        self.requests = requests

    def lot_ref(self, token_id: Any) -> tuple[str, str]:
        tid = as_int(token_id)
        lot = self.lots.get(tid) or {}
        return lot_display_id(tid, self.book.symbol(lot.get("material"))), f"/lots/{tid}"

    def request_wh(self, request_id: Any) -> int | None:
        return (self.requests.get(as_int(request_id)) or {}).get("warehouseId")


def _item(ev: dict, kind: str, title: str, ref: str | None = None, actor: str | None = None,
          amount: str | None = None, href: str | None = None) -> ActivityItemOut:
    return ActivityItemOut(
        id=f"{ev['txHash']}:{ev['logIndex']}", kind=kind, title=title, ref=ref, actor=actor, amount=amount,
        at=ev.get("timestamp"), tx_hash=ev["txHash"], href=href,
    )


def _describe(ev: dict, c: _Ctx) -> ActivityItemOut | None:  # noqa: C901 (one branch per event)
    contract, event, a, b = ev["contract"], ev["event"], ev["args"], c.book

    if contract == "MaterialPassport":
        if event == "LotMinted":
            ref, href = c.lot_ref(a["tokenId"])
            return _item(ev, "mint", "Lot minted", ref, b.warehouse_name(as_int(a["warehouseId"])), _t(a["quantityKg"]), href)
        if event == "Transfer" and not is_zero_address(a["from"]) and not is_zero_address(a["to"]):
            ref, href = c.lot_ref(a["tokenId"])
            return _item(ev, "transfer", "Lot transferred", ref, f"{b.label(a['from'])} → {b.label(a['to'])}", None, href)
        if event == "LotBurned":
            ref, href = c.lot_ref(a["tokenId"])
            return _item(ev, "redeem", "Passport burned", ref, b.warehouse_name(as_int(a["warehouseId"])), _t(a["quantityKg"]), href)
        return None

    if contract == "MintingController":
        rid = as_int(a.get("requestId"))
        mr, mr_href = request_display_id(rid), f"/tokenize?request={rid}"
        if event == "MintRequested":
            return _item(ev, "mint", "Mint requested", mr, b.warehouse_name(as_int(a["warehouseId"])), _t(a["quantityKg"]), mr_href)
        if event == "CustodyConfirmed":
            return _item(ev, "insp", "Custody confirmed", mr, b.operator_name(c.request_wh(rid)), None, mr_href)
        if event == "AiOverridden":
            return _item(ev, "insp", "Review overridden", mr, b.label(a["by"]), None, mr_href)
        if event == "MintFinalized":
            ref, href = c.lot_ref(a["tokenId"])
            return _item(ev, "mint", "Passport issued", ref, mr, None, href)
        if event == "MintRejected":
            return _item(ev, "mint", "Mint rejected", mr, b.label(a["by"]), bytes_to_text(a["reason"]) or None, mr_href)
        if event in ("MintCancelled", "MintExpired"):
            return _item(ev, "mint", "Mint request " + ("cancelled" if event == "MintCancelled" else "expired"), mr, None, None, mr_href)
        return None

    if contract == "AttestationRegistry" and event == "Attested":
        kind_name = ATTESTATION_KINDS[as_int(a["kind"])]
        icon, title = KIND_TITLES[kind_name]
        subject = as_int(a["subject"])
        if as_int(a["subjectType"]) == 0:  # mint request
            ref, href, wid = request_display_id(subject), f"/tokenize?request={subject}", c.request_wh(subject)
        else:
            (ref, href), wid = c.lot_ref(subject), (c.lots.get(subject) or {}).get("warehouseId")
        if kind_name == "AI_REVIEW":
            actor, amount = "Tensile automated review", f"Score {as_int(a['score'])}"
        elif kind_name in ("CUSTODY", "RELEASE"):
            actor, amount = b.operator_name(wid) or b.label(a["attestor"]), None
        else:
            actor, amount = b.label(a["attestor"]), None
        return _item(ev, icon, title, ref, actor, amount, href)

    if contract == "IdentityRegistry":
        if event == "IdentitySet":
            return _item(ev, "identity", "Identity verified", None, b.label(a["account"]), f"Tier {as_int(a['tier'])}", "/onboarding")
        if event == "IdentityRevoked":
            return _item(ev, "identity", "Identity revoked", None, b.label(a["account"]), None, "/onboarding")
        return None

    if contract == "TensileAccessManager" and event in ("RoleGranted", "RoleRevoked"):
        role = ROLE_NAMES.get(a["role"], a["role"][:10])
        verb = "granted" if event == "RoleGranted" else "revoked"
        return _item(ev, "role", f"Role {verb}: {role}", None, b.label(a["account"]))

    if contract == "WarehouseRegistry":
        wid = as_int(a.get("id"))
        code = (b.warehouses.get(wid) or {}).get("code") or f"WH-{wid}"
        if event == "WarehouseFrozen":
            return _item(ev, "warehouse", "Warehouse frozen", code, b.warehouse_name(wid), bytes_to_text(a["reason"]) or None, f"/reserve?wh={code}")
        if event == "WarehouseUnfrozen":
            return _item(ev, "warehouse", "Warehouse unfrozen", code, b.warehouse_name(wid), None, f"/reserve?wh={code}")
        return None

    if contract == "ReserveGuard" and event == "ReserveBreach":
        wid = as_int(a["warehouseId"])
        code = (b.warehouses.get(wid) or {}).get("code") or f"WH-{wid}"
        return _item(ev, "warehouse", "Reserve breach", code, b.warehouse_name(wid), f"{_t(a['reserveKg'])} vs {_t(a['outstandingKg'])}", f"/reserve?wh={code}")

    if contract == "CreditRouter":
        if "tokenId" not in a:
            return None
        ref, href = c.lot_ref(a["tokenId"])
        if event == "LoanOpened":
            return _item(ev, "loan", "Loan opened", ref, b.label(a["borrower"]), _usdc(a["borrowed"]), href)
        if event == "Borrowed":
            return _item(ev, "loan", "Borrowed more", ref, b.label(a["borrower"]), _usdc(a["borrowed"]), href)
        if event == "Repaid":
            return _item(ev, "repay", "Repayment", ref, b.label(a["payer"]), "−" + _usdc(a["assets"]), href)
        if event == "LoanClosed":
            return _item(ev, "repay", "Loan closed", ref, b.label(a["borrower"]), None, href)
        if event == "PaidOffBySale":
            return _item(ev, "repay", "Loan paid off by sale", ref, b.label(a["borrower"]), _usdc(a["paid"]), href)
        return None

    if contract == "Marketplace":
        if event == "Settled":
            ref, href = c.lot_ref(a["tokenId"])
            return _item(ev, "trade", "Marketplace settlement", ref, f"{b.label(a['seller'])} → {b.label(a['buyer'])}", _usd(a["price"]), href)
        if event == "Listed":
            ref, href = c.lot_ref(a["tokenId"])
            return _item(ev, "trade", "Listed for sale", ref, b.label(a["seller"]), _usd(a["price"]), href)
        if event == "BidPlaced":
            ref, href = c.lot_ref(a["tokenId"])
            return _item(ev, "trade", "Bid placed", ref, b.label(a["bidder"]), _usd(a["amount"]), href)
        return None

    if contract == "TensileCreditVault":
        if event == "Deposit":
            return _item(ev, "vault", "Vault deposit", None, b.label(a["owner"]), _usdc(a["assets"]), "/lend")
        if event == "Withdraw":
            return _item(ev, "vault", "Vault withdrawal", None, b.label(a["owner"]), "−" + _usdc(a["assets"]), "/lend")
        return None

    if contract == "RedemptionManager":
        if "tokenId" not in a:
            return None
        ref, href = c.lot_ref(a["tokenId"])
        if event == "RedemptionRequested":
            due = datetime.fromtimestamp(as_int(a["deadline"]), timezone.utc).strftime("%Y-%m-%d")
            return _item(ev, "redeem", "Redemption requested", ref, b.label(a["holder"]), f"Release due {due}", href)
        if event == "RedemptionCancelled":
            return _item(ev, "redeem", "Redemption cancelled", ref, None, None, href)
        if event == "Redeemed":
            wid = (c.lots.get(as_int(a["tokenId"])) or {}).get("warehouseId")
            return _item(ev, "redeem", "Redemption released", ref, b.operator_name(wid) or b.label(a["operator"]), None, href)
        if event == "RedemptionDisputed":
            return _item(ev, "redeem", "Redemption disputed", ref, b.warehouse_name(as_int(a["warehouseId"])), None, href)
        return None

    return None


async def describe(db: AsyncDatabase, book: Book, events: list[dict]) -> list[ActivityItemOut]:
    """Describe events (any order is kept), skipping those with nothing to say to a person."""
    token_ids, request_ids, addresses = set(), set(), set()
    for ev in events:
        a = ev["args"]
        if "tokenId" in a:
            token_ids.add(as_int(a["tokenId"]))
        if "requestId" in a:
            request_ids.add(as_int(a["requestId"]))
        if ev["contract"] == "AttestationRegistry":
            (request_ids if as_int(a.get("subjectType")) == 0 else token_ids).add(as_int(a.get("subject")))
        addresses.update(ev.get("addresses", []))
    cid = book.chain_id
    lots = {d["tokenId"]: d for d in await db.lots.find({"chainId": cid, "tokenId": {"$in": sorted(token_ids)}}).to_list(None)}
    reqs = {d["requestId"]: d for d in await db.mint_requests.find({"chainId": cid, "requestId": {"$in": sorted(request_ids)}}).to_list(None)}
    await book.add_names(db, addresses)
    ctx = _Ctx(book, lots, reqs)
    items = []
    for ev in events:
        try:
            item = _describe(ev, ctx)
        except (KeyError, IndexError, ValueError):  # an event whose ABI changed shape: skip it, don't fail the feed
            item = None
        if item is not None:
            items.append(item)
    return items


async def user_event_filter(db: AsyncDatabase, chain_id: int, address: str) -> dict:
    """Events that concern a wallet: it took part, or they touch its lots, mint requests or warehouses."""
    owned = await db.lots.find({"chainId": chain_id, "owner": address}, {"tokenId": 1, "warehouseId": 1, "state": 1}).to_list(None)
    request_ids = await db.mint_requests.distinct("requestId", {"chainId": chain_id, "owner": address})
    token_ids = [d["tokenId"] for d in owned]
    warehouse_ids = sorted({d["warehouseId"] for d in owned if d.get("state") != "BURNED" and d.get("warehouseId")})
    return {
        "chainId": chain_id,
        "$or": [
            {"addresses": address},
            {"tokenId": {"$in": token_ids}},
            {"contract": "MintingController", "args.requestId": {"$in": request_ids}},
            {"contract": "AttestationRegistry", "args.subjectType": 0, "args.subject": {"$in": request_ids}},
            {"contract": "WarehouseRegistry", "event": {"$in": ["WarehouseFrozen", "WarehouseUnfrozen"]}, "args.id": {"$in": warehouse_ids}},
        ],
    }


def lot_event_filter(chain_id: int, token_id: int, request_id: int | None) -> dict:
    ors: list[dict] = [
        {"tokenId": token_id},
        {"contract": "AttestationRegistry", "args.subjectType": 1, "args.subject": token_id},
    ]
    if request_id is not None:
        ors += [
            {"contract": "MintingController", "args.requestId": request_id},
            {"contract": "AttestationRegistry", "args.subjectType": 0, "args.subject": request_id},
        ]
    return {"chainId": chain_id, "$or": ors}
