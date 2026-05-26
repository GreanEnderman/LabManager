"""SLA repository for database operations."""

from typing import Any

from psycopg import AsyncConnection
from psycopg.types.json import Json

from app.tasks.models import AITaskRecord, AITaskStatus


async def list_tasks_for_sla_inspection(
    conn: AsyncConnection,
    statuses: list[AITaskStatus],
) -> list[AITaskRecord]:
    """List tasks that should be inspected for SLA violations.

    Args:
        conn: Database connection
        statuses: List of task statuses to inspect (e.g., ['open', 'in_progress', 'pending_approval'])

    Returns:
        List of task records ordered by created_at (oldest first)
    """
    if not statuses:
        return []

    placeholders = ", ".join(["%s"] * len(statuses))
    sql = f"""
        SELECT
            id, event_id, task_type, title, summary, recommendation,
            status, priority, risk_level, source_type, source_id, source_name,
            assignee_id, assignee_name, assignee_role, requires_approval,
            due_at, created_at, updated_at, closed_at, metadata
        FROM ai_tasks
        WHERE status IN ({placeholders})
        ORDER BY created_at ASC
    """

    async with conn.cursor() as cur:
        await cur.execute(sql, statuses)
        rows = await cur.fetchall()

        return [
            AITaskRecord(
                id=row[0],
                event_id=row[1],
                type=row[2],
                title=row[3],
                summary=row[4],
                recommendation=row[5],
                status=row[6],
                priority=row[7],
                risk_level=row[8],
                source_type=row[9],
                source_id=row[10],
                source_name=row[11],
                assignee_id=row[12],
                assignee_name=row[13],
                assignee_role=row[14],
                requires_approval=row[15],
                due_at=row[16],
                created_at=row[17],
                updated_at=row[18],
                closed_at=row[19],
                metadata=row[20] or {},
            )
            for row in rows
        ]


async def update_task_sla_metadata(
    conn: AsyncConnection,
    task_id: str,
    metadata_patch: dict[str, Any],
    updated_at: str,
) -> None:
    """Update task SLA metadata fields using JSONB merge.

    Args:
        conn: Database connection
        task_id: Task ID to update
        metadata_patch: Metadata fields to merge (e.g., {'slaReminderCount': 1})
        updated_at: Timestamp for updated_at field
    """
    sql = """
        UPDATE ai_tasks
        SET
            metadata = metadata || %s::jsonb,
            updated_at = %s
        WHERE id = %s
    """

    async with conn.cursor() as cur:
        await cur.execute(sql, (Json(metadata_patch), updated_at, task_id))
