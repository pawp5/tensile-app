"""Tokenization (F-1) shared by the API and the worker: evidence kinds, live controller parameters,
revert decoding, the seven-step progress of a mint request and draft presentation.

Order of the steps follows the design: details -> evidence -> automated review -> inspection ->
warehouse custody -> reserve confirmation -> mint passport. On-chain, review / inspection / custody may land
in any order; finalizeMint needs all of them plus reserve coverage.
"""
import asyncio
import time
from datetime import datetime, timedelta
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.core.catalog import Catalog
from app.core.chains import ChainContext
from app.core.evidence import draft_id_from_uri, file_out, oid
from app.core.present import Book
from app.core.schemas import MintDraftOut, MintStepOut, ReserveCheckOut
from app.core.txsender import error_selectors

MIN_LOT_KG = 5_000
# kind -> (title, detail, required, multiple)
DOC_KINDS: dict[str, tuple[str, str, bool, bool]] = {
    "certificate": ("Certificate of analysis", "Shows the certificate identifier, brand and grade", True, False),
    "receipt": ("Warehouse receipt", "Issued by the warehouse for this material", True, False),
    "weighbridge": ("Weighbridge tickets", "Net weights per bundle", False, True),
    "photos": ("Bundle photographs", "Tags and markings visible", False, True),
    "mill": ("Smelter mill certificate", "Optional", False, False),
}
REQUIRED_DOCS = tuple(k for k, v in DOC_KINDS.items() if v[2])
STEP_LABELS = (
    ("details", "Material details"), ("evidence", "Evidence"), ("review", "Automated review"), ("inspection", "Inspection"),
    ("custody", "Warehouse custody"), ("reserve", "Reserve confirmation"), ("mint", "Mint passport"),
)
FINALIZE_MESSAGES = {
    "MissingCustody": "Waiting for the warehouse to confirm custody",
    "MissingInspection": "Waiting for the inspection attestation",
    "AiReviewInsufficient": "The automated review is below the threshold; a risk admin must override or reject",
    "WarehouseUnavailable": "The warehouse is frozen or inactive",
    "ReserveInsufficient": "The warehouse reserve does not cover this lot",
    "NotVerified": "The owner's verification has lapsed",
    "RequestExpired": "The request has expired",
    "BadStatus": "The request is closed",
}
INSPECTION_CONDITIONS = {
    "sealsIntact": "Seals intact before inspection",
    "bundlesMatch": "Bundles match receipt marks",
    "noDamage": "No visible contamination or damage",
    "storedDry": "Stored under cover, dry floor",
}
ASSAY_ELEMENT = {"CU": "Cu", "AL": "Al", "NI": "Ni", "ZN": "Zn"}


# ------------------------------------------------------------------ live controller parameters


_params: dict[int, tuple[float, dict[str, Any]]] = {}


async def controller_params(chain: ChainContext) -> dict[str, Any]:
    """minAiScore, requestTTL, mintFee, feeToken: read from MintingController, cached for 5 minutes."""
    hit = _params.get(chain.chain_id)
    if hit and time.monotonic() - hit[0] < 300:
        return hit[1]
    mc = chain.contract("MintingController")
    score, ttl, fee, token = await asyncio.gather(
        chain.call(mc.functions.minAiScore()), chain.call(mc.functions.requestTTL()),
        chain.call(mc.functions.mintFee()), chain.call(mc.functions.feeToken()),
    )
    value = {"minAiScore": int(score), "requestTTL": int(ttl), "mintFee": int(fee), "feeToken": None if int(token, 16) == 0 else token}
    _params[chain.chain_id] = (time.monotonic(), value)
    return value


def revert_name(exc: Exception, chain: ChainContext) -> tuple[str, str]:
    """(error name, readable message) for a reverted eth_call: custom errors by selector, else the reason string."""
    data = getattr(exc, "data", None)
    if isinstance(data, dict):
        data = data.get("data")
    if isinstance(data, str) and data.startswith("0x") and len(data) >= 10:
        sig = error_selectors(chain.abis).get(data[:10].lower())
        if sig:
            name = sig.split("(")[0]
            return name, FINALIZE_MESSAGES.get(name, name)
    text = str(exc)
    reason = text.split("execution reverted:", 1)[-1].strip(" '\"") if "execution reverted" in text else text
    return reason[:80] or "Reverted", reason[:200] or "The transaction would revert"


async def simulate(chain: ChainContext, fn: Any, sender: str) -> tuple[str, str] | None:
    """None if the call would succeed from `sender`, else (error name, message)."""
    try:
        await fn.call({"from": sender})
        return None
    except Exception as exc:  # web3 raises ContractCustomError / ContractLogicError / ValueError for reverts
        return revert_name(exc, chain)


async def reserve_check(chain: ChainContext, warehouse: dict | None, warehouse_id: int, quantity_kg: int) -> ReserveCheckOut:
    guard, passport = chain.contract("ReserveGuard"), chain.contract("MaterialPassport")
    (reserve, fresh), outstanding, can_add = await asyncio.gather(
        chain.call(guard.functions.reserveOf(warehouse_id)),
        chain.call(passport.functions.outstandingKg(warehouse_id)),
        chain.call(guard.functions.canAdd(warehouse_id, quantity_kg)),
    )
    reserve, outstanding = int(reserve), int(outstanding)
    after = outstanding + quantity_kg
    return ReserveCheckOut(
        reserve_kg=reserve, outstanding_kg=outstanding, new_kg=quantity_kg,
        coverage_after=round(reserve / after, 4) if after else None, fresh=bool(fresh),
        frozen=bool((warehouse or {}).get("frozen")), can_add=bool(can_add), shortfall_kg=max(0, after - reserve),
        reported_at=(warehouse or {}).get("reportedAt"), operator_name=(warehouse or {}).get("operatorName"),
    )


# ------------------------------------------------------------------ drafts


def missing_docs(draft: dict[str, Any]) -> list[str]:
    have = {d["kind"] for d in draft.get("documents", [])}
    return [k for k in REQUIRED_DOCS if k not in have]


CLOSED_STATUSES = ("REJECTED", "CANCELLED", "EXPIRED")


async def live_cert_claims(db: AsyncDatabase, cert: str, *, exclude_id: Any, chain_id: int | None = None) -> int:
    """Other drafts holding this certificate: submitted (requestMint on its way), or requested with the request still
    open or minted. A cancelled, rejected or expired request frees its certificate (on-chain too), so it is not counted.
    Without chain_id every chain is searched (the review flags the same certificate tokenized on another chain)."""
    query: dict[str, Any] = {"certHash": cert, "status": {"$in": ["submitted", "requested"]}, "_id": {"$ne": exclude_id}}
    if chain_id is not None:
        query["chainId"] = chain_id
    count = 0
    async for other in db.mint_drafts.find(query, {"chainId": 1, "status": 1, "requestId": 1}):
        if other.get("status") == "requested" and other.get("requestId") is not None:
            req = await db.mint_requests.find_one({"chainId": other["chainId"], "requestId": int(other["requestId"])}, {"status": 1})
            if req is not None and req.get("status") in CLOSED_STATUSES:
                continue
        count += 1
    return count


def draft_out(doc: dict[str, Any], book: Book) -> MintDraftOut:
    material = book.catalog.materials.get(doc.get("material") or "")
    wid = doc.get("warehouseId")
    w = book.warehouses.get(wid) or {}
    qty = doc.get("quantityKg")
    price, haircut = book.price(doc.get("material"), wid) if wid else (None, 0)
    value = qty / 1000 * price if (qty and price) else None
    capacity = value * (1 - haircut / 10_000) * book.max_ltv if value is not None else None
    return MintDraftOut(
        id=str(doc["_id"]), chain_id=doc["chainId"], owner=doc["owner"], status=doc.get("status", "draft"),
        material=doc.get("material"), material_name=material.name if material else None, symbol=material.symbol if material else None,
        warehouse_id=wid, warehouse_code=w.get("code"), warehouse_name=w.get("name"), region=w.get("region"), place=w.get("place"),
        quantity_kg=qty, certificate_id=doc.get("certificateId"), receipt_no=doc.get("receiptNo"),
        documents=[file_out(d) for d in doc.get("documents", [])], missing=missing_docs(doc),
        cert_hash=doc.get("certHash"), evidence_uri=doc.get("evidenceUri"), request_id=doc.get("requestId"),
        indicative_value_usd=round(value, 2) if value is not None else None,
        borrow_capacity_usdc=round(capacity, 2) if capacity is not None else None,
        created_at=doc.get("createdAt"), updated_at=doc.get("updatedAt"), submitted_at=doc.get("submittedAt"),
    )


async def draft_for_request(db: AsyncDatabase, request: dict[str, Any]) -> dict[str, Any] | None:
    draft_id = draft_id_from_uri(request.get("evidenceURI"))
    if draft_id is None:
        return None
    return await db.mint_drafts.find_one({"_id": oid(draft_id), "chainId": request["chainId"]})


async def link_submitted_drafts(db: AsyncDatabase, chain_id: int) -> int:
    """Drafts whose requestMint has been indexed become 'requested' (with the request id)."""
    linked = 0
    async for draft in db.mint_drafts.find({"chainId": chain_id, "status": "submitted"}, {"evidenceUri": 1}):
        req = await db.mint_requests.find_one({"chainId": chain_id, "evidenceURI": draft.get("evidenceUri")}, {"requestId": 1})
        if req:
            await db.mint_drafts.update_one({"_id": draft["_id"]}, {"$set": {"status": "requested", "requestId": int(req["requestId"])}})
            linked += 1
    return linked


# ------------------------------------------------------------------ progress


def latest_by_kind(attestations: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for a in sorted(attestations, key=lambda a: int(a["index"])):
        out[a["kind"]] = a
    return out


def build_steps(
    request: dict[str, Any],
    *,
    draft: dict[str, Any] | None,
    atts: dict[str, dict[str, Any]],
    min_score: int,
    review_state: str | None,  # queued | running | failed | None (from the review job)
    frozen: bool,
    reserve: ReserveCheckOut | None,
) -> tuple[list[MintStepOut], str]:
    """The seven steps for a request, and the key of the current one."""
    status = request.get("status", "REQUESTED")
    created = request.get("createdAt")
    review, inspection, custody = atts.get("AI_REVIEW"), atts.get("INSPECTION"), atts.get("CUSTODY")
    states: dict[str, tuple[str, str | None, datetime | None]] = {}

    states["details"] = ("done", f"{int(request.get('quantityKg') or 0) / 1000:,.3f} t", created)
    if draft is not None:
        n = len(draft.get("documents", []))
        states["evidence"] = ("done", f"{n} document{'s' if n != 1 else ''} on record", draft.get("submittedAt") or created)
    else:
        states["evidence"] = ("done", "Evidence on record", created)

    if request.get("aiOverride"):
        states["review"] = ("done", "Overridden by risk", None)
    elif review is not None:
        score = int(review.get("score") or 0)
        waiting = " · awaiting risk review" if status == "REQUESTED" else ""
        states["review"] = ("done", f"Score {score} / 100", review.get("at")) if score >= min_score else (
            "failed", f"Score {score} below {min_score}{waiting}", review.get("at"))
    elif review_state == "failed":
        states["review"] = ("failed", "Review could not be posted", None)
    else:
        states["review"] = ("waiting", "Reviewing documents" if review_state in ("queued", "running") else "Starts automatically", None)

    if inspection is not None:
        states["inspection"] = ("done", "Attested", inspection.get("at"))
    elif status == "REJECTED":
        states["inspection"] = ("failed", "Rejected", request.get("updatedAt"))
    else:
        states["inspection"] = ("blocked" if frozen else "waiting", "Paused: warehouse frozen" if frozen else "Awaiting inspector", None)

    if request.get("custodyAt") or custody is not None:
        states["custody"] = ("done", "Confirmed", request.get("custodyAt") or (custody or {}).get("at"))
    else:
        states["custody"] = ("waiting", "After inspection", None)

    if status == "FINALIZED":
        states["reserve"] = ("done", "Covered at mint", request.get("finalizedAt"))
    elif reserve is None:
        states["reserve"] = ("waiting", "Checked before minting", None)
    elif reserve.can_add:
        cov = f"{reserve.coverage_after * 100:.2f}% after mint" if reserve.coverage_after is not None else "Covered"
        states["reserve"] = ("done", cov, None)
    else:
        states["reserve"] = ("blocked", f"Short by {reserve.shortfall_kg:,} kg" if reserve.fresh and not reserve.frozen else "Reserve feed stale or warehouse frozen", None)

    if status == "FINALIZED":
        states["mint"] = ("done", f"Lot {request.get('tokenId')}", request.get("finalizedAt"))
    elif status in ("REJECTED", "CANCELLED", "EXPIRED"):
        states["mint"] = ("failed", status.capitalize(), request.get("updatedAt"))
    else:
        states["mint"] = ("waiting", "When every check passes", None)

    current = next((k for k, _ in STEP_LABELS if states[k][0] != "done"), "mint")
    steps = []
    for key, label in STEP_LABELS:
        state, detail, at = states[key]
        if key == current and state == "waiting" and status == "REQUESTED":
            state = "current"
        steps.append(MintStepOut(key=key, label=label, state=state, detail=detail, at=at))
    return steps, current


def expires_at(request: dict[str, Any], ttl_seconds: int) -> datetime | None:
    created = request.get("createdAt")
    return created + timedelta(seconds=ttl_seconds) if created else None


def title_for(request_or_draft: dict[str, Any], catalog: Catalog) -> str:
    material = catalog.materials.get(request_or_draft.get("material") or "")
    qty = int(request_or_draft.get("quantityKg") or 0)
    what = material.family.lower() if material else "material"
    return f"Tokenize {qty / 1000:,.3f} t {what}"
