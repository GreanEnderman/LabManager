"""Scheduled report generation tasks."""

import json
from datetime import date, timedelta
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from uuid import uuid4

from app.tasks.celery_app import celery_app
from app.core.logging import get_logger

logger = get_logger(__name__)
_REPORT_DELIVERY_STATE_PATH = Path(".tmp/report-delivery-state.json")


def _risk_count(potential_risks: dict, key: str) -> int:
    value = potential_risks.get(key)
    return len(value) if isinstance(value, list) else 0


def _format_report_email(
    report_type: str,
    report: dict,
    *,
    report_url: str | None = None,
    attachment_names: list[str] | None = None,
) -> tuple[str, str]:
    title = f"LabManager {report_type} report"
    metrics = report.get("metrics") or {}
    potential_risks = metrics.get("potential_risks") or {}
    summary = report.get("summary") or (
        f"{report.get('task_completions', 0)} tasks completed, "
        f"{report.get('approvals', 0)} approvals processed."
    )
    risk_summary = [
        f"Near low stock: {_risk_count(potential_risks, 'near_low_stock')}",
        f"Near maintenance due: {_risk_count(potential_risks, 'near_maintenance_due')}",
        f"High fault frequency: {_risk_count(potential_risks, 'high_fault_frequency')}",
    ]
    links_html = (
        f'<p><a href="{escape(report_url)}">Open report in LabManager</a></p>'
        if report_url
        else "<p>Report link: not configured.</p>"
    )
    attachments_html = (
        "<ul>" + "".join(f"<li>{escape(name)}</li>" for name in attachment_names or []) + "</ul>"
        if attachment_names
        else "<p>Attachments: none.</p>"
    )
    body = f"""
    <h2>{title}</h2>
    <h3>Summary</h3>
    <p>{escape(str(summary))}</p>
    <h3>Key risks</h3>
    <ul>{''.join(f'<li>{escape(item)}</li>' for item in risk_summary)}</ul>
    <p>Task completions: {report.get("task_completions", 0)}</p>
    <p>Approvals: {report.get("approvals", 0)}</p>
    <h3>Task status</h3>
    <pre>{escape(str(metrics.get("task_status_distribution", {})))}</pre>
    <h3>Inventory changes</h3>
    <pre>{escape(str(metrics.get("inventory_changes", {})))}</pre>
    <h3>Potential risk details</h3>
    <pre>{escape(str(potential_risks))}</pre>
    <h3>Links</h3>
    {links_html}
    <h3>Attachments</h3>
    {attachments_html}
    """
    return title, body


def _build_report_url(report_type: str, result: dict) -> str | None:
    from app.core.config import get_settings

    settings = get_settings()
    if not settings.supervisor_report_base_url:
        return None
    task_id = result.get("task_id") or result.get("run_id")
    suffix = f"?reportType={report_type}"
    if task_id:
        suffix += f"&taskId={task_id}"
    return f"{settings.supervisor_report_base_url.rstrip('/')}/ai-workbench/reports{suffix}"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _load_delivery_state() -> dict:
    if not _REPORT_DELIVERY_STATE_PATH.exists():
        return {"mappings": [], "configs": [], "records": []}
    try:
        return json.loads(_REPORT_DELIVERY_STATE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.warning("Unable to read report delivery state from %s", _REPORT_DELIVERY_STATE_PATH)
        return {"mappings": [], "configs": [], "records": []}


def _save_delivery_state(state: dict) -> None:
    _REPORT_DELIVERY_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _REPORT_DELIVERY_STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def _select_delivery_mapping(state: dict, report_type: str) -> dict | None:
    mappings = state.get("mappings") or []
    configs = state.get("configs") or []
    enabled_configs = [
        config
        for config in reversed(configs)
        if config.get("enabled", True) and config.get("reportType") == report_type
    ]
    for config in enabled_configs:
        mapping = next(
            (
                item
                for item in reversed(mappings)
                if item.get("enabled", True)
                and item.get("scopeType") == config.get("scopeType")
                and item.get("scopeId") == config.get("scopeId")
            ),
            None,
        )
        if mapping:
            return mapping
    return next((item for item in reversed(mappings) if item.get("enabled", True)), None)


def _send_via_delivery_mappings(report_type: str, result: dict) -> bool:
    from app.email import EmailService
    from app.reports.presentation import build_report_from_result, render_report_html

    report_result = result.get("result")
    if not isinstance(report_result, dict):
        return False

    state = _load_delivery_state()
    report = build_report_from_result(str(result.get("task_id") or uuid4()), report_result)
    if any(
        record.get("reportId") == report["id"] and record.get("triggerMode") == "auto"
        for record in state.get("records", [])
    ):
        return True

    mapping = _select_delivery_mapping(state, report_type)
    if not mapping:
        return False

    recipient_email = mapping.get("recipientEmail")
    recipient_name = mapping.get("recipientName") or "Supervisor"
    status = "success"
    error_message = None
    if not recipient_email:
        status = "failed"
        error_message = "No report delivery recipient configured."
        recipient_email = ""
    else:
        try:
            sent = EmailService().send_email(
                recipient_email,
                f"LabManager 报告：{report['title']}",
                render_report_html(report),
            )
            if not sent:
                status = "failed"
                error_message = "SMTP not configured; email was logged locally only."
        except Exception as exc:
            status = "failed"
            error_message = str(exc)

    now = _utc_now()
    record = {
        "id": f"delivery-{uuid4()}",
        "reportId": report["id"],
        "reportTitle": report["title"],
        "reportType": report["type"],
        "recipientEmail": recipient_email,
        "recipientName": recipient_name,
        "channel": "email",
        "status": status,
        "errorMessage": error_message,
        "triggeredBy": {"id": "system", "name": "System", "type": "system"},
        "triggerMode": "auto",
        "sentAt": now,
        "createdAt": now,
    }
    state.setdefault("records", []).insert(0, record)
    _save_delivery_state(state)
    logger.info(
        "Scheduled %s report delivery recorded: report_id=%s status=%s recipient=%s",
        report_type,
        report["id"],
        status,
        recipient_email,
    )
    return True


async def _generate_formal_report_like_button(
    report_type: str,
    report_date: date,
    *,
    operator: str = "system",
) -> dict:
    """Run the same formal report + delivery flow used by the report button."""
    from app.api.ai_compat import (
        deliver_report_email,
        generate_python_report_result,
        persist_formal_report,
    )
    from app.reports.presentation import build_report_from_result

    actor = {"id": operator, "name": "System", "type": "system"}
    run_id = f"report-{uuid4()}"
    result = await generate_python_report_result(report_type, report_date.isoformat(), operator, run_id)
    report = build_report_from_result(run_id, result)
    await persist_formal_report(report)
    delivery_record = deliver_report_email(report, actor=actor, trigger_mode="auto")
    return {
        "report": report,
        "deliveryRecords": [delivery_record],
        "deliveryStatus": delivery_record["status"],
    }


def _send_to_supervisor_if_configured(report_type: str, result: dict) -> None:
    from app.core.config import get_settings
    from app.email import EmailService

    settings = get_settings()
    delivery_audit = {
        "channel": "email",
        "report_type": report_type,
        "recipient": settings.supervisor_report_email,
        "status": "skipped",
        "reason": None,
    }
    result.setdefault("delivery_audit", []).append(delivery_audit)
    if not settings.supervisor_report_email:
        delivery_audit["reason"] = "supervisor_report_email_not_configured"
        logger.info("Supervisor report email is not configured; skipping %s report delivery", report_type)
        return

    report = result.get("result")
    if not isinstance(report, dict):
        delivery_audit["reason"] = "report_result_not_ready"
        logger.info("Scheduled %s report is queued asynchronously; delivery will wait for task completion", report_type)
        return

    subject, body = _format_report_email(report_type, report, report_url=_build_report_url(report_type, result))
    try:
        EmailService().send_email(settings.supervisor_report_email, subject, body)
    except Exception as exc:
        delivery_audit["status"] = "failed"
        delivery_audit["reason"] = str(exc)
        logger.error("%s report delivery to supervisor failed: %s", report_type, exc, exc_info=True)
        raise
    delivery_audit["status"] = "success"
    delivery_audit["subject"] = subject
    delivery_audit["reason"] = "sent_or_logged_by_email_service"
    logger.info("%s report delivered to supervisor %s", report_type, settings.supervisor_report_email)


@celery_app.task(name="reports.generate_daily")
def generate_daily_report_scheduled():
    """每天自动生成日报（测试模式：每 5 分钟）。"""
    import asyncio

    async def _run():
        today = date.today()
        yesterday = today - timedelta(days=1)

        logger.info(f"Generating scheduled daily report for {yesterday}")

        try:
            result = await _generate_formal_report_like_button("daily", yesterday)
            logger.info(
                "Daily report generated and delivery triggered: report_id=%s delivery_status=%s",
                result.get("report", {}).get("id"),
                result.get("deliveryStatus"),
            )
            return result

        except Exception as e:
            logger.error(f"Failed to generate daily report: {e}", exc_info=True)
            raise

    return asyncio.run(_run())


@celery_app.task(name="reports.generate_weekly")
def generate_weekly_report_scheduled():
    """每周自动生成周报（测试模式：每 10 分钟）。"""
    import asyncio

    async def _run():
        today = date.today()
        # 上周一到上周日
        days_since_monday = today.weekday()
        last_monday = today - timedelta(days=days_since_monday + 7)
        last_sunday = last_monday + timedelta(days=6)

        logger.info(f"Generating scheduled weekly report for {last_monday} to {last_sunday}")

        try:
            result = await _generate_formal_report_like_button("weekly", last_sunday)
            logger.info(
                "Weekly report generated and delivery triggered: report_id=%s delivery_status=%s",
                result.get("report", {}).get("id"),
                result.get("deliveryStatus"),
            )
            return result

        except Exception as e:
            logger.error(f"Failed to generate weekly report: {e}", exc_info=True)
            raise

    return asyncio.run(_run())
