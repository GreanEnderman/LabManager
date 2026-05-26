"""Frontend-compatible /api/ai gateway.

This module keeps the existing React HTTP gateway contract stable while the
Python backend grows capability-by-capability behind it.
"""

from __future__ import annotations

import base64
import json
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

import psycopg.rows
from fastapi import APIRouter, HTTPException, Request
from psycopg.types.json import Json

from app.approvals.models import AIApprovalDTO, CreateApprovalRequest, ProcessApprovalRequest
from app.approvals.service import ApprovalNotFoundError, ApprovalService
from app.api.import_batches import _mock_batches
from app.auth import DEFAULT_AUTH_TOKEN_TTL_SECONDS, LoginError, authenticate_user, decode_auth_token, encode_auth_token, list_users, user_to_response
from app.auth.service import find_user_by_id
from app.core.actor_converter import ActorConverter
from app.core.config import get_settings
from app.core.event_mappings import EventMappings
from app.db.postgres import get_db_connection
from app.gateway.routing import Capability, ServiceTarget, get_capability_routing_snapshot, get_capability_target, validate_routing_consistency
from app.graphs.supervisor import run_supervisor_graph_async, run_supervisor_preview_graph_async
from app.graphs.tools import (
    ApprovalServiceApprovalTool,
    InMemorySupervisorTools,
    SupervisorTools,
    TaskActionAuditLogTool,
    TaskServiceTaskTool,
    actor_to_formal,
    approval_dto_to_compat,
    task_dto_to_compat,
)
from app.inventory.service import InventoryService
from app.settings.models import AISettings, ApprovalStrategySettings, EmailDeliverySettings, SLASettings, ThresholdsSettings
from app.tasks.models import (
    AssignTaskRequest,
    ConfirmTaskCompletionReportRequest,
    ListTasksQuery,
    TaskActionDTO,
    TaskDetailDTO,
    UpdateTaskStatusRequest,
)
from app.tasks.service import TaskNotFoundError, TaskService
from app.llm.factory import create_llm_service
from app.pdf.exporter import export_to_pdf
from app.reports.dispatcher import submit_daily_report, submit_weekly_report
from app.reports.generator import generate_daily_report as generate_daily_report_data
from app.reports.generator import generate_weekly_report as generate_weekly_report_data
from app.reports.presentation import build_report_from_result, localize_report_presentation, render_report_html
from app.reports.status import get_task_result, get_task_status, list_completed_report_results

router = APIRouter(prefix="/api/ai", tags=["ai-compat"])


# Mock settings for compatibility layer
_settings = AISettings(
    thresholds=ThresholdsSettings(
        lowStockThreshold=10,
        maintenanceOverdueDays=30,
    ),
    approvalStrategy=ApprovalStrategySettings(
        requireApprovalForHighRisk=True,
        requireApprovalForCritical=True,
    ),
    sla=SLASettings(
        defaultTaskDueDays=7,
        highPriorityDueDays=3,
    ),
    emailDelivery=EmailDeliverySettings(),
    updatedAt=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def ok(data: Any) -> dict[str, Any]:
    return {"data": data, "error": None}


def capability_target(capability: Capability) -> str:
    return get_capability_target(capability).value


# Keep actor_from_payload as an alias for backward compatibility
def actor_from_payload(payload: dict[str, Any] | None) -> dict[str, str]:
    """Extract and normalize actor from request payload (delegates to ActorConverter)."""
    return ActorConverter.from_payload(payload)


def make_action(
    action_type: str,
    detail: str,
    actor: dict[str, str] | None = None,
    task_id: str | None = None,
    approval_id: str | None = None,
    from_status: str | None = None,
    to_status: str | None = None,
) -> dict[str, Any]:
    return {
        "id": f"action-{uuid4()}",
        "taskId": task_id,
        "approvalId": approval_id,
        "actionType": action_type,
        "fromStatus": from_status,
        "toStatus": to_status,
        "actor": actor or {"id": "system", "name": "System", "type": "system"},
        "reasonCodes": [],
        "detail": detail,
        "toolName": "python-ai-compat-gateway",
        "snapshot": {},
        "createdAt": utc_now(),
    }


_chemicals: list[dict[str, Any]] = [
    {
        "id": "chem-001",
        "name": "Sodium Chloride",
        "casNumber": "7647-14-5",
        "category": "Inorganic Salt",
        "spec": "AR",
        "currentQuantity": 5,
        "threshold": 10,
        "unit": "kg",
        "status": "low_stock",
        "labName": "Chemistry Lab",
        "ownerName": "Lab Manager",
        "imageDataUrl": None,
        "remark": "Common salt for general use",
        "updatedAt": "2026-05-01T00:00:00Z",
        "metadata": {},
    }
]

_equipment: list[dict[str, Any]] = [
    {
        "id": "equip-001",
        "name": "Centrifuge Model X",
        "vendor": "Lab Equipment Co.",
        "model": "CX-2000",
        "serialNumber": "SN123456",
        "status": "operational",
        "labName": "Biology Lab",
        "ownerName": "Lab Manager",
        "location": "Room 101",
        "purchaseDate": "2025-01-15",
        "lastMaintenanceAt": "2026-03-01T00:00:00Z",
        "nextMaintenanceAt": "2026-06-01T00:00:00Z",
        "maintenanceIntervalDays": 90,
        "imageDataUrl": None,
        "remark": "High-speed centrifuge",
        "updatedAt": "2026-05-01T00:00:00Z",
        "metadata": {},
    }
]

_tasks: list[dict[str, Any]] = [
    {
        "id": "task-compat-001",
        "eventId": "event-low-stock-chem-001",
        "type": "chemical_purchase",
        "title": "閲囪喘鑽搧",
        "summary": "Chemical inventory is below the configured threshold.",
        "recommendation": "Review recent usage and create a chemical purchase request.",
        "status": "open",
        "priority": "medium",
        "riskLevel": "medium",
        "sourceType": "chemical",
        "sourceId": "chem-001",
        "sourceName": _chemicals[0]["name"],
        "assigneeId": "ai-operator",
        "assigneeName": "AI Employee",
        "assigneeRole": "AI Employee",
        "requiresApproval": False,
        "dueAt": (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat().replace("+00:00", "Z"),
        "createdAt": "2026-05-01T00:00:00Z",
        "updatedAt": "2026-05-01T00:00:00Z",
        "closedAt": None,
        "metadata": {
            "evidence": [{"label": "Current quantity", "value": _chemicals[0]["currentQuantity"]}],
            "slaReminderCount": 0,
        },
    }
]
_approvals: list[dict[str, Any]] = []
_reports: list[dict[str, Any]] = [
    {
        "id": "report-compat-001",
        "type": "daily",
        "title": "Daily AI Work Summary",
        "summary": "AI task queue and approval activity are available for review.",
        "highlights": ["1 open task", "0 pending approvals"],
        "createdAt": "2026-05-01T00:00:00Z",
        "metadata": {"sections": [{"title": "Summary", "content": "Compatibility gateway report."}]},
    }
]
_actions: dict[str, list[dict[str, Any]]] = {
    "task-compat-001": [
        make_action(
            "task_created",
            "Compatibility seed task created.",
            task_id="task-compat-001",
        )
    ]
}
_delivery_mappings: list[dict[str, Any]] = []
_delivery_configs: list[dict[str, Any]] = []
_delivery_records: list[dict[str, Any]] = []
_supervisor_tools = InMemorySupervisorTools(tasks=_tasks, approvals=_approvals, actions=_actions)
_REPORT_DELIVERY_STATE_PATH = Path(".tmp/report-delivery-state.json")


def load_report_delivery_state() -> None:
    if not _REPORT_DELIVERY_STATE_PATH.exists():
        return
    try:
        state = json.loads(_REPORT_DELIVERY_STATE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    _delivery_mappings[:] = state.get("mappings", [])
    _delivery_configs[:] = state.get("configs", [])
    _delivery_records[:] = state.get("records", [])


def save_report_delivery_state() -> None:
    _REPORT_DELIVERY_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _REPORT_DELIVERY_STATE_PATH.write_text(
        json.dumps(
            {
                "mappings": _delivery_mappings,
                "configs": _delivery_configs,
                "records": _delivery_records,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def select_report_delivery_mapping(report: dict[str, Any]) -> dict[str, Any] | None:
    enabled_configs = [
        config
        for config in reversed(_delivery_configs)
        if config.get("enabled", True) and config.get("reportType") == report.get("type")
    ]
    for config in enabled_configs:
        mapping = next(
            (
                item
                for item in reversed(_delivery_mappings)
                if item.get("enabled", True)
                and item.get("scopeType") == config.get("scopeType")
                and item.get("scopeId") == config.get("scopeId")
            ),
            None,
        )
        if mapping:
            return mapping
    return next((item for item in reversed(_delivery_mappings) if item.get("enabled", True)), None)


def find_auto_delivery_record(report_id: str) -> dict[str, Any] | None:
    return next(
        (
            record
            for record in _delivery_records
            if record.get("reportId") == report_id and record.get("triggerMode") == "auto"
        ),
        None,
    )


def find_delivery_record(report_id: str) -> dict[str, Any] | None:
    return next((record for record in _delivery_records if record.get("reportId") == report_id), None)


def deliver_report_email(
    report: dict[str, Any],
    *,
    actor: dict[str, str] | None = None,
    trigger_mode: str = "manual",
    recipient_email: str | None = None,
    recipient_name: str | None = None,
) -> dict[str, Any]:
    load_report_delivery_state()
    now = utc_now()
    settings = get_settings()
    mapping = select_report_delivery_mapping(report)
    resolved_recipient_email = (
        recipient_email
        or (mapping or {}).get("recipientEmail")
        or settings.supervisor_report_email
    )
    resolved_recipient_name = (
        recipient_name
        or (mapping or {}).get("recipientName")
        or settings.supervisor_report_name
        or "Supervisor"
    )
    status = "success"
    error_message = None

    if not resolved_recipient_email:
        status = "failed"
        error_message = "No report delivery recipient configured."
        resolved_recipient_email = ""
    else:
        subject = f"LabManager 报告：{report['title']}"
        body = render_report_html(localize_report_presentation(report))
        try:
            from app.email import EmailService

            if not EmailService().send_email(resolved_recipient_email, subject, body):
                status = "failed"
                error_message = "SMTP not configured; email was logged locally only."
        except Exception as exc:
            status = "failed"
            error_message = str(exc)

    record = {
        "id": f"delivery-{uuid4()}",
        "reportId": report["id"],
        "reportTitle": report["title"],
        "reportType": report["type"],
        "recipientEmail": resolved_recipient_email,
        "recipientName": resolved_recipient_name,
        "channel": "email",
        "status": status,
        "errorMessage": error_message,
        "triggeredBy": actor or {"id": "system", "name": "System", "type": "system"},
        "triggerMode": trigger_mode,
        "sentAt": now,
        "createdAt": now,
    }
    _delivery_records.insert(0, record)
    save_report_delivery_state()
    return record


def ensure_report_delivery_attempt(report: dict[str, Any], actor: dict[str, str] | None = None) -> dict[str, Any] | None:
    load_report_delivery_state()
    if find_delivery_record(str(report.get("id"))):
        return None
    return deliver_report_email(
        report,
        actor=actor or {"id": "system", "name": "System", "type": "system"},
        trigger_mode="auto",
    )


def add_generated_report(task_id: str, result: dict[str, Any]) -> dict[str, Any]:
    existing = next((report for report in _reports if report.get("id") == task_id), None)
    if existing:
        return existing
    report = build_report_from_result(task_id, result)
    _reports.insert(0, report)
    return report


def maybe_auto_deliver_generated_report(
    task_id: str,
    result: dict[str, Any] | None,
    *,
    actor: dict[str, str] | None = None,
) -> dict[str, Any] | None:
    if not isinstance(result, dict):
        return None
    load_report_delivery_state()
    report = add_generated_report(task_id, result)
    existing = find_auto_delivery_record(report["id"])
    if existing:
        return existing
    return deliver_report_email(
        report,
        actor=actor or {"id": "system", "name": "System", "type": "system"},
        trigger_mode="auto",
    )


def _as_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _status_counts(items: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        status = str(item.get(key) or "unknown")
        counts[status] = counts.get(status, 0) + 1
    return counts


def _build_analysis_recommendations(
    *,
    low_stock_items: list[dict[str, Any]],
    overdue_equipment: list[dict[str, Any]],
    sla_risks: list[dict[str, Any]],
    pending_approvals: int,
) -> list[dict[str, Any]]:
    recommendations: list[dict[str, Any]] = []
    if low_stock_items:
        item = low_stock_items[0]
        recommendations.append({
            "id": "analysis-rec-low-stock",
            "severity": "critical" if _as_float(item.get("shortageRatio")) >= 0.5 else "warning",
            "category": "inventory",
            "title": "优先处理低库存物资",
            "reason": f"{item.get('name')} 当前库存低于安全阈值，可能影响实验连续性。",
            "suggestedAction": "复核近期出库记录，必要时创建补货任务并调整安全库存阈值。",
            "evidence": [
                {"label": "当前库存", "value": f"{item.get('currentQuantity')} {item.get('unit', '')}".strip()},
                {"label": "安全阈值", "value": str(item.get("minThreshold"))},
            ],
        })
    if overdue_equipment:
        item = overdue_equipment[0]
        recommendations.append({
            "id": "analysis-rec-maintenance",
            "severity": "warning",
            "category": "equipment",
            "title": "安排逾期设备维护",
            "reason": f"{item.get('name')} 维护已逾期 {item.get('overdueDays')} 天。",
            "suggestedAction": "安排设备管理员复核维护记录，补齐维护报告并更新下次维护日期。",
            "evidence": [
                {"label": "上次维护", "value": str(item.get("lastMaintenanceAt") or "未知")},
                {"label": "逾期天数", "value": str(item.get("overdueDays"))},
            ],
        })
    if sla_risks:
        item = sla_risks[0]
        recommendations.append({
            "id": "analysis-rec-sla",
            "severity": "critical" if item.get("riskLevel") in {"high", "critical"} else "warning",
            "category": "workflow",
            "title": "推动超时任务闭环",
            "reason": f"任务“{item.get('title')}”已超过计划时间。",
            "suggestedAction": "优先确认责任人和阻塞原因，必要时发起审批或升级处理。",
            "evidence": [
                {"label": "任务状态", "value": str(item.get("status"))},
                {"label": "风险等级", "value": str(item.get("riskLevel"))},
            ],
        })
    if pending_approvals:
        recommendations.append({
            "id": "analysis-rec-approval",
            "severity": "warning",
            "category": "approval",
            "title": "清理待审批积压",
            "reason": f"当前仍有 {pending_approvals} 项审批待处理，可能拖慢任务流转。",
            "suggestedAction": "按高风险、超时、创建时间排序处理审批，并记录审批意见。",
            "evidence": [{"label": "待审批数量", "value": str(pending_approvals)}],
        })
    return recommendations


def _build_memory_analysis_summary(window_days: int) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    low_stock_items = [
        {
            "id": item["id"],
            "name": item["name"],
            "currentQuantity": item.get("currentQuantity", 0),
            "minThreshold": item.get("threshold", 0),
            "shortageRatio": max(0, (_as_float(item.get("threshold")) - _as_float(item.get("currentQuantity"))) / max(_as_float(item.get("threshold")), 1)),
            "unit": item.get("unit", ""),
        }
        for item in _chemicals
        if _as_float(item.get("currentQuantity")) <= _as_float(item.get("threshold"))
    ]
    overdue_equipment: list[dict[str, Any]] = []
    for item in _equipment:
        last_maintenance = item.get("lastMaintenanceAt")
        overdue_days = 0
        if last_maintenance:
            try:
                parsed = datetime.fromisoformat(str(last_maintenance).replace("Z", "+00:00"))
                overdue_days = max(0, (now - parsed).days - 30)
            except ValueError:
                overdue_days = 0
        if overdue_days > 0:
            overdue_equipment.append({
                "id": item["id"],
                "name": item["name"],
                "lastMaintenanceAt": last_maintenance,
                "overdueDays": overdue_days,
                "status": item.get("status"),
            })
    active_tasks = [task for task in _tasks if task.get("status") in {"open", "in_progress", "pending_approval"}]
    pending_approvals = len([approval for approval in _approvals if approval.get("status") == "pending"])
    high_risk_tasks = len([task for task in active_tasks if task.get("riskLevel") in {"high", "critical"}])
    sla_risks = [
        {
            "taskId": task["id"],
            "title": task.get("title"),
            "status": task.get("status"),
            "riskLevel": task.get("riskLevel"),
            "dueAt": task.get("dueAt"),
            "sourceName": task.get("sourceName"),
        }
        for task in active_tasks
        if str(task.get("dueAt") or "") < utc_now()
    ]
    return {
        "generatedAt": utc_now(),
        "windowDays": window_days,
        "overview": {
            "activeTasks": len(active_tasks),
            "pendingApprovals": pending_approvals,
            "overdueTasks": len(sla_risks),
            "highRiskTasks": high_risk_tasks,
            "lowStockItems": len(low_stock_items),
            "maintenanceOverdueItems": len(overdue_equipment),
        },
        "inventory": {"lowStockItems": low_stock_items[:5], "highUsageItems": []},
        "equipment": {"overdueMaintenance": overdue_equipment[:5], "faultHotspots": []},
        "workflow": {
            "taskStatusDistribution": _status_counts(_tasks, "status"),
            "approvalStatusDistribution": _status_counts(_approvals, "status"),
            "slaRisks": sla_risks[:5],
        },
        "recommendations": _build_analysis_recommendations(
            low_stock_items=low_stock_items,
            overdue_equipment=overdue_equipment,
            sla_risks=sla_risks,
            pending_approvals=pending_approvals,
        ),
    }


async def _build_database_analysis_summary(window_days: int) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=window_days)
    maintenance_cutoff = now.date() - timedelta(days=30)

    async with get_db_connection() as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute("SELECT COUNT(*) AS count FROM ai_tasks WHERE status IN ('open', 'in_progress', 'blocked')")
            active_tasks = int((await cur.fetchone())["count"])
            await cur.execute("SELECT COUNT(*) AS count FROM approvals WHERE status = 'pending'")
            pending_approvals = int((await cur.fetchone())["count"])
            await cur.execute(
                """
                SELECT COUNT(*) AS count
                FROM ai_tasks
                WHERE status IN ('open', 'in_progress', 'blocked') AND due_at IS NOT NULL AND due_at < %s
                """,
                (now,),
            )
            overdue_tasks = int((await cur.fetchone())["count"])
            await cur.execute(
                """
                SELECT COUNT(*) AS count
                FROM ai_tasks
                WHERE status IN ('open', 'in_progress', 'blocked') AND risk_level IN ('high', 'critical')
                """,
            )
            high_risk_tasks = int((await cur.fetchone())["count"])
            await cur.execute(
                """
                SELECT id, name, current_quantity, threshold, unit
                FROM chemicals
                WHERE current_quantity <= threshold
                ORDER BY (threshold - current_quantity) DESC, updated_at DESC
                LIMIT 5
                """,
            )
            low_stock_rows = await cur.fetchall()
            low_stock_items = [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "currentQuantity": row["current_quantity"],
                    "minThreshold": row["threshold"],
                    "shortageRatio": max(0, (_as_float(row["threshold"]) - _as_float(row["current_quantity"])) / max(_as_float(row["threshold"]), 1)),
                    "unit": row["unit"],
                }
                for row in low_stock_rows
            ]
            await cur.execute(
                """
                SELECT c.id, c.name, COUNT(m.id) AS outbound_count, COALESCE(SUM(m.quantity), 0) AS outbound_quantity, c.unit
                FROM inventory_movements m
                JOIN chemicals c ON c.id = m.chemical_id
                WHERE m.movement_type = 'outbound' AND m.movement_date >= %s
                GROUP BY c.id, c.name, c.unit
                ORDER BY outbound_quantity DESC, outbound_count DESC
                LIMIT 5
                """,
                (since,),
            )
            high_usage_items = [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "outboundCount": int(row["outbound_count"]),
                    "outboundQuantity": row["outbound_quantity"],
                    "unit": row["unit"],
                }
                for row in await cur.fetchall()
            ]
            await cur.execute(
                """
                SELECT id, name, last_maintenance_at, status, (%s - last_maintenance_at)::int AS overdue_days
                FROM equipment
                WHERE last_maintenance_at IS NOT NULL AND last_maintenance_at < %s
                ORDER BY last_maintenance_at ASC
                LIMIT 5
                """,
                (now.date(), maintenance_cutoff),
            )
            overdue_equipment = [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "lastMaintenanceAt": row["last_maintenance_at"].isoformat() if row["last_maintenance_at"] else None,
                    "overdueDays": int(row["overdue_days"] or 0),
                    "status": row["status"],
                }
                for row in await cur.fetchall()
            ]
            await cur.execute(
                """
                SELECT source_id, source_name, COUNT(*) AS fault_count, MAX(created_at) AS latest_fault_at
                FROM ai_tasks
                WHERE source_type = 'equipment'
                  AND task_type = 'equipment_repair'
                  AND created_at >= %s
                GROUP BY source_id, source_name
                ORDER BY fault_count DESC, latest_fault_at DESC
                LIMIT 5
                """,
                (since,),
            )
            fault_hotspots = [
                {
                    "id": row["source_id"],
                    "name": row["source_name"],
                    "faultCount": int(row["fault_count"]),
                    "latestFaultAt": row["latest_fault_at"].isoformat() if row["latest_fault_at"] else None,
                }
                for row in await cur.fetchall()
            ]
            await cur.execute("SELECT status, COUNT(*) AS count FROM ai_tasks GROUP BY status")
            task_status_distribution = {str(row["status"]): int(row["count"]) for row in await cur.fetchall()}
            await cur.execute("SELECT status, COUNT(*) AS count FROM approvals GROUP BY status")
            approval_status_distribution = {str(row["status"]): int(row["count"]) for row in await cur.fetchall()}
            await cur.execute(
                """
                SELECT id, title, status, risk_level, due_at, source_name
                FROM ai_tasks
                WHERE status IN ('open', 'in_progress', 'blocked') AND due_at IS NOT NULL AND due_at < %s
                ORDER BY due_at ASC
                LIMIT 5
                """,
                (now,),
            )
            sla_risks = [
                {
                    "taskId": row["id"],
                    "title": row["title"],
                    "status": row["status"],
                    "riskLevel": row["risk_level"],
                    "dueAt": row["due_at"].isoformat() if row["due_at"] else None,
                    "sourceName": row["source_name"],
                }
                for row in await cur.fetchall()
            ]

    return {
        "generatedAt": utc_now(),
        "windowDays": window_days,
        "overview": {
            "activeTasks": active_tasks,
            "pendingApprovals": pending_approvals,
            "overdueTasks": overdue_tasks,
            "highRiskTasks": high_risk_tasks,
            "lowStockItems": len(low_stock_items),
            "maintenanceOverdueItems": len(overdue_equipment),
        },
        "inventory": {"lowStockItems": low_stock_items, "highUsageItems": high_usage_items},
        "equipment": {"overdueMaintenance": overdue_equipment, "faultHotspots": fault_hotspots},
        "workflow": {
            "taskStatusDistribution": task_status_distribution,
            "approvalStatusDistribution": approval_status_distribution,
            "slaRisks": sla_risks,
        },
        "recommendations": _build_analysis_recommendations(
            low_stock_items=low_stock_items,
            overdue_equipment=overdue_equipment,
            sla_risks=sla_risks,
            pending_approvals=pending_approvals,
        ),
    }


def sync_completed_report_results() -> None:
    for item in reversed(list_completed_report_results()):
        task_id = item.get("task_id")
        result = item.get("result")
        if task_id and isinstance(result, dict) and not any(report.get("id") == task_id for report in _reports):
            _reports.insert(0, build_report_from_result(str(task_id), result))


def normalize_report_row(row: Any) -> dict[str, Any]:
    return localize_report_presentation({
        "id": row["id"],
        "type": row["report_type"],
        "title": row["title"],
        "summary": row["summary"],
        "highlights": row["highlights"] or [],
        "createdAt": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
        "metadata": row["metadata"] or {},
    })


async def list_formal_reports() -> list[dict[str, Any]]:
    async with get_db_connection() as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute(
                """
                SELECT id, report_type, title, summary, highlights, created_at, metadata
                FROM ai_reports
                ORDER BY created_at DESC
                """
            )
            rows = await cur.fetchall()
    return [normalize_report_row(row) for row in rows]


async def persist_formal_report(report: dict[str, Any]) -> None:
    async with get_db_connection() as conn:
        await conn.execute(
            """
            INSERT INTO ai_reports (id, report_type, title, summary, highlights, created_at, metadata)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
              report_type = EXCLUDED.report_type,
              title = EXCLUDED.title,
              summary = EXCLUDED.summary,
              highlights = EXCLUDED.highlights,
              created_at = EXCLUDED.created_at,
              metadata = EXCLUDED.metadata
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


async def delete_formal_report(report_id: str) -> bool:
    async with get_db_connection() as conn:
        result = await conn.execute("DELETE FROM ai_reports WHERE id = %s", (report_id,))
        await conn.commit()
    return (result.rowcount or 0) > 0


async def find_formal_report(report_id: str) -> dict[str, Any] | None:
    async with get_db_connection() as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute(
                """
                SELECT id, report_type, title, summary, highlights, created_at, metadata
                FROM ai_reports
                WHERE id = %s
                """,
                (report_id,),
            )
            row = await cur.fetchone()
    return normalize_report_row(row) if row else None


async def find_report_for_delivery(report_id: Any) -> dict[str, Any]:
    report = next((item for item in _reports if item.get("id") == report_id), None)
    if report:
        return report
    target = get_capability_target(Capability.REPORT)
    if target == ServiceTarget.PYTHON_BACKEND:
        try:
            report = await find_formal_report(str(report_id))
        except Exception:
            report = None
        if report:
            if not any(item.get("id") == report["id"] for item in _reports):
                _reports.insert(0, report)
            return report
    raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Report not found."})


async def generate_python_report_result(report_type: str, now: str, operator: str, run_id: str) -> dict[str, Any]:
    llm_service = create_llm_service()
    try:
        async with get_db_connection() as conn:
            if report_type == "weekly":
                end_date = date.fromisoformat(now[:10])
                start_date = end_date - timedelta(days=7)
                report = await generate_weekly_report_data(
                    conn,
                    start_date,
                    end_date,
                    operator,
                    run_id,
                    llm_service=llm_service,
                )
            else:
                report = await generate_daily_report_data(
                    conn,
                    date.fromisoformat(now[:10]),
                    operator,
                    run_id,
                    llm_service=llm_service,
                )
        return report.model_dump(mode="json") if hasattr(report, "model_dump") else dict(report)
    finally:
        if hasattr(llm_service, "close"):
            await llm_service.close()


def resolve_supervisor_tools() -> SupervisorTools:
    settings = get_settings()

    # Create RulesEngine and adapter
    from app.rules.engine import RulesEngine
    from app.graphs.rules_adapter import SupervisorRulesAdapter
    rules_engine = RulesEngine()

    if not settings.database_url:
        return _supervisor_tools

    # Create tools first
    task_tool = TaskServiceTaskTool(get_db_connection)
    approval_tool = ApprovalServiceApprovalTool(get_db_connection)
    audit_log_tool = TaskActionAuditLogTool(get_db_connection)

    # Create adapter with task_tool for deduplication
    rules_adapter = SupervisorRulesAdapter(rules_engine, task_tool=task_tool)

    return SupervisorTools(
        task_tool=task_tool,
        approval_tool=approval_tool,
        audit_log_tool=audit_log_tool,
        rules_adapter=rules_adapter,
    )


def use_formal_task_service_for_tasks() -> bool:
    settings = get_settings()
    return bool(settings.database_url)


def use_formal_approval_service() -> bool:
    settings = get_settings()
    return bool(settings.database_url)


@asynccontextmanager
async def get_formal_task_service():
    async with get_db_connection() as conn:
        yield TaskService(conn)


@asynccontextmanager
async def get_formal_approval_service():
    async with get_db_connection() as conn:
        yield ApprovalService(conn)


def isoformat_z(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat().replace("+00:00", "Z")


def task_action_to_compat(action: TaskActionDTO) -> dict[str, Any]:
    return {
        "id": action.id,
        "taskId": action.task_id,
        "approvalId": action.approval_id,
        "actionType": action.action_type,
        "fromStatus": action.from_status,
        "toStatus": action.to_status,
        "actor": action.actor.model_dump(),
        "reasonCodes": list(action.reason_codes or []),
        "detail": action.detail,
        "toolName": action.tool_name,
        "snapshot": dict(action.snapshot or {}),
        "createdAt": isoformat_z(action.created_at),
    }


def task_detail_to_compat(detail: TaskDetailDTO) -> dict[str, Any]:
    return {
        "task": task_dto_to_compat(detail.task),
        "approval": detail.approval,
        "actions": [task_action_to_compat(action) for action in detail.actions],
    }


def approval_task_status_override(approval: dict[str, Any] | None) -> str | None:
    if not approval:
        return None
    if approval.get("status") in {"pending", "needs_info"}:
        return "pending_approval"
    return None


def apply_approval_overlay(task: dict[str, Any], approval: dict[str, Any] | None) -> dict[str, Any]:
    overlaid = dict(task)
    status_override = approval_task_status_override(approval)
    if status_override:
        overlaid["status"] = status_override
    return overlaid


def compat_transition_to_formal(transition: str | None) -> str | None:
    mapping = {
        "start_progress": "start",
        "start": "start",
        "complete": "complete",
        "close": "cancel",
        "cancel": "cancel",
        "reopen": "reopen",
        "block": "block",
        "unblock": "unblock",
    }
    return mapping.get(str(transition), None)


@router.get("/health")
def health() -> dict[str, Any]:
    routing_snapshot = get_capability_routing_snapshot()
    routing_warnings = validate_routing_consistency()

    # Add metadata about each capability
    capabilities_detail = {}
    for capability in Capability:
        target = get_capability_target(capability)
        capabilities_detail[capability.value] = {
            "target": target.value,
            "enabled": target == ServiceTarget.PYTHON_BACKEND,
            "env_var": f"PY_BACKEND_{capability.name}_ENABLED"
        }

    return ok(
        {
            "status": "healthy",
            "capabilities": routing_snapshot,
            "capabilities_detail": capabilities_detail,
            "routing_warnings": routing_warnings,
            "routing_dependencies": {
                "tasks": ["approvals"],
                "rules": ["tasks"],
                "report": ["tasks"]
            },
            # Keep existing mock data for compatibility
            "tasks": _tasks,
            "approvals": _approvals,
            "reports": _reports,
            "chemicals": _chemicals,
            "equipment": _equipment,
            "importBatches": _mock_batches,
        }
    )


@router.post("/auth/login")
async def login(request: Request) -> dict[str, Any]:
    payload = await request.json()
    username = str(payload.get("username") or "")
    password = str(payload.get("password") or "")
    settings = get_settings()

    if not settings.database_url:
        fallback_username = username or "frontend-user"
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=DEFAULT_AUTH_TOKEN_TTL_SECONDS)).isoformat().replace("+00:00", "Z")
        return ok(
            {
                "token": f"dev-token-{fallback_username}",
                "expiresAt": expires_at,
                "user": {
                    "id": str(fallback_username),
                    "username": str(fallback_username),
                    "name": str(fallback_username),
                    "role": "admin",
                    "capabilities": ["agents:execute", "tasks:read", "tasks:write"],
                },
            }
        )

    try:
        async with get_db_connection() as conn:
            user = await authenticate_user(conn, username, password)
    except LoginError as exc:
        raise HTTPException(status_code=401, detail={"code": "unauthorized", "message": str(exc)}) from exc

    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=DEFAULT_AUTH_TOKEN_TTL_SECONDS)).isoformat().replace("+00:00", "Z")
    return ok({"token": encode_auth_token(user, settings.auth_token_secret), "user": user_to_response(user), "expiresAt": expires_at})


@router.get("/auth/me")
async def me(request: Request) -> dict[str, Any]:
    settings = get_settings()
    if not settings.database_url:
        return ok(
            {
                "id": "frontend-user",
                "username": "frontend-user",
                "name": "Frontend User",
                "role": "admin",
                "capabilities": ["agents:execute", "tasks:read", "tasks:write"],
            }
        )

    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail={"code": "unauthorized", "message": "Authentication required."})

    payload = decode_auth_token(token, settings.auth_token_secret)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail={"code": "unauthorized", "message": "Invalid or expired token."})

    async with get_db_connection() as conn:
        user = await find_user_by_id(conn, str(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail={"code": "unauthorized", "message": "User is no longer active."})

    return ok(user_to_response(user))


@router.get("/auth/users")
async def auth_users() -> dict[str, Any]:
    settings = get_settings()
    if not settings.database_url:
        return ok(
            [
                {
                    "id": "frontend-user",
                    "username": "frontend-user",
                    "name": "Frontend User",
                    "role": "admin",
                    "capabilities": ["agents:execute", "tasks:read", "tasks:write"],
                }
            ]
        )

    async with get_db_connection() as conn:
        users = await list_users(conn)

    return ok([user_to_response(user) for user in users])


@router.get("/settings")
def get_ai_settings() -> dict[str, Any]:
    capability_target(Capability.SETTINGS)
    response = _settings.model_copy(deep=True)
    if response.emailDelivery.smtpPassword:
        response.emailDelivery.smtpPassword = None
        response.emailDelivery.passwordConfigured = True
    return ok(response.model_dump())


@router.patch("/settings")
async def patch_ai_settings(request: Request) -> dict[str, Any]:
    capability_target(Capability.SETTINGS)
    payload = await request.json()
    if "thresholds" in payload:
        _settings.thresholds = type(_settings.thresholds)(**payload["thresholds"])
    if "approvalStrategy" in payload:
        _settings.approvalStrategy = type(_settings.approvalStrategy)(**payload["approvalStrategy"])
    if "sla" in payload:
        _settings.sla = type(_settings.sla)(**payload["sla"])
    if "emailDelivery" in payload:
        current_password = _settings.emailDelivery.smtpPassword
        email_delivery = dict(payload["emailDelivery"])
        if not email_delivery.get("smtpPassword"):
            email_delivery["smtpPassword"] = current_password
        _settings.emailDelivery = EmailDeliverySettings(**{
            **_settings.emailDelivery.model_dump(),
            **email_delivery,
            "passwordConfigured": bool(email_delivery.get("smtpPassword")),
        })
    _settings.updatedAt = utc_now()
    response = _settings.model_copy(deep=True)
    if response.emailDelivery.smtpPassword:
        response.emailDelivery.smtpPassword = None
        response.emailDelivery.passwordConfigured = True
    return ok({"settings": response.model_dump()})


@router.get("/chemicals")
async def chemicals() -> dict[str, Any]:
    capability_target(Capability.INVENTORY)
    settings = get_settings()

    # If database is configured, fetch from database
    if settings.database_url:
        async with get_db_connection() as conn:
            async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                await cur.execute("""
                    SELECT
                        id, name, cas_number as "casNumber", category, spec,
                        current_quantity as "currentQuantity", threshold, unit, status,
                        lab_name as "labName", owner_name as "ownerName",
                        image_data_url as "imageDataUrl", remark,
                        updated_at as "updatedAt", metadata
                    FROM chemicals
                    ORDER BY updated_at DESC
                """)
                rows = await cur.fetchall()

            chemicals_list = []
            for row in rows:
                chem = dict(row)
                # Convert datetime to ISO string
                if chem.get("updatedAt"):
                    chem["updatedAt"] = chem["updatedAt"].isoformat().replace("+00:00", "Z")
                chemicals_list.append(chem)

            return ok(chemicals_list)

    # Fallback to mock data
    return ok(_chemicals)


@router.delete("/chemicals/{chemical_id}")
async def delete_chemical(chemical_id: str) -> dict[str, Any]:
    capability_target(Capability.INVENTORY)
    settings = get_settings()

    if settings.database_url:
        async with get_db_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT id FROM chemicals WHERE id = %s", (chemical_id,))
                existing = await cur.fetchone()
                if not existing:
                    raise HTTPException(status_code=404, detail="Chemical not found")

                await cur.execute("DELETE FROM inventory_movements WHERE chemical_id = %s", (chemical_id,))
                await cur.execute("DELETE FROM chemicals WHERE id = %s", (chemical_id,))
            await conn.commit()

        return ok({"deletedChemicalId": chemical_id})

    for index, chemical in enumerate(_chemicals):
        if chemical.get("id") == chemical_id:
            del _chemicals[index]
            return ok({"deletedChemicalId": chemical_id})

    raise HTTPException(status_code=404, detail="Chemical not found")


@router.get("/equipment")
async def equipment() -> dict[str, Any]:
    capability_target(Capability.INVENTORY)
    settings = get_settings()

    # If database is configured, fetch from database
    if settings.database_url:
        async with get_db_connection() as conn:
            async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                await cur.execute("""
                    SELECT
                        id, name, vendor, model, serial_number as "serialNumber", status,
                        lab_name as "labName", owner_name as "ownerName", location,
                        purchase_date as "purchaseDate",
                        last_maintenance_at as "lastMaintenanceAt",
                        next_maintenance_at as "nextMaintenanceAt",
                        maintenance_interval_days as "maintenanceIntervalDays",
                        image_data_url as "imageDataUrl", remark,
                        updated_at as "updatedAt", metadata
                    FROM equipment
                    ORDER BY updated_at DESC
                """)
                rows = await cur.fetchall()

            equipment_list = []
            for row in rows:
                equip = dict(row)
                # Convert datetime to ISO string
                if equip.get("updatedAt"):
                    equip["updatedAt"] = equip["updatedAt"].isoformat().replace("+00:00", "Z")
                if equip.get("lastMaintenanceAt"):
                    equip["lastMaintenanceAt"] = equip["lastMaintenanceAt"].isoformat() if hasattr(equip["lastMaintenanceAt"], "isoformat") else str(equip["lastMaintenanceAt"])
                if equip.get("nextMaintenanceAt"):
                    equip["nextMaintenanceAt"] = equip["nextMaintenanceAt"].isoformat() if hasattr(equip["nextMaintenanceAt"], "isoformat") else str(equip["nextMaintenanceAt"])
                if equip.get("purchaseDate"):
                    equip["purchaseDate"] = equip["purchaseDate"].isoformat() if hasattr(equip["purchaseDate"], "isoformat") else str(equip["purchaseDate"])
                equipment_list.append(equip)

            return ok(equipment_list)

    # Fallback to mock data
    return ok(_equipment)


@router.delete("/equipment/{equipment_id}")
async def delete_equipment(equipment_id: str) -> dict[str, Any]:
    capability_target(Capability.INVENTORY)
    settings = get_settings()

    if settings.database_url:
        async with get_db_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT id FROM equipment WHERE id = %s", (equipment_id,))
                existing = await cur.fetchone()
                if not existing:
                    raise HTTPException(status_code=404, detail="Equipment not found")

                await cur.execute("DELETE FROM equipment_maintenance_records WHERE equipment_id = %s", (equipment_id,))
                await cur.execute("DELETE FROM equipment WHERE id = %s", (equipment_id,))
            await conn.commit()

        return ok({"deletedEquipmentId": equipment_id})

    for index, item in enumerate(_equipment):
        if item.get("id") == equipment_id:
            del _equipment[index]
            return ok({"deletedEquipmentId": equipment_id})

    raise HTTPException(status_code=404, detail="Equipment not found")


@router.get("/inventory/transactions")
async def inventory_transactions(
    entity_type: str | None = None,
    operation_type: str | None = None,
    entity_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """List inventory transactions (movements).

    Query parameters:
    - entity_type: Filter by entity type (not used for now, all are chemicals)
    - operation_type: Filter by operation type ('inbound' or 'outbound')
    - entity_id: Filter by specific chemical ID
    - limit: Maximum number of records to return
    - offset: Number of records to skip
    """
    capability_target(Capability.INVENTORY)
    settings = get_settings()

    # If database is configured, fetch from database
    if settings.database_url:
        async with get_db_connection() as conn:
            async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                # Build query with filters
                where_clauses = []
                params = []

                if operation_type:
                    where_clauses.append("movement_type = %s")
                    params.append(operation_type)

                if entity_id:
                    where_clauses.append("chemical_id = %s")
                    params.append(entity_id)

                where_sql = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""

                query = f"""
                    SELECT
                        im.id,
                        im.movement_date as date,
                        c.name,
                        im.movement_type as type,
                        im.quantity::text,
                        im.unit,
                        im.operator_name as operator,
                        im.reason,
                        im.batch_number as "batchNumber",
                        im.expiry_date as "expiryDate",
                        im.metadata
                    FROM inventory_movements im
                    LEFT JOIN chemicals c ON im.chemical_id = c.id
                    {where_sql}
                    ORDER BY im.movement_date DESC
                    LIMIT %s OFFSET %s
                """

                params.extend([limit, offset])
                await cur.execute(query, params)
                rows = await cur.fetchall()

            transactions = []
            for row in rows:
                txn = dict(row)
                # Convert datetime to ISO string
                if txn.get("date"):
                    txn["date"] = txn["date"].isoformat().replace("+00:00", "Z")
                if txn.get("expiryDate"):
                    txn["expiryDate"] = txn["expiryDate"].isoformat() if hasattr(txn["expiryDate"], "isoformat") else str(txn["expiryDate"])
                transactions.append(txn)

            return ok(transactions)

    # Fallback to empty list if no database
    return ok([])


@router.get("/import-batches")
async def import_batches(entityType: str | None = None) -> dict[str, Any]:
    capability_target(Capability.IMPORT)
    settings = get_settings()

    # If a database is configured, read import batches from PostgreSQL.
    if settings.database_url:
        async with get_db_connection() as conn:
            async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                if entityType:
                    await cur.execute("""
                        SELECT
                            id, entity_type as "entityType", source, file_name as "fileName",
                            status, total_count as "totalCount", success_count as "successCount",
                            failure_count as "failureCount", imported_by as "importedBy",
                            created_at as "createdAt", imported_record_ids as "importedRecordIds",
                            generated_event_count as "generatedEventCount", errors
                        FROM import_jobs
                        WHERE entity_type = %s
                        ORDER BY created_at DESC
                    """, (entityType,))
                else:
                    await cur.execute("""
                        SELECT
                            id, entity_type as "entityType", source, file_name as "fileName",
                            status, total_count as "totalCount", success_count as "successCount",
                            failure_count as "failureCount", imported_by as "importedBy",
                            created_at as "createdAt", imported_record_ids as "importedRecordIds",
                            generated_event_count as "generatedEventCount", errors
                        FROM import_jobs
                        ORDER BY created_at DESC
                    """)
                rows = await cur.fetchall()

            batches = []
            for row in rows:
                batch = dict(row)
                # 杞崲鏃堕棿鏍煎紡
                if batch.get("createdAt"):
                    batch["createdAt"] = batch["createdAt"].isoformat().replace("+00:00", "Z")
                # 瑙ｆ瀽 JSON 瀛楁
                if isinstance(batch.get("importedBy"), str):
                    batch["importedBy"] = json.loads(batch["importedBy"]).get("name", "Unknown")
                elif isinstance(batch.get("importedBy"), dict):
                    batch["importedBy"] = batch["importedBy"].get("name", "Unknown")
                batches.append(batch)

            return ok(batches)

    # 鍚﹀垯浣跨敤鍐呭瓨鏁版嵁锛堝吋瀹规ā寮忥級
    batches = [item for item in _mock_batches if not entityType or item["entityType"] == entityType]
    return ok(batches)


@router.post("/imports/chemicals")
async def import_chemicals(request: Request) -> dict[str, Any]:
    capability_target(Capability.IMPORT)
    payload = await request.json()
    now = utc_now()
    now_dt = datetime.now(timezone.utc)  # 鐢ㄤ簬鏁版嵁搴撶殑 datetime 瀵硅薄

    rows = payload.get("rows", [])

    async with get_db_connection() as conn:
        service = InventoryService(conn)
        imported, errors = await service.import_chemicals(rows)

        # Build records for batch response
        records = [{"id": rec["id"], "name": rec["name"]} for rec in imported]

        # 淇濆瓨瀵煎叆鎵规鍒版暟鎹簱
        batch_id = f"batch-{uuid4()}"
        imported_by_data = payload.get("importedBy") or {}
        imported_record_ids = [record["id"] for record in records]

        await conn.execute(
            """
            INSERT INTO import_jobs (
                id, entity_type, source, file_name, status,
                total_count, success_count, failure_count,
                imported_by, created_at, completed_at,
                imported_record_ids, rule_inspection_triggered,
                generated_event_count, errors, metadata
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                batch_id,
                "chemical",
                payload.get("source", "manual"),
                payload.get("fileName"),
                "completed",
                len(rows),
                len(imported),
                len(errors),
                json.dumps(imported_by_data),
                now_dt,
                now_dt,
                json.dumps(imported_record_ids),
                False,
                0,
                json.dumps([{"row": e.get("row"), "error": str(e.get("error"))} for e in errors]),
                json.dumps({})
            )
        )
        await conn.commit()

        batch = {
            "id": batch_id,
            "entityType": "chemical",
            "source": payload.get("source", "manual"),
            "fileName": payload.get("fileName"),
            "status": "completed",
            "totalCount": len(rows),
            "successCount": len(imported),
            "failureCount": len(errors),
            "createdAt": now,
            "importedBy": imported_by_data.get("name") or imported_by_data or "frontend-user",
            "importedRecordIds": imported_record_ids,
            "generatedEventCount": 0,
            "errors": [{"row": e.get("row"), "error": str(e.get("error"))} for e in errors],
        }

        # 浠嶇劧娣诲姞鍒板唴瀛樹腑锛堜负浜嗗吋瀹规€э級
        _mock_batches.append(batch)

    return ok({"batch": batch, "records": records})


@router.post("/imports/equipment")
async def import_equipment(request: Request) -> dict[str, Any]:
    capability_target(Capability.IMPORT)
    payload = await request.json()
    now = utc_now()
    now_dt = datetime.now(timezone.utc)  # 鐢ㄤ簬鏁版嵁搴撶殑 datetime 瀵硅薄

    # 娣诲姞璋冭瘯鏃ュ織锛堝畬鍏ㄩ伩鍏嶆墦鍗板彲鑳界殑浜岃繘鍒舵暟鎹級
    rows = payload.get("rows", [])

    # 浣跨敤鏃ュ織鏂囦欢鑰屼笉鏄洿鎺ユ墦鍗板埌缁堢
    import logging
    logger = logging.getLogger(__name__)

    logger.info("=" * 50)
    logger.info("[DEBUG] 鎺ユ敹鍒扮殑瀵煎叆璇锋眰:")
    logger.info(f"  - 鏂囦欢鍚? {payload.get('fileName')}")
    logger.info(f"  - 鏁版嵁琛屾暟: {len(rows)}")
    logger.info(f"  - 鏉ユ簮: {payload.get('source')}")

    importedBy = payload.get('importedBy', {})
    if isinstance(importedBy, dict):
        logger.info(f"  - 瀵煎叆浜? {importedBy.get('name', 'Unknown')}")
    else:
        logger.info(f"  - 瀵煎叆浜? {importedBy}")

    # Log only field statistics, not row contents.
    if rows:
        first_row = rows[0]
        field_names = list(first_row.keys())
        logger.info(f"  - 绗竴琛屽瓧娈垫暟閲? {len(field_names)}")
        logger.info(f"  - 瀛楁鍚嶇О: {field_names}")
    else:
        logger.warning("  - Warning: rows is an empty array.")
    logger.info("=" * 50)

    async with get_db_connection() as conn:
        service = InventoryService(conn)
        imported, errors = await service.import_equipment(rows)

        # 娣诲姞瀵煎叆缁撴灉鏃ュ織
        logger.info("[DEBUG] 瀵煎叆缁撴灉:")
        logger.info(f"  - 鎴愬姛: {len(imported)}")
        logger.info(f"  - 澶辫触: {len(errors)}")
        if errors:
            # 鍙褰曢敊璇殑琛屽彿鍜岄敊璇俊鎭紝涓嶈褰曞畬鏁存暟鎹?            error_summary = [{"row": e.get("row"), "error": str(e.get("error"))[:100]} for e in errors[:3]]
            logger.error(f"  - 閿欒鎽樿: {error_summary}")
        logger.info("=" * 50)

        # Build records for batch response
        records = [{"id": rec["id"], "name": rec["name"]} for rec in imported]

        # 淇濆瓨瀵煎叆鎵规鍒版暟鎹簱
        batch_id = f"batch-{uuid4()}"
        imported_by_data = payload.get("importedBy") or {}
        imported_record_ids = [record["id"] for record in records]

        await conn.execute(
            """
            INSERT INTO import_jobs (
                id, entity_type, source, file_name, status,
                total_count, success_count, failure_count,
                imported_by, created_at, completed_at,
                imported_record_ids, rule_inspection_triggered,
                generated_event_count, errors, metadata
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                batch_id,
                "equipment",
                payload.get("source", "manual"),
                payload.get("fileName"),
                "completed",
                len(rows),
                len(imported),
                len(errors),
                json.dumps(imported_by_data),
                now_dt,  # 浣跨敤 datetime 瀵硅薄
                now_dt,  # 浣跨敤 datetime 瀵硅薄
                json.dumps(imported_record_ids),
                False,
                0,
                json.dumps([{"row": e.get("row"), "error": str(e.get("error"))} for e in errors]),
                json.dumps({})
            )
        )
        await conn.commit()

        batch = {
            "id": batch_id,
            "entityType": "equipment",
            "source": payload.get("source", "manual"),
            "fileName": payload.get("fileName"),
            "status": "completed",
            "totalCount": len(rows),
            "successCount": len(imported),
            "failureCount": len(errors),
            "createdAt": now,
            "importedBy": imported_by_data.get("name") or imported_by_data or "frontend-user",
            "importedRecordIds": imported_record_ids,
            "generatedEventCount": 0,
            "errors": [{"row": e.get("row"), "error": str(e.get("error"))} for e in errors],
        }

        # 浠嶇劧娣诲姞鍒板唴瀛樹腑锛堜负浜嗗吋瀹规€э級
        _mock_batches.append(batch)

    return ok({"batch": batch, "records": records})


def make_import_batch(payload: dict[str, Any], entity_type: str, records: list[dict[str, Any]], now: str) -> dict[str, Any]:
    imported_by = payload.get("importedBy") or {}
    return {
        "id": f"batch-{uuid4()}",
        "entityType": entity_type,
        "source": payload.get("source", "manual"),
        "fileName": payload.get("fileName"),
        "status": "completed",
        "totalCount": len(records),
        "successCount": len(records),
        "failureCount": 0,
        "createdAt": now,
        "importedBy": imported_by.get("name") or imported_by or "frontend-user",
        "importedRecordIds": [record["id"] for record in records],
        "generatedEventCount": 0,
        "errors": [],
    }


@router.post("/rules/inspect")
async def inspect_rules(request: Request) -> dict[str, Any]:
    capability_target(Capability.RULES)
    payload = await request.json()
    now = payload.get("config", {}).get("now") or utc_now()
    overdue_days = int(payload.get("config", {}).get("maintenanceOverdueDays") or 30)
    input_data = payload.get("input", {})
    events: list[dict[str, Any]] = []

    for chemical in input_data.get("chemicals", []):
        quantity = chemical.get("totalQuantity") or 0
        threshold = chemical.get("threshold") or 0
        if quantity <= threshold:
            events.append(
                make_event(
                    event_type="low_stock",
                    source_type="chemical",
                    source_id=str(chemical.get("id")),
                    source_name=str(chemical.get("name")),
                    title="Low stock detected",
                    summary=f"Current quantity {quantity} is below threshold {threshold}.",
                    now=now,
                    evidence=[{"label": "Threshold", "value": threshold}, {"label": "Current quantity", "value": quantity}],
                )
            )

    cutoff = datetime.fromisoformat(now.replace("Z", "+00:00")) - timedelta(days=overdue_days)
    fault_statuses = {"fault", "故障", "异常", "needs_maintenance"}
    for item in input_data.get("equipment", []):
        status = str(item.get("status") or "")
        last_maintenance = item.get("lastMaintenanceAt")
        if status in fault_statuses:
            events.append(
                make_event(
                    event_type="equipment_fault",
                    source_type="equipment",
                    source_id=str(item.get("id")),
                    source_name=str(item.get("name")),
                    title="Equipment fault detected",
                    summary="Equipment status requires review.",
                    now=now,
                    evidence=[{"label": "Status", "value": status}],
                )
            )
        elif last_maintenance:
            try:
                maintenance_at = datetime.fromisoformat(str(last_maintenance).replace("Z", "+00:00"))
                # Ensure maintenance_at has timezone info
                if maintenance_at.tzinfo is None:
                    maintenance_at = maintenance_at.replace(tzinfo=timezone.utc)
                if maintenance_at < cutoff:
                    events.append(
                        make_event(
                            event_type="maintenance_overdue",
                            source_type="equipment",
                            source_id=str(item.get("id")),
                            source_name=str(item.get("name")),
                            title="Maintenance overdue",
                            summary=f"Last maintenance is older than {overdue_days} days.",
                            now=now,
                            evidence=[{"label": "Last maintenance", "value": last_maintenance}],
                        )
                    )
            except ValueError:
                continue

    return ok({"items": [{"event": event, "decision": "create_task"} for event in events]})


def make_event(
    event_type: str,
    source_type: str,
    source_id: str,
    source_name: str,
    title: str,
    summary: str,
    now: str,
    evidence: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "id": f"event-{event_type}-{source_id}",
        "type": event_type,
        "sourceType": source_type,
        "sourceId": source_id,
        "sourceName": source_name,
        "title": title,
        "summary": summary,
        "priority": EventMappings.event_to_priority(event_type),
        "riskLevel": EventMappings.event_to_risk_level(event_type),
        "suggestedTaskType": EventMappings.event_to_compat_task_type(event_type),
        "createdAt": now,
        "evidence": evidence,
        "metadata": {},
    }


def recommendation_with_meta(state: dict[str, Any]) -> dict[str, Any] | None:
    recommendation = state.get("recommendation")
    if not recommendation:
        return None

    metadata = (state.get("taskDraft") or {}).get("metadata") or {}
    return {
        **recommendation,
        "llmUsed": metadata.get("llmUsed", False),
        "fallbackReason": metadata.get("llmFallbackReason"),
        "provider": metadata.get("llmProvider"),
        "model": metadata.get("llmModel"),
    }


def preview_context_from_state(state: dict[str, Any]) -> dict[str, Any]:
    decision = state.get("ruleDecision") or {}
    existing_task_id = decision.get("existingTaskId")
    return {
        "existingOpenTask": {"id": existing_task_id} if existing_task_id else None,
    }


@router.post("/rules/preview")
async def preview_rule(request: Request) -> dict[str, Any]:
    target = get_capability_target(Capability.RULES)
    payload = await request.json()
    event = payload.get("event") or {}
    actor = actor_from_payload(payload)

    if target == ServiceTarget.PYTHON_BACKEND:
        from app.llm.factory import create_llm_service

        llm_service = create_llm_service()
        try:
            state = await run_supervisor_preview_graph_async(
                event=event,
                actor=actor,
                tools=resolve_supervisor_tools(),
                llm_service=llm_service,
            )
        finally:
            if hasattr(llm_service, "close"):
                await llm_service.close()

        response_state = {
            "event": state.get("normalizedEvent"),
            "decision": state.get("ruleDecision"),
            "supervisor": state.get("supervisorDecision"),
            "context": preview_context_from_state(state),
            "recommendation": recommendation_with_meta(state),
            "taskDraft": state.get("taskDraft"),
            "approvalDraft": state.get("approvalDraft"),
            "activityLogCount": 0,
        }
        return ok({"state": response_state})

    task = event_to_task(event)
    response_state = {
        "event": event,
        "decision": {"isValidEvent": True, "route": "compat_fallback", "dedupeHit": False},
        "context": {"existingOpenTask": None},
        "recommendation": {
            "reason": task.get("summary"),
            "riskSummary": f"Risk level is {task.get('riskLevel', 'medium')}.",
            "actionSummary": task.get("recommendation"),
            "llmUsed": False,
            "fallbackReason": "compat_fallback",
            "provider": None,
            "model": None,
        },
        "taskDraft": task,
        "approvalDraft": None,
        "activityLogCount": 0,
    }
    return ok({"state": response_state})


@router.post("/rules/execute")
async def execute_rule(request: Request) -> dict[str, Any]:
    target = get_capability_target(Capability.RULES)
    payload = await request.json()
    event = payload.get("event") or {}
    actor = actor_from_payload(payload)
    if target == ServiceTarget.PYTHON_BACKEND:
        # Import LLM service
        from app.llm.factory import create_llm_service
        llm_service = create_llm_service()

        # Run supervisor graph with LLM service
        state = await run_supervisor_graph_async(
            event=event,
            actor=actor,
            tools=resolve_supervisor_tools(),
            llm_service=llm_service
        )

        # Extract data from state (task and recommendation are at root level)
        output = state.get("output", {})
        created_task = state.get("createdTask")  # Task is at state root
        recommendation = recommendation_with_meta(state)  # Recommendation is at state root

        sync_task_snapshot(
            created_task,
            output.get("activityLogs"),
        )
        context = output.get("context") or {"existingOpenTask": None}
        response_state = {
            "output": {"taskId": output.get("taskId")},
            "context": context,
            "task": created_task,  # Use createdTask from state root
            "approval": output.get("approval"),
            "activityLogCount": output.get("activityLogCount", 0),
            "activityLogs": output.get("activityLogs", []),
            "recommendation": recommendation,  # Use recommendation from state root
        }
        return ok({"state": response_state})

    existing = next(
        (
            task
            for task in _tasks
            if task.get("eventId") == event.get("id") and task.get("status") in {"open", "in_progress", "pending_approval"}
        ),
        None,
    )
    if existing:
        return ok({"state": {"output": {}, "context": {"existingOpenTask": {"id": existing["id"]}}}})

    task = event_to_task(event)
    _tasks.append(task)
    _actions[task["id"]] = [
        make_action("task_created", "Rule execution created task.", actor=actor, task_id=task["id"])
    ]
    return ok({"state": {"output": {"taskId": task["id"]}, "context": {"existingOpenTask": None}}})


def event_to_task(event: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    task_type = event.get("suggestedTaskType") or EventMappings.event_to_compat_task_type(event.get("type", ""))
    title = event.get("title") or "AI task"
    if task_type == "chemical_purchase":
        title = f"采购药品：{event.get('sourceName') or '未知药品'}"
    elif task_type == "equipment_maintenance":
        title = f"设备维护：{event.get('sourceName') or '未知设备'}"
    return {
        "id": f"task-{uuid4()}",
        "eventId": event.get("id"),
        "type": task_type,
        "title": title,
        "summary": event.get("summary") or "Generated from rule event.",
        "recommendation": "Review evidence and follow the standard operating procedure.",
        "status": "open",
        "priority": event.get("priority") or "medium",
        "riskLevel": event.get("riskLevel") or "medium",
        "sourceType": event.get("sourceType") or "system",
        "sourceId": event.get("sourceId") or "unknown",
        "sourceName": event.get("sourceName") or "Unknown source",
        "assigneeId": "ai-operator",
        "assigneeName": "AI Employee",
        "assigneeRole": "AI Employee",
        "requiresApproval": EventMappings.requires_approval(
            event.get("type", ""),
            event.get("riskLevel", "medium")
        ),
        "dueAt": (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat().replace("+00:00", "Z"),
        "createdAt": now,
        "updatedAt": now,
        "closedAt": None,
        "metadata": {"evidence": event.get("evidence", []), "slaReminderCount": 0},
    }


def sync_task_snapshot(task: dict[str, Any] | None, activity_logs: list[dict[str, Any]] | None = None) -> None:
    if not task:
        return
    existing_index = next((idx for idx, item in enumerate(_tasks) if item.get("id") == task.get("id")), None)
    if existing_index is None:
        _tasks.append(task)
    else:
        _tasks[existing_index] = task
    if activity_logs is not None:
        _actions[task["id"]] = list(activity_logs)


@router.get("/tasks")
async def list_tasks() -> dict[str, Any]:
    target = get_capability_target(Capability.TASKS)
    if target == ServiceTarget.PYTHON_BACKEND and use_formal_task_service_for_tasks():
        async with get_formal_task_service() as service:
            tasks = await service.list_tasks(query=ListTasksQuery())
        latest_approvals_by_task: dict[str, dict[str, Any]] = {}
        if get_capability_target(Capability.APPROVALS) == ServiceTarget.PYTHON_BACKEND and use_formal_approval_service():
            async with get_formal_approval_service() as approval_service:
                approvals = await approval_service.list_approvals()
            for approval in approvals:
                compat_approval = approval_dto_to_compat(approval)
                latest_approvals_by_task.setdefault(compat_approval["taskId"], compat_approval)

        compat_tasks = [
            apply_approval_overlay(task_dto_to_compat(task), latest_approvals_by_task.get(task.id))
            for task in tasks
        ]
        for task in compat_tasks:
            sync_task_snapshot(task)
        return ok(compat_tasks)
    return ok(_tasks)


@router.get("/tasks/{task_id}")
async def get_task(task_id: str) -> dict[str, Any]:
    target = get_capability_target(Capability.TASKS)
    if target == ServiceTarget.PYTHON_BACKEND and use_formal_task_service_for_tasks():
        try:
            async with get_formal_task_service() as service:
                detail = await service.get_task_detail(task_id)
        except TaskNotFoundError as exc:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": str(exc)}) from exc
        compat_detail = task_detail_to_compat(detail)
        if get_capability_target(Capability.APPROVALS) == ServiceTarget.PYTHON_BACKEND and use_formal_approval_service():
            async with get_formal_approval_service() as approval_service:
                latest_approval = await approval_service.get_latest_task_approval(task_id)
            compat_detail["approval"] = approval_dto_to_compat(latest_approval) if latest_approval else None
            compat_detail["task"] = apply_approval_overlay(compat_detail["task"], compat_detail["approval"])
        sync_task_snapshot(compat_detail["task"], compat_detail["actions"])
        return ok(compat_detail)

    task = find_by_id(_tasks, task_id)
    return ok({"task": task, "approval": find_task_approval(task_id), "actions": _actions.get(task_id, [])})


@router.patch("/tasks/{task_id}/status")
async def update_task_status(task_id: str, request: Request) -> dict[str, Any]:
    target = get_capability_target(Capability.TASKS)
    payload = await request.json()
    if target == ServiceTarget.PYTHON_BACKEND and use_formal_task_service_for_tasks():
        if payload.get("transition") == "request_approval":
            if get_capability_target(Capability.APPROVALS) != ServiceTarget.PYTHON_BACKEND or not use_formal_approval_service():
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "unsupported_transition",
                        "message": "Approval runtime is not enabled for request_approval transition.",
                    },
                )
            try:
                async with get_formal_task_service() as task_service:
                    task_detail = await task_service.get_task_detail(task_id)
                async with get_formal_approval_service() as approval_service:
                    existing_approval = await approval_service.get_latest_task_approval(task_id)
                    approval = (
                        existing_approval
                        if existing_approval and existing_approval.status in {"pending", "needs_info"}
                        else await approval_service.create_approval(
                            CreateApprovalRequest(
                                task_id=task_id,
                                title=f"{task_detail.task.title} approval",
                                reason=payload.get("detail") or task_detail.task.recommendation,
                                risk_level=task_detail.task.risk_level,
                                requested_by=actor_to_formal(actor_from_payload(payload)),
                                metadata={},
                            )
                        )
                    )
            except TaskNotFoundError as exc:
                raise HTTPException(status_code=404, detail={"code": "not_found", "message": str(exc)}) from exc
            compat_task = apply_approval_overlay(task_dto_to_compat(task_detail.task), approval_dto_to_compat(approval))
            sync_task_snapshot(compat_task)
            return ok({"task": compat_task, "approval": approval_dto_to_compat(approval)})

        formal_transition = compat_transition_to_formal(payload.get("transition"))
        if formal_transition is None:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "unsupported_transition",
                    "message": f"Transition {payload.get('transition')} requires approval flow support and is not available yet.",
                },
            )
        update_request = UpdateTaskStatusRequest(
            transition=formal_transition,
            comment=payload.get("detail"),
        )
        try:
            async with get_formal_task_service() as service:
                updated = await service.update_task_status(
                    task_id=task_id,
                    request=update_request,
                    actor=actor_to_formal(actor_from_payload(payload)),
                )
        except TaskNotFoundError as exc:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": str(exc)}) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"code": "invalid_transition", "message": str(exc)}) from exc
        compat_task = task_dto_to_compat(updated)
        sync_task_snapshot(compat_task)
        return ok({"task": compat_task})

    task = find_by_id(_tasks, task_id)
    previous = task["status"]
    transition = payload.get("transition")
    next_status = transition_to_status(previous, transition)
    task["status"] = next_status
    task["updatedAt"] = utc_now()
    if next_status == "closed":
        task["closedAt"] = task["updatedAt"]
    _actions.setdefault(task_id, []).append(
        make_action(
            "task_status_changed",
            payload.get("detail") or f"Transition {transition}.",
            actor=actor_from_payload(payload),
            task_id=task_id,
            from_status=previous,
            to_status=next_status,
        )
    )
    return ok({"task": task})


def transition_to_status(previous: str, transition: str | None) -> str:
    mapping = {
        "start_progress": "in_progress",
        "start": "in_progress",
        "request_approval": "pending_approval",
        "resume_after_info": "open",
        "approve_completion": "in_progress",
        "complete": "done",
        "close": "closed",
        "reopen": "open",
        "cancel": "closed",
        "block": "in_progress",
        "unblock": "in_progress",
    }
    return mapping.get(str(transition), previous)


@router.patch("/tasks/{task_id}/assignee")
async def assign_task(task_id: str, request: Request) -> dict[str, Any]:
    target = get_capability_target(Capability.TASKS)
    payload = await request.json()
    if target == ServiceTarget.PYTHON_BACKEND and use_formal_task_service_for_tasks():
        assign_request = AssignTaskRequest(
            assignee_id=str(payload.get("assigneeId") or ""),
            assignee_name=str(payload.get("assigneeName") or ""),
            assignee_role=payload.get("assigneeRole"),
            reason=payload.get("reason"),
        )
        try:
            async with get_formal_task_service() as service:
                updated = await service.assign_task(
                    task_id=task_id,
                    request=assign_request,
                    actor=actor_to_formal(actor_from_payload(payload)),
                )
        except TaskNotFoundError as exc:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": str(exc)}) from exc
        compat_task = task_dto_to_compat(updated)
        sync_task_snapshot(compat_task)
        return ok({"task": compat_task})

    task = find_by_id(_tasks, task_id)
    task["assigneeId"] = payload.get("assigneeId")
    task["assigneeName"] = payload.get("assigneeName")
    task["assigneeRole"] = payload.get("assigneeRole")
    task["updatedAt"] = utc_now()
    _actions.setdefault(task_id, []).append(
        make_action("task_assigned", "Task reassigned.", actor=actor_from_payload(payload), task_id=task_id)
    )
    return ok({"task": task})


@router.post("/tasks/{task_id}/completion-report")
async def confirm_task_completion_report(task_id: str, request: Request) -> dict[str, Any]:
    target = get_capability_target(Capability.TASKS)
    payload = await request.json()
    report_request = ConfirmTaskCompletionReportRequest(
        report_title=str(payload.get("reportTitle") or payload.get("report_title") or ""),
        report_file_name=payload.get("reportFileName") or payload.get("report_file_name"),
        report_content_type=payload.get("reportContentType") or payload.get("report_content_type"),
        report_storage_url=payload.get("reportStorageUrl") or payload.get("report_storage_url"),
        engineer_name=payload.get("engineerName") or payload.get("engineer_name"),
        description=payload.get("description"),
        result=payload.get("result") or "completed",
        next_maintenance_at=payload.get("nextMaintenanceAt") or payload.get("next_maintenance_at") or None,
        metadata=payload.get("metadata") or {},
    )

    if target == ServiceTarget.PYTHON_BACKEND and use_formal_task_service_for_tasks():
        try:
            async with get_formal_task_service() as service:
                updated = await service.confirm_completion_report(
                    task_id=task_id,
                    request=report_request,
                    actor=actor_to_formal(actor_from_payload(payload)),
                )
        except TaskNotFoundError as exc:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": str(exc)}) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"code": "invalid_completion_report", "message": str(exc)}) from exc
        compat_task = task_dto_to_compat(updated)
        sync_task_snapshot(compat_task)
        return ok({"task": compat_task})

    task = find_by_id(_tasks, task_id)
    if task.get("type") not in {"equipment_maintenance", "equipment_repair", "maintenance", "anomaly_review"}:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_task_type", "message": "Completion report is reserved for maintenance and repair tasks."},
        )
    previous = task["status"]
    now = utc_now()
    report_snapshot = {
        "reportTitle": report_request.report_title,
        "reportFileName": report_request.report_file_name,
        "reportContentType": report_request.report_content_type,
        "reportStorageUrl": report_request.report_storage_url,
        "engineerName": report_request.engineer_name,
        "description": report_request.description,
        "result": report_request.result or "completed",
        "nextMaintenanceAt": isoformat_z(report_request.next_maintenance_at),
        "submittedAt": now,
    }
    metadata = dict(task.get("metadata") or {})
    metadata["completionReport"] = report_snapshot
    metadata["equipmentStatusUpdate"] = {
        "status": "operational",
        "updatedAt": now,
        "summary": report_request.description or report_request.report_title,
    }
    task["metadata"] = metadata
    task["status"] = "done"
    task["updatedAt"] = now
    task["closedAt"] = now
    sync_task_snapshot(task)
    _actions.setdefault(task_id, []).append(
        make_action(
            "completion_report_submitted",
            f"Completion report submitted: {report_request.report_title}.",
            actor=actor_from_payload(payload),
            task_id=task_id,
            from_status=previous,
            to_status="done",
        )
    )
    return ok({"task": task})


@router.post("/tasks/{task_id}/auto-purchase/prepare")
async def prepare_auto_purchase(task_id: str, request: Request) -> dict[str, Any]:
    target = get_capability_target(Capability.TASKS)
    payload = await request.json()
    actor = actor_from_payload(payload)
    try:
        task = find_by_id(_tasks, task_id)
    except HTTPException as exc:
        if target != ServiceTarget.PYTHON_BACKEND or not use_formal_task_service_for_tasks():
            raise
        try:
            async with get_formal_task_service() as service:
                detail = await service.get_task_detail(task_id)
        except TaskNotFoundError as formal_exc:
            raise exc from formal_exc
        task = task_dto_to_compat(detail.task)
        sync_task_snapshot(task, [task_action_to_compat(action) for action in detail.actions])

    if task.get("type") not in {"chemical_purchase", "restock"}:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_task_type", "message": "Auto purchase is reserved for chemical purchase tasks."},
        )

    now = utc_now()
    metadata = dict(task.get("metadata") or {})
    auto_purchase = metadata.get("autoPurchase")
    if isinstance(auto_purchase, dict) and auto_purchase.get("status") == "submitted":
        return ok({
            "status": "submitted",
            "message": auto_purchase.get("message") or "采购请求已提交。",
            "taskId": task_id,
            "purchaseRequestId": auto_purchase.get("purchaseRequestId"),
        })
    metadata["autoPurchase"] = {
        "status": "reserved",
        "purchaseRequestId": None,
        "updatedAt": now,
        "message": "自动采购接口已预留，当前版本不会创建真实采购单。",
    }
    task["metadata"] = metadata
    task["updatedAt"] = now
    sync_task_snapshot(task)
    _actions.setdefault(task_id, []).append(
        make_action(
            "task_status_changed",
            "自动采购预留接口已触发；当前版本仅记录预留状态，不创建真实采购单。",
            actor=actor,
            task_id=task_id,
            from_status=task.get("status"),
            to_status=task.get("status"),
        )
    )
    return ok({
        "status": "reserved",
        "message": "自动采购接口已预留，当前版本不会创建真实采购单。",
        "taskId": task_id,
        "purchaseRequestId": None,
    })

@router.get("/approvals")
async def list_approvals() -> dict[str, Any]:
    target = get_capability_target(Capability.APPROVALS)
    if target == ServiceTarget.PYTHON_BACKEND and use_formal_approval_service():
        async with get_formal_approval_service() as service:
            approvals = await service.list_approvals()
        return ok([approval_dto_to_compat(item) for item in approvals])
    return ok(_approvals)


@router.post("/approvals")
async def create_approval(request: Request) -> dict[str, Any]:
    target = get_capability_target(Capability.APPROVALS)
    payload = await request.json()
    if target == ServiceTarget.PYTHON_BACKEND and use_formal_approval_service():
        create_request = CreateApprovalRequest(
            task_id=str(payload.get("taskId") or ""),
            title=str(payload.get("title") or "Approval request"),
            reason=str(payload.get("reason") or ""),
            risk_level=str(payload.get("riskLevel") or "medium"),
            requested_by=actor_to_formal(actor_from_payload(payload)),
            metadata={},
        )
        async with get_formal_approval_service() as service:
            approval = await service.create_approval(create_request)
        compat_approval = approval_dto_to_compat(approval)
        if get_capability_target(Capability.TASKS) == ServiceTarget.PYTHON_BACKEND and use_formal_task_service_for_tasks():
            try:
                async with get_formal_task_service() as task_service:
                    task_detail = await task_service.get_task_detail(compat_approval["taskId"])
                sync_task_snapshot(apply_approval_overlay(task_dto_to_compat(task_detail.task), compat_approval))
            except TaskNotFoundError:
                pass
        else:
            task = next((item for item in _tasks if item.get("id") == compat_approval["taskId"]), None)
            if task:
                sync_task_snapshot(apply_approval_overlay(task, compat_approval))
        return ok({"approval": compat_approval})

    task = find_by_id(_tasks, payload.get("taskId"))
    now = utc_now()
    approval = {
        "id": f"approval-{uuid4()}",
        "taskId": task["id"],
        "title": payload.get("title") or f"{task['title']} approval",
        "reason": payload.get("reason") or task.get("recommendation"),
        "status": "pending",
        "riskLevel": payload.get("riskLevel") or task.get("riskLevel"),
        "createdAt": now,
        "updatedAt": now,
        "comment": None,
        "metadata": {},
    }
    _approvals.append(approval)
    _actions.setdefault(task["id"], []).append(
        make_action(
            "approval_requested",
            "Approval requested.",
            actor=actor_from_payload(payload),
            task_id=task["id"],
            approval_id=approval["id"],
        )
    )
    return ok({"approval": approval})


@router.patch("/approvals/{approval_id}/process")
async def process_approval(approval_id: str, request: Request) -> dict[str, Any]:
    target = get_capability_target(Capability.APPROVALS)
    payload = await request.json()
    if target == ServiceTarget.PYTHON_BACKEND and use_formal_approval_service():
        process_request = ProcessApprovalRequest(
            decision=str(payload.get("decision")),
            reviewer_id=str(actor_from_payload(payload)["id"]),
            reviewer_name=str(actor_from_payload(payload)["name"]),
            comment=payload.get("comment"),
        )
        try:
            async with get_formal_approval_service() as service:
                approval = await service.process_approval(approval_id, process_request)
        except ApprovalNotFoundError as exc:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": str(exc)}) from exc
        compat_approval = approval_dto_to_compat(approval)
        if get_capability_target(Capability.TASKS) == ServiceTarget.PYTHON_BACKEND and use_formal_task_service_for_tasks():
            try:
                async with get_formal_task_service() as task_service:
                    task_detail = await task_service.get_task_detail(compat_approval["taskId"])
                sync_task_snapshot(apply_approval_overlay(task_dto_to_compat(task_detail.task), compat_approval))
            except TaskNotFoundError:
                pass
        else:
            task = next((item for item in _tasks if item.get("id") == compat_approval["taskId"]), None)
            if task:
                sync_task_snapshot(apply_approval_overlay(task, compat_approval))
        return ok({"approval": compat_approval})

    approval = find_by_id(_approvals, approval_id)
    decision = payload.get("decision")
    approval["status"] = {"approve": "approved", "reject": "rejected", "request_info": "needs_info"}.get(
        str(decision), str(decision)
    )
    approval["comment"] = payload.get("comment")
    approval["updatedAt"] = utc_now()
    _actions.setdefault(approval["taskId"], []).append(
        make_action(
            "approval_processed",
            payload.get("comment") or f"Approval decision: {decision}.",
            actor=actor_from_payload(payload),
            task_id=approval["taskId"],
            approval_id=approval_id,
        )
    )
    return ok({"approval": approval})


@router.get("/reports")
async def list_reports() -> dict[str, Any]:
    target = get_capability_target(Capability.REPORT)
    sync_completed_report_results()
    if target == ServiceTarget.PYTHON_BACKEND:
        try:
            formal_reports = await list_formal_reports()
            if formal_reports:
                for report in formal_reports[:5]:
                    ensure_report_delivery_attempt(report)
                return ok(formal_reports)
        except Exception:
            pass
    reports = [localize_report_presentation(report) for report in _reports]
    for report in reports[:5]:
        ensure_report_delivery_attempt(report)
    return ok(reports)


@router.post("/reports/generate")
async def generate_report(request: Request) -> dict[str, Any]:
    target = get_capability_target(Capability.REPORT)
    payload = await request.json()
    report_type = payload.get("type") or "daily"
    now = payload.get("now") or utc_now()
    actor = actor_from_payload(payload)

    if target == ServiceTarget.PYTHON_BACKEND:
        run_id = f"report-{uuid4()}"
        operator = str(actor.get("name") or actor.get("id") or "frontend-user")
        try:
            result = await generate_python_report_result(str(report_type), str(now), operator, run_id)
            report = build_report_from_result(run_id, result)
            await persist_formal_report(report)
        except Exception:
            result = {
                "date": str(now)[:10],
                "task_completions": len(_tasks),
                "approvals": len(_approvals),
                "metrics": {"activities": sum(len(items) for items in _actions.values())},
                "metadata": {
                    "timestamp": now,
                    "run_id": run_id,
                    "operator": operator,
                    "llmUsed": False,
                    "llmFallbackReason": "python_report_generation_failed",
                },
            }
            report = build_report_from_result(run_id, result)
        if not any(item.get("id") == report["id"] for item in _reports):
            _reports.insert(0, report)
        delivery_record = deliver_report_email(report, actor=actor, trigger_mode="auto")
        return ok({"report": report, "deliveryRecords": [delivery_record], "deliveryStatus": delivery_record["status"]})

    report = {
        "id": f"report-{uuid4()}",
        "type": report_type,
        "title": f"{str(report_type).title()} AI Work Summary",
        "summary": f"{len(_tasks)} tasks, {len(_approvals)} approvals, {len(_reports)} existing reports.",
        "highlights": [f"{len(_tasks)} tasks tracked", f"{len(_approvals)} approvals tracked"],
        "createdAt": now,
        "metadata": {"sections": [{"title": "Generated", "content": "Generated by Python /api/ai compatibility layer."}]},
    }
    _reports.insert(0, report)
    delivery_record = deliver_report_email(report, actor=actor, trigger_mode="auto")
    return ok({"report": report, "deliveryRecords": [delivery_record], "deliveryStatus": delivery_record["status"]})


@router.delete("/reports/{report_id}")
async def delete_report(report_id: str) -> dict[str, Any]:
    target = get_capability_target(Capability.REPORT)
    if target == ServiceTarget.PYTHON_BACKEND:
        try:
            if await delete_formal_report(report_id):
                return ok({"deletedReportId": report_id})
        except Exception:
            pass
    index = next((idx for idx, report in enumerate(_reports) if report["id"] == report_id), None)
    if index is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Report not found."})
    _reports.pop(index)
    return ok({"deletedReportId": report_id})


@router.get("/reports/{report_id}/pdf")
async def export_report_pdf(report_id: str) -> dict[str, Any]:
    target = get_capability_target(Capability.REPORT_PDF)
    report = None
    if target == ServiceTarget.PYTHON_BACKEND:
        try:
            report = await find_formal_report(report_id)
        except Exception:
            report = None
    report = report or find_by_id(_reports, report_id)
    report = localize_report_presentation(report)
    pdf_bytes = await export_to_pdf(render_report_html(report), report.get("metadata") or {})
    return ok(
        {
            "fileName": f"{report['id']}.pdf",
            "mimeType": "application/pdf",
            "contentBase64": base64.b64encode(pdf_bytes).decode("ascii"),
        }
    )


@router.get("/report-delivery/mappings")
def list_delivery_mappings() -> dict[str, Any]:
    capability_target(Capability.REPORT_DELIVERY)
    load_report_delivery_state()
    return ok(_delivery_mappings)


@router.post("/report-delivery/mappings")
async def create_delivery_mapping(request: Request) -> dict[str, Any]:
    capability_target(Capability.REPORT_DELIVERY)
    load_report_delivery_state()
    payload = await request.json()
    item = {"id": f"mapping-{uuid4()}", "createdAt": utc_now(), "updatedAt": utc_now(), **payload}
    _delivery_mappings.append(item)
    save_report_delivery_state()
    return ok(item)


@router.patch("/report-delivery/mappings/{mapping_id}")
async def update_delivery_mapping(mapping_id: str, request: Request) -> dict[str, Any]:
    capability_target(Capability.REPORT_DELIVERY)
    load_report_delivery_state()
    payload = await request.json()
    item = find_by_id(_delivery_mappings, mapping_id)
    item.update(payload)
    item["updatedAt"] = utc_now()
    save_report_delivery_state()
    return ok(item)


@router.get("/report-delivery/configs")
def list_delivery_configs() -> dict[str, Any]:
    capability_target(Capability.REPORT_DELIVERY)
    load_report_delivery_state()
    return ok(_delivery_configs)


@router.post("/report-delivery/configs")
async def create_delivery_config(request: Request) -> dict[str, Any]:
    capability_target(Capability.REPORT_DELIVERY)
    load_report_delivery_state()
    payload = await request.json()
    item = {"id": f"config-{uuid4()}", "createdAt": utc_now(), "updatedAt": utc_now(), **payload}
    _delivery_configs.append(item)
    save_report_delivery_state()
    return ok(item)


@router.patch("/report-delivery/configs/{config_id}")
async def update_delivery_config(config_id: str, request: Request) -> dict[str, Any]:
    capability_target(Capability.REPORT_DELIVERY)
    load_report_delivery_state()
    payload = await request.json()
    item = find_by_id(_delivery_configs, config_id)
    item.update(payload)
    item["updatedAt"] = utc_now()
    save_report_delivery_state()
    return ok(item)


@router.get("/report-delivery/records")
def list_delivery_records() -> dict[str, Any]:
    capability_target(Capability.REPORT_DELIVERY)
    load_report_delivery_state()
    return ok(_delivery_records)


@router.get("/analysis/summary")
async def get_analysis_summary(windowDays: int = 30) -> dict[str, Any]:
    capability_target(Capability.REPORT)
    safe_window_days = min(max(int(windowDays or 30), 1), 365)
    try:
        return ok(await _build_database_analysis_summary(safe_window_days))
    except Exception:
        return ok(_build_memory_analysis_summary(safe_window_days))


@router.post("/report-delivery/send")
async def send_report(request: Request) -> dict[str, Any]:
    capability_target(Capability.REPORT_DELIVERY)
    payload = await request.json()
    report = await find_report_for_delivery(payload.get("reportId"))
    actor = actor_from_payload(payload.get("actor"))
    record = deliver_report_email(
        report,
        actor=actor,
        trigger_mode="manual",
        recipient_email=payload.get("recipientEmail"),
        recipient_name=payload.get("recipientName"),
    )
    return ok({"records": [record]})

@router.post("/agents/task-tracking/execute")
async def execute_task_tracking_agent(request: Request) -> dict[str, Any]:
    capability_target(Capability.ASYNC)
    payload = await request.json()
    return ok({"state": {"input": payload, "output": {"taskCount": len(_tasks)}, "context": {}}})


@router.get("/routing/validate")
def validate_routing_endpoint() -> dict[str, Any]:
    """Validate routing consistency and return detailed report.

    This endpoint helps operators verify that capability routing is
    configured correctly before switching traffic.
    """
    warnings = validate_routing_consistency()
    snapshot = get_capability_routing_snapshot()

    # Check database connectivity for capabilities that need it
    db_required_capabilities = [Capability.TASKS, Capability.APPROVALS]
    db_status = {}

    settings = get_settings()
    if settings.database_url:
        for cap in db_required_capabilities:
            if get_capability_target(cap) == ServiceTarget.PYTHON_BACKEND:
                db_status[cap.value] = "required"

    return ok({
        "valid": len(warnings) == 0,
        "warnings": warnings,
        "snapshot": snapshot,
        "dependencies": {
            "tasks": ["approvals"],
            "rules": ["tasks"],
            "report": ["tasks"]
        },
        "database_status": db_status,
        "recommendations": [
            "Enable TASKS and APPROVALS together for data consistency",
            "Enable RULES only after TASKS is enabled",
            "Enable REPORT only after TASKS is enabled"
        ] if warnings else []
    })


@router.post("/agents/reporting/execute")
async def execute_reporting_agent(request: Request) -> dict[str, Any]:
    capability_target(Capability.ASYNC)
    payload = await request.json()
    return ok({"state": {"input": payload, "output": {"reportCount": len(_reports)}, "context": {}}})


@router.post("/reports/daily")
async def create_daily_report_compat(request: Request) -> dict[str, Any]:
    """Generate daily report asynchronously (compatibility layer).

    This endpoint proxies to the internal Python report generation API.
    Frontend should use this endpoint instead of /api/reports/daily.
    """
    capability_target(Capability.REPORT)
    payload = await request.json()
    date_str = payload.get("date")
    operator = payload.get("operator", "frontend-user")

    run_id = str(uuid4())
    submission = await submit_daily_report(date_str, operator, run_id)
    delivery_record = maybe_auto_deliver_generated_report(
        submission["task_id"],
        submission.get("result"),
        actor={"id": operator, "name": operator, "type": "user"},
    )
    if delivery_record:
        submission["deliveryRecords"] = [delivery_record]
        submission["deliveryStatus"] = delivery_record["status"]
    return ok(submission)


@router.post("/reports/weekly")
async def create_weekly_report_compat(request: Request) -> dict[str, Any]:
    """Generate weekly report asynchronously (compatibility layer).

    This endpoint proxies to the internal Python report generation API.
    Frontend should use this endpoint instead of /api/reports/weekly.
    """
    capability_target(Capability.REPORT)
    payload = await request.json()
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
    operator = payload.get("operator", "frontend-user")

    run_id = str(uuid4())
    submission = await submit_weekly_report(start_date, end_date, operator, run_id)
    delivery_record = maybe_auto_deliver_generated_report(
        submission["task_id"],
        submission.get("result"),
        actor={"id": operator, "name": operator, "type": "user"},
    )
    if delivery_record:
        submission["deliveryRecords"] = [delivery_record]
        submission["deliveryStatus"] = delivery_record["status"]
    return ok(submission)


@router.get("/reports/tasks/{task_id}")
async def get_report_task_status_compat(task_id: str) -> dict[str, Any]:
    """Get status of async report generation task (compatibility layer).

    This endpoint proxies to the internal Python report status API.
    Frontend should use this endpoint instead of /api/reports/tasks/{task_id}.
    """
    capability_target(Capability.REPORT)
    status = get_task_status(task_id)
    result = None
    delivery_record = None
    if status["ready"] and status["successful"]:
        try:
            result = get_task_result(task_id)
            delivery_record = maybe_auto_deliver_generated_report(task_id, result)
        except Exception:
            pass

    response = {
        "task_id": task_id,
        "status": status["status"],
        "state": status["state"],
        "ready": status["ready"],
        "successful": status["successful"],
        "result": result
    }
    if delivery_record:
        response["deliveryRecords"] = [delivery_record]
        response["deliveryStatus"] = delivery_record["status"]
    return ok(response)


def find_by_id(items: list[dict[str, Any]], item_id: Any) -> dict[str, Any]:
    for item in items:
        if item.get("id") == item_id:
            return item
    raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Resource not found."})


def find_task_approval(task_id: str) -> dict[str, Any] | None:
    return next((approval for approval in _approvals if approval["taskId"] == task_id), None)

