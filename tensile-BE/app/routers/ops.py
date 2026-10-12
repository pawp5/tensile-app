"""Operations console work queue: one row per thing staff may need to act on.

Each stage adds its sources here (mint reviews, redemptions, disputes, loans...).
"""
import asyncio
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter

from app.core.authz import StaffUser
from app.core.deps import CatalogDep, Chain, Db
from app.core.evm import as_int
from app.core.minting import controller_params, latest_by_kind
from app.core.present import Book, lot_display_id, request_display_id, short
from app.core.schemas import OpsQueueOut, OpsRowOut
from app.routers.inspections import close_finished_orders, due_lots

router = APIRouter(tags=["ops"])
RECENT = timedelta(days=14)


def _id_ref(address: str) -> str:
    return "ID-" + address[2:6].upper()


def _t(kg) -> str:
    return f"{as_int(kg) / 1000:,.3f} t"


async def _identity_rows(db, now: datetime) -> list[OpsRowOut]:
    rows: list[OpsRowOut] = []
    apps = await db.kyc_applications.find(
        {"$or": [{"status": "in_review"}, {"status": {"$in": ["approved", "rejected"]}, "reviewedAt": {"$gte": now - RECENT}}]}
    ).to_list(None)
    failed_jobs = {
        str(j["_id"]) for j in await db.jobs.find({"kind": "kyc.set_identity", "status": "failed", "finishedAt": {"$gte": now - RECENT}}, {"_id": 1}).to_list(None)
    }
    for a in apps:
        name, tier, href = a.get("orgName") or short(a["address"]), a.get("approvedTier") or a.get("tier"), f"/onboarding/review/{a['address']}"
        if a["status"] == "in_review":
            flagged = a.get("screening") == "flagged"
            rows.append(OpsRowOut(
                module="Identity", ref=_id_ref(a["address"]), subject=f"{name} · Tier {tier} verification" + (" · screening flagged" if flagged else ""),
                warehouse="—", state="IN REVIEW", tone="t-warning" if flagged else "t-info", queue="attention" if flagged else "pending",
                since=a.get("submittedAt"), who="Compliance", action="Review", href=href,
            ))
        elif a["status"] == "approved":
            jobs = ((a.get("approval") or {}).get("jobs") or {}).values()
            if any(j in failed_jobs for j in jobs):
                rows.append(OpsRowOut(
                    module="Identity", ref=_id_ref(a["address"]), subject=f"{name} · on-chain attestation failed", warehouse="—",
                    state="FAILED", tone="t-danger", queue="attention", since=a.get("reviewedAt"), who="Compliance", action="Review", href=href,
                ))
            else:
                rows.append(OpsRowOut(
                    module="Identity", ref=_id_ref(a["address"]), subject=f"{name} · Tier {tier} verified", warehouse="—",
                    state="VERIFIED", tone="t-success", queue="completed", since=a.get("reviewedAt"), who=short(a.get("reviewedBy")), action="View", href=href,
                ))
        else:
            rows.append(OpsRowOut(
                module="Identity", ref=_id_ref(a["address"]), subject=f"{name} · rejected: {a.get('rejectReason') or ''}".rstrip(": "), warehouse="—",
                state="REJECTED", tone="t-neutral", queue="completed", since=a.get("reviewedAt"), who=short(a.get("reviewedBy")), action="View", href=href,
            ))
    return rows


async def _inspection_rows(db, cid: int, catalog, book: Book, now: datetime) -> list[OpsRowOut]:
    await close_finished_orders(db, cid)
    orders, due, failed = await asyncio.gather(
        db.reinspection_orders.find({"chainId": cid, "$or": [{"status": "open"}, {"doneAt": {"$gte": now - RECENT}}]}).to_list(None),
        due_lots(db, cid, catalog, now),
        db.reports.find({"chainId": cid, "kind": "REINSPECTION", "outcome": "fail", "createdAt": {"$gte": now - RECENT}}).to_list(None),
    )
    lot_ids = sorted({int(o["tokenId"]) for o in orders} | {int(f["subject"]) for f in failed})
    lots = {d["tokenId"]: d for d in await db.lots.find({"chainId": cid, "tokenId": {"$in": lot_ids}}).to_list(None)}
    rows: list[OpsRowOut] = []

    def lot_ref(tid: int) -> tuple[str, str]:
        lot = lots.get(tid) or {}
        code = (book.warehouses.get(lot.get("warehouseId")) or {}).get("code") or "—"
        return lot_display_id(tid, book.symbol(lot.get("material"))), code

    ordered = set()
    for o in orders:
        tid = int(o["tokenId"])
        ref, code = lot_ref(tid)
        if o["status"] == "open":
            ordered.add(tid)
            late = o["dueAt"] < now
            rows.append(OpsRowOut(
                module="Inspections", ref=f"RI-{int(o['seq']):04d}", subject=f"Reinspect {ref} · {o['reason']}", warehouse=code,
                state="OVERDUE" if late else "ORDERED", tone="t-danger" if late else "t-info", queue="attention" if late else "pending",
                since=o["createdAt"], who="Inspectors", action="View", href=f"/lots/{tid}",
            ))
        else:
            rows.append(OpsRowOut(
                module="Inspections", ref=f"RI-{int(o['seq']):04d}", subject=f"Reinspect {ref} · {o['status']}", warehouse=code,
                state=o["status"].upper(), tone="t-success" if o["status"] == "done" else "t-neutral", queue="completed",
                since=o.get("doneAt"), who="Inspectors", action="View", href=f"/lots/{tid}",
            ))
    for lot in due:
        tid = int(lot["tokenId"])
        if tid in ordered or lot["dueAt"] >= now:
            continue
        ref = lot_display_id(tid, book.symbol(lot.get("material")))
        code = (book.warehouses.get(lot.get("warehouseId")) or {}).get("code") or "—"
        rows.append(OpsRowOut(
            module="Inspections", ref=ref, subject=f"Attestation stale since {lot['dueAt']:%Y-%m-%d} · lending paused", warehouse=code,
            state="STALE", tone="t-warning", queue="attention", since=lot["dueAt"], who="Inspectors", action="Order reinspection", href=f"/lots/{tid}",
        ))
    for f in failed:
        tid = int(f["subject"])
        ref, code = lot_ref(tid)
        reason = (f.get("body") or {}).get("reason") or "see report"
        rows.append(OpsRowOut(
            module="Inspections", ref=ref, subject=f"Reinspection failed · {reason}", warehouse=code, state="FAILED", tone="t-danger",
            queue="attention", since=f["createdAt"], who=book.label(f.get("createdBy")), action="Investigate", href=f"/lots/{tid}",
        ))
    return rows


@router.get("/chains/{chain_id}/ops/queue", response_model=OpsQueueOut)
async def ops_queue(chain: Chain, db: Db, catalog: CatalogDep, _: StaffUser) -> OpsQueueOut:
    cid, now = chain.chain_id, datetime.now(timezone.utc)
    book, expired_ids, requests, frozen_events = await asyncio.gather(
        Book.load(db, cid, catalog),
        db.identities.find({"chainId": cid, "revoked": {"$ne": True}, "protocol": {"$ne": True}, "expiresAt": {"$lt": now}}).to_list(None),
        db.mint_requests.find({"chainId": cid, "$or": [{"status": "REQUESTED"}, {"updatedAt": {"$gte": now - RECENT}}]}).to_list(None),
        db.events.find({"chainId": cid, "contract": "WarehouseRegistry", "event": "WarehouseFrozen"}).sort("blockNumber", -1).limit(100).to_list(None),
    )
    await book.add_names(db, [i["account"] for i in expired_ids] + [r.get("owner") for r in requests])
    rows = await _identity_rows(db, now)

    for ident in expired_ids:
        name = book.label(ident["account"])
        rows.append(OpsRowOut(
            module="Identity", ref=_id_ref(ident["account"]), subject=f"{name} · Tier {ident.get('tier')} verification expired", warehouse="—",
            state="EXPIRED", tone="t-neutral", queue="attention", since=ident.get("expiresAt"), who="Compliance", action="Notify",
            href=f"/onboarding/review/{ident['account']}",
        ))

    frozen_at = {}
    for ev in frozen_events:
        frozen_at.setdefault(as_int(ev["args"].get("id")), ev.get("timestamp"))
    for wid, w in sorted(book.warehouses.items()):
        code = w.get("code") or f"WH-{wid}"
        reserve, outstanding = as_int(w.get("reserveKg")), as_int(w.get("outstandingKg"))
        if w.get("frozen"):
            held = f"coverage {reserve / outstanding * 100:.2f}% · {reserve:,} of {outstanding:,} kg" if outstanding else f"reserve {reserve:,} kg · nothing tokenized"
            rows.append(OpsRowOut(
                module="Reserve feeds", ref=code, subject=f"{(w.get('frozenReason') or 'Frozen').replace('_', ' ').capitalize()} · {held}",
                warehouse=code, state="FROZEN", tone="t-solid-danger", queue="frozen", since=frozen_at.get(wid), who=w.get("operatorName") or "—",
                action="Investigate", href=f"/reserve?wh={code}",
            ))
        elif not w.get("fresh"):
            reported = w.get("reportedAt")
            age = f"No attestation for {int((now - reported).total_seconds() // 3600)} h (limit 24 h)" if reported else "No reserve report yet"
            rows.append(OpsRowOut(
                module="Reserve feeds", ref=code, subject=age, warehouse=code, state="STALE", tone="t-warning", queue="attention",
                since=reported, who=w.get("operatorName") or "—", action="Contact operator", href=f"/reserve?wh={code}",
            ))

    rids = [int(r["requestId"]) for r in requests]
    atts = await db.attestations.find({"chainId": cid, "subjectType": "REQUEST", "subject": {"$in": rids}}).to_list(None)
    by_request: dict[int, list] = {}
    for a in atts:
        by_request.setdefault(int(a["subject"]), []).append(a)
    try:
        min_score = (await controller_params(chain))["minAiScore"]
    except Exception:
        min_score = 70
    for r in requests:
        rid, wid = int(r["requestId"]), r.get("warehouseId")
        code = (book.warehouses.get(wid) or {}).get("code") or f"WH-{wid}"
        mat = (catalog.materials.get(r.get("material") or "") or None)
        what = f"{_t(r.get('quantityKg'))} {(mat.family if mat else 'material').lower()}"
        status, href, latest = r.get("status"), f"/tokenize?request={rid}", latest_by_kind(by_request.get(rid, []))
        if status == "REQUESTED":
            review = latest.get("AI_REVIEW")
            if review is not None and int(review.get("score") or 0) < min_score and not r.get("aiOverride"):
                rows.append(OpsRowOut(
                    module="AI reviews", ref=request_display_id(rid), subject=f"{what} · review score {int(review['score'])} below {min_score}",
                    warehouse=code, state="REVIEW LOW", tone="t-warning", queue="attention", since=review.get("at"),
                    who="Risk", action="Override or reject", href=href,
                ))
                continue
            if "INSPECTION" not in latest:
                step = "awaiting review and inspection" if review is None else "awaiting inspection"
            elif not (r.get("custodyAt") or "CUSTODY" in latest):
                step = "inspected · awaiting custody"
            else:
                step = "ready to mint"
            rows.append(OpsRowOut(
                module="Mint requests", ref=request_display_id(rid), subject=f"{what} · {step}", warehouse=code, state="REQUESTED",
                tone="t-info", queue="frozen" if (book.warehouses.get(wid) or {}).get("frozen") else "pending", since=r.get("createdAt"),
                who=book.label(r.get("owner")), action="View", href=href,
            ))
        else:
            done = status == "FINALIZED"
            rows.append(OpsRowOut(
                module="Mint requests", ref=request_display_id(rid), subject=f"{what} · {status.lower()}", warehouse=code, state=status,
                tone="t-success" if done else "t-neutral", queue="completed" if done else "expired", since=r.get("updatedAt"),
                who=book.label(r.get("owner")), action="View", href=href,
            ))

    rows += await _inspection_rows(db, cid, catalog, book, now)
    rows.sort(key=lambda r: r.since or now, reverse=True)
    return OpsQueueOut(chain_id=cid, rows=rows)
