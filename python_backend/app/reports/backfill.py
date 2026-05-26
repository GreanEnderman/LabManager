"""Backfill missing scheduled reports after downtime."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any
from uuid import uuid4

import psycopg.rows

from app.db.postgres import get_db_connection
from app.email import EmailService
from app.reports.generator import generate_daily_report, generate_weekly_report
from app.reports.presentation import build_report_from_result, render_report_html


async def _report_exists(report_type: str, metadata_filters: dict[str, str]) -> bool:
    conditions = ["report_type = %s"]
    params: list[Any] = [report_type]
    for key, value in metadata_filters.items():
        conditions.append(f"metadata->>%s = %s")
        params.extend([key, value])

    async with get_db_connection() as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute(
                f"SELECT 1 FROM ai_reports WHERE {' AND '.join(conditions)} LIMIT 1",
                tuple(params),
            )
            return await cur.fetchone() is not None


async def _persist_report(report: dict[str, Any]) -> None:
    from psycopg.types.json import Json

    async with get_db_connection() as conn:
        await conn.execute(
            """
            INSERT INTO ai_reports (id, report_type, title, summary, highlights, created_at, metadata)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (
                report["id"],
                report["type"],
                report["title"],
                report["summary"],
                Json(report.get("highlights") or []),
                report["createdAt"],
                Json(report.get("metadata") or {}),
            ),
        )
        await conn.commit()


async def _deliver_report(report: dict[str, Any]) -> dict[str, Any]:
    from app.api.ai_compat import deliver_report_email

    return deliver_report_email(
        report,
        actor={"id": "system", "name": "System", "type": "system"},
        trigger_mode="auto",
    )


async def backfill_missing_reports(today: date | None = None) -> list[dict[str, Any]]:
    """Generate and deliver missing reports for the last completed periods."""
    today = today or date.today()
    generated: list[dict[str, Any]] = []

    yesterday = today - timedelta(days=1)
    if not await _report_exists("daily", {"date": yesterday.isoformat()}):
        run_id = f"report-{uuid4()}"
        async with get_db_connection() as conn:
            daily = await generate_daily_report(conn, yesterday, "system-backfill", run_id)
        daily_result = daily.model_dump(mode="json") if hasattr(daily, "model_dump") else dict(daily)
        daily_report = build_report_from_result(run_id, daily_result)
        await _persist_report(daily_report)
        delivery_record = await _deliver_report(daily_report)
        generated.append({"report": daily_report, "deliveryRecord": delivery_record})

    days_since_monday = today.weekday()
    last_monday = today - timedelta(days=days_since_monday + 7)
    last_sunday = last_monday + timedelta(days=6)
    if not await _report_exists(
        "weekly",
        {"start_date": last_monday.isoformat(), "end_date": last_sunday.isoformat()},
    ):
        run_id = f"report-{uuid4()}"
        async with get_db_connection() as conn:
            weekly = await generate_weekly_report(conn, last_monday, last_sunday, "system-backfill", run_id)
        weekly_result = weekly.model_dump(mode="json") if hasattr(weekly, "model_dump") else dict(weekly)
        weekly_report = build_report_from_result(run_id, weekly_result)
        await _persist_report(weekly_report)
        delivery_record = await _deliver_report(weekly_report)
        generated.append({"report": weekly_report, "deliveryRecord": delivery_record})

    return generated
