"""Reports behind attestations (collection `reports`), joined to the indexed attestation by dataHash.

kind AI_REVIEW / CUSTODY: written by the worker, which sends the attestation itself.
kind INSPECTION / REINSPECTION: sealed by an inspector through the API, then signed from their own wallet.
"""
from datetime import datetime
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.core.evidence import file_out
from app.core.minting import ASSAY_ELEMENT, INSPECTION_CONDITIONS
from app.core.present import Book, lot_display_id, request_display_id
from app.core.schemas import ConditionOut, CustodyOut, InspectionReportOut, ReviewCheckOut, ReviewOut


async def reports_by_hash(db: AsyncDatabase, chain_id: int, hashes: list[str]) -> dict[str, dict[str, Any]]:
    wanted = sorted({h for h in hashes if h})
    if not wanted:
        return {}
    docs = await db.reports.find({"chainId": chain_id, "dataHash": {"$in": wanted}}).to_list(None)
    return {d["dataHash"]: d for d in docs}


async def latest_job(db: AsyncDatabase, chain_id: int, kind: str, request_id: int) -> dict[str, Any] | None:
    return await db.jobs.find_one({"chainId": chain_id, "kind": kind, "payload.requestId": request_id}, sort=[("createdAt", -1)])


def review_out(att: dict | None, report: dict | None, job: dict | None, *, threshold: int, override: bool, override_by: str | None) -> ReviewOut | None:
    if att is None and report is None and job is None:
        return None
    body = (report or {}).get("body") or {}
    score = int(att["score"]) if att is not None else body.get("score")
    if att is not None:
        status = "posted"
    elif (report or {}).get("status") == "failed" or (job or {}).get("status") == "failed":
        status = "failed"
    elif (job or {}).get("status") == "running" or (report or {}).get("status") == "posting":
        status = "running"
    else:
        status = "queued"
    return ReviewOut(
        status=status,
        score=score,
        threshold=threshold,
        passed=(score >= threshold) if score is not None else None,
        checks=[ReviewCheckOut(**c) for c in body.get("checks", [])],
        documents_reviewed=len(body.get("documents", [])),
        report_id=str(report["_id"]) if report else None,
        data_hash=(att or report or {}).get("dataHash"),
        uri=(att or report or {}).get("uri"),
        tx_hash=(att or {}).get("tx") or (report or {}).get("txHash"),
        started_at=(job or {}).get("startedAt") or (report or {}).get("createdAt"),
        finished_at=(att or {}).get("at"),
        error=((report or {}).get("error") or (job or {}).get("error")) if status == "failed" else None,
        override=override,
        override_by=override_by,
    )


def inspection_out(report: dict[str, Any], att: dict | None, book: Book, *, rejected: bool = False) -> InspectionReportOut:
    body = report.get("body") or {}
    subject_type, subject = report["subjectType"], int(report["subject"])
    if subject_type == "REQUEST":
        ref = request_display_id(subject)
    else:
        ref = lot_display_id(subject, book.symbol(body.get("material")))
    declared, measured = body.get("declaredKg"), body.get("measuredKg")
    variance = round((measured - declared) / declared * 100, 3) if declared and measured is not None else None
    conditions = body.get("conditions") or {}
    if att is not None:
        status = "attested"
    elif body.get("outcome") == "fail":
        status = "rejected" if rejected else ("failed" if subject_type == "LOT" else "sealed")
    else:
        status = "sealed"
    symbol = book.symbol(body.get("material"))
    return InspectionReportOut(
        id=str(report["_id"]),
        chain_id=report["chainId"],
        kind=report["kind"],
        subject_type=subject_type,
        subject=subject,
        ref=ref,
        outcome=body.get("outcome", "pass"),
        status=status,
        inspector=report.get("createdBy", ""),
        inspector_name=(body.get("inspector") or {}).get("name"),
        organisation=(body.get("inspector") or {}).get("organisation"),
        licence=(body.get("inspector") or {}).get("licence"),
        declared_kg=declared,
        measured_kg=measured,
        variance_pct=variance,
        bundles_declared=body.get("bundlesDeclared"),
        bundles_counted=body.get("bundlesCounted"),
        assay_pct=body.get("assayPct"),
        assay_element=ASSAY_ELEMENT.get(symbol or ""),
        seals=body.get("seals"),
        inspected_at=_dt(body.get("inspectedAt")),
        conditions=[ConditionOut(key=k, label=label, ok=bool(conditions.get(k))) for k, label in INSPECTION_CONDITIONS.items() if k in conditions],
        notes=body.get("notes"),
        reason=body.get("reason"),
        files=[file_out(f) for f in report.get("files", [])],
        data_hash=report["dataHash"],
        uri=report["uri"],
        tx_hash=(att or {}).get("tx"),
        attested_at=(att or {}).get("at"),
        created_at=report["createdAt"],
    )


def custody_out(request: dict[str, Any], att: dict | None, report: dict | None, job: dict | None, book: Book) -> CustodyOut:
    wid = request.get("warehouseId")
    w = book.warehouses.get(wid) or {}
    body = (report or {}).get("body") or {}
    if request.get("custodyAt") or att is not None:
        status = "confirmed"
    elif (job or {}).get("status") == "failed":
        status = "failed"
    elif job is not None and job.get("status") in ("queued", "running"):
        status = "queued"
    else:
        status = "waiting"
    return CustodyOut(
        status=status,
        at=request.get("custodyAt") or (att or {}).get("at"),
        by=request.get("custodyBy") or (att or {}).get("attestor"),
        operator_name=w.get("operatorName"),
        warehouse_code=w.get("code"),
        warehouse_name=w.get("name"),
        receipt_no=body.get("receiptNo"),
        seals=body.get("seals"),
        report_id=str(report["_id"]) if report else None,
        data_hash=(att or report or {}).get("dataHash"),
        uri=(att or report or {}).get("uri"),
        tx_hash=(att or {}).get("tx"),
        error=(job or {}).get("error") if status == "failed" else None,
    )


def _dt(value: Any) -> datetime | None:
    if value is None or isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
