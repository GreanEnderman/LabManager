"""Dashboard overview API endpoints."""
from fastapi import APIRouter
from datetime import datetime, timedelta, timezone
from typing import Dict, Any

from app.db.postgres import get_db_connection
from app.inventory.thresholds import get_effective_chemical_threshold
from app.settings.service import SettingsService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview")
async def get_dashboard_overview() -> Dict[str, Any]:
    """
    Get dashboard overview statistics including:
    - Chemical inventory stats
    - Equipment stats
    - Movement (inbound/outbound) stats
    - AI workflow stats (tasks, approvals, events, reports)
    """

    async with get_db_connection() as conn:
        settings_service = SettingsService(conn)
        ai_settings = await settings_service.get_settings()

        async with conn.cursor() as cur:
            # Query chemical stats
            await cur.execute("SELECT COUNT(*) FROM chemicals")
            chemical_count = (await cur.fetchone())[0]

            await cur.execute(
                """
                SELECT id, name, current_quantity, threshold
                FROM chemicals
                WHERE status != 'deleted'
                """
            )
            chemical_rows = await cur.fetchall()
            low_stock_count = len(
                [
                    row
                    for row in chemical_rows
                    if float(row[2] or 0)
                    <= get_effective_chemical_threshold(
                        {"id": row[0], "name": row[1], "currentQuantity": row[2], "threshold": row[3]},
                        ai_settings.thresholds,
                    )
                ]
            )

            # Query movement stats
            await cur.execute(
                "SELECT COUNT(*) FROM inventory_movements WHERE movement_type = 'inbound'"
            )
            inbound_count = (await cur.fetchone())[0]

            await cur.execute(
                "SELECT COUNT(*) FROM inventory_movements WHERE movement_type = 'outbound'"
            )
            outbound_count = (await cur.fetchone())[0]

            # Query equipment stats
            await cur.execute("SELECT COUNT(*) FROM equipment")
            equipment_count = (await cur.fetchone())[0]

            # Query overdue equipment (maintenance overdue by more than 30 days)
            await cur.execute(
                """
                SELECT COUNT(*) FROM equipment
                WHERE last_maintenance_at IS NOT NULL
                AND last_maintenance_at < CURRENT_DATE - INTERVAL '30 days'
                """
            )
            overdue_equipment_count = (await cur.fetchone())[0]

            # Count open tasks
            await cur.execute(
                """
                SELECT COUNT(*) FROM ai_tasks
                WHERE status IN ('open', 'in_progress')
                """
            )
            open_task_count = (await cur.fetchone())[0]

            # Count high priority tasks
            await cur.execute(
                """
                SELECT COUNT(*) FROM ai_tasks
                WHERE status IN ('open', 'in_progress') AND priority = 'high'
                """
            )
            high_priority_task_count = (await cur.fetchone())[0]

            # Count pending approvals
            await cur.execute(
                """
                SELECT COUNT(*) FROM approvals
                WHERE status = 'pending'
                """
            )
            pending_approval_count = (await cur.fetchone())[0]

            # Count reports (last 30 days)
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            await cur.execute(
                """
                SELECT COUNT(*) FROM ai_reports
                WHERE created_at >= %s
                """,
                (thirty_days_ago,)
            )
            report_count = (await cur.fetchone())[0]

            # Count events (we'll use tasks as proxy for events for now)
            event_count = open_task_count

    return {
        "inventory": {
            "chemicalCount": chemical_count,
            "lowStockCount": low_stock_count,
            "inboundCount": inbound_count,
            "outboundCount": outbound_count,
            "equipmentCount": equipment_count,
            "overdueEquipmentCount": overdue_equipment_count,
        },
        "aiWorkflow": {
            "eventCount": event_count,
            "openTaskCount": open_task_count,
            "pendingApprovalCount": pending_approval_count,
            "reportCount": report_count,
            "highPriorityTaskCount": high_priority_task_count,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/low-stock-chemicals")
async def get_low_stock_chemicals(limit: int = 4) -> Dict[str, Any]:
    """Get low stock chemicals for dashboard display."""
    async with get_db_connection() as conn:
        settings_service = SettingsService(conn)
        ai_settings = await settings_service.get_settings()

        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT id, name, current_quantity, threshold, image_data_url
                FROM chemicals
                WHERE status != 'deleted'
                ORDER BY current_quantity ASC
                """
            )
            rows = await cur.fetchall()

            data = [
                {
                    "id": row[0],
                    "name": row[1],
                    "totalQuantity": row[2],
                    "threshold": effective_threshold,
                    "image": row[4],
                }
                for row in rows
                if (
                    float(row[2] or 0)
                    <= (
                        effective_threshold := get_effective_chemical_threshold(
                            {"id": row[0], "name": row[1], "currentQuantity": row[2], "threshold": row[3]},
                            ai_settings.thresholds,
                        )
                    )
                )
            ][:limit]

    return {"data": data}


@router.get("/recent-maintenance")
async def get_recent_maintenance(limit: int = 4) -> Dict[str, Any]:
    """Get recent equipment maintenance records for dashboard display."""
    async with get_db_connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT id, name, last_maintenance_at, status, image_data_url
                FROM equipment
                WHERE last_maintenance_at IS NOT NULL
                ORDER BY last_maintenance_at DESC
                LIMIT %s
                """,
                (limit,)
            )
            rows = await cur.fetchall()

            data = [
                {
                    "id": row[0],
                    "name": row[1],
                    "lastMaintenanceAt": row[2].isoformat() if row[2] else None,
                    "status": row[3],
                    "image": row[4],
                }
                for row in rows
            ]

    return {"data": data}
