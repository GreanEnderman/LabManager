"""Celery tasks for scanning business data and executing rule workflows."""

from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from app.core.logging import get_logger
from app.tasks.celery_app import celery_app

logger = get_logger(__name__)


def _as_aware_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, date):
        parsed = datetime.combine(value, time.min)
    else:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


@celery_app.task(name="rules.scan_and_execute")
def scan_and_execute_rules():
    """Scan inventory/equipment data and create AI workflow tasks."""
    import asyncio

    async def _run():
        logger.info("Starting rules scan and execution")

        from app.core.config import get_settings
        from app.core.event_mappings import EventMappings
        from app.db.postgres import get_db_connection
        from app.graphs.rules_adapter import SupervisorRulesAdapter
        from app.graphs.supervisor import run_supervisor_graph_async
        from app.graphs.tools import (
            ApprovalServiceApprovalTool,
            SupervisorTools,
            TaskActionAuditLogTool,
            TaskServiceTaskTool,
        )
        from app.rules.engine import RulesEngine

        settings = get_settings()
        if not settings.database_url:
            logger.warning("Database not configured, skipping rules scan")
            return {
                "events_found": 0,
                "tasks_created": 0,
                "skipped_reason": "database_not_configured",
            }

        async with get_db_connection() as conn:
            import psycopg.rows

            async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                await cur.execute(
                    """
                    SELECT
                        id, name, cas_number as "casNumber", category,
                        current_quantity as "currentQuantity", threshold, unit, status
                    FROM chemicals
                    WHERE status != 'deleted'
                    """
                )
                chemicals = await cur.fetchall()

            async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                await cur.execute(
                    """
                    SELECT
                        id, name, status,
                        last_maintenance_at as "lastMaintenanceAt",
                        next_maintenance_at as "nextMaintenanceAt"
                    FROM equipment
                    WHERE status != 'deleted'
                    """
                )
                equipment = await cur.fetchall()

        logger.info("Loaded %s chemicals, %s equipment", len(chemicals), len(equipment))

        events: list[dict[str, Any]] = []
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        for chem in chemicals:
            current_qty = chem.get("currentQuantity") or 0
            threshold = chem.get("threshold") or 0
            if current_qty <= threshold:
                events.append(
                    {
                        "id": f"event-low-stock-{chem['id']}",
                        "type": "low_stock",
                        "sourceType": "chemical",
                        "sourceId": str(chem["id"]),
                        "sourceName": str(chem["name"]),
                        "title": "Low stock detected",
                        "summary": f"Current quantity {current_qty} is below or equal to threshold {threshold}",
                        "priority": EventMappings.event_to_priority("low_stock"),
                        "riskLevel": EventMappings.event_to_risk_level("low_stock"),
                        "suggestedTaskType": EventMappings.event_to_compat_task_type("low_stock"),
                        "createdAt": now,
                        "evidence": [
                            {"label": "Current quantity", "value": current_qty},
                            {"label": "Threshold", "value": threshold},
                        ],
                    }
                )

        maintenance_overdue_days = int(getattr(settings, "maintenance_overdue_days", 30) or 30)
        cutoff = datetime.now(timezone.utc) - timedelta(days=maintenance_overdue_days)
        fault_statuses = {"fault", "故障", "异常", "needs_maintenance"}

        for equip in equipment:
            status = str(equip.get("status") or "")
            if status in fault_statuses:
                events.append(
                    {
                        "id": f"event-equipment-fault-{equip['id']}",
                        "type": "equipment_fault",
                        "sourceType": "equipment",
                        "sourceId": str(equip["id"]),
                        "sourceName": str(equip["name"]),
                        "title": "Equipment fault detected",
                        "summary": f"Equipment status: {status}",
                        "priority": EventMappings.event_to_priority("equipment_fault"),
                        "riskLevel": EventMappings.event_to_risk_level("equipment_fault"),
                        "suggestedTaskType": EventMappings.event_to_compat_task_type("equipment_fault"),
                        "createdAt": now,
                        "evidence": [{"label": "Status", "value": status}],
                    }
                )
                continue

            maintenance_at = _as_aware_datetime(equip.get("lastMaintenanceAt"))
            if maintenance_at and maintenance_at < cutoff:
                events.append(
                    {
                        "id": f"event-maintenance-overdue-{equip['id']}",
                        "type": "maintenance_overdue",
                        "sourceType": "equipment",
                        "sourceId": str(equip["id"]),
                        "sourceName": str(equip["name"]),
                        "title": "Maintenance overdue",
                        "summary": f"Last maintenance is older than {maintenance_overdue_days} days",
                        "priority": EventMappings.event_to_priority("maintenance_overdue"),
                        "riskLevel": EventMappings.event_to_risk_level("maintenance_overdue"),
                        "suggestedTaskType": EventMappings.event_to_compat_task_type("maintenance_overdue"),
                        "createdAt": now,
                        "evidence": [
                            {"label": "Last maintenance", "value": str(equip.get("lastMaintenanceAt"))},
                            {"label": "Overdue days", "value": maintenance_overdue_days},
                        ],
                    }
                )

        logger.info("Rules engine found %s events", len(events))

        rules_engine = RulesEngine()
        created_tasks: list[str] = []
        for event in events:
            try:
                task_tool = TaskServiceTaskTool(get_db_connection)
                approval_tool = ApprovalServiceApprovalTool(get_db_connection)
                audit_log_tool = TaskActionAuditLogTool(get_db_connection)
                rules_adapter = SupervisorRulesAdapter(rules_engine, task_tool=task_tool)
                tools = SupervisorTools(
                    task_tool=task_tool,
                    approval_tool=approval_tool,
                    audit_log_tool=audit_log_tool,
                    rules_adapter=rules_adapter,
                )
                state = await run_supervisor_graph_async(
                    event=event,
                    actor={"id": "system", "name": "Rules Scanner", "type": "system"},
                    tools=tools,
                )
                task_id = state.get("output", {}).get("taskId")
                if task_id:
                    created_tasks.append(task_id)
                    logger.info("Created task %s for event %s", task_id, event.get("type"))
                    try:
                        await audit_log_tool.write_many(
                            [
                                {
                                    "taskId": task_id,
                                    "actionType": "rules_scan_matched",
                                    "detail": f"Rules scan matched event {event.get('type')} for {event.get('sourceName')}.",
                                    "actor": {"id": "system", "name": "Rules Scanner", "type": "system"},
                                    "toolName": "rules.scan_and_execute",
                                    "snapshot": {"event": event},
                                }
                            ]
                        )
                    except Exception as audit_exc:
                        logger.warning("Failed to write scan audit log for task %s: %s", task_id, audit_exc)
            except Exception as exc:
                logger.error("Failed to process event %s: %s", event.get("id"), exc, exc_info=True)

        logger.info("Rules scan completed: %s tasks created", len(created_tasks))
        return {
            "events_found": len(events),
            "tasks_created": len(created_tasks),
            "task_ids": created_tasks,
        }

    return asyncio.run(_run())
