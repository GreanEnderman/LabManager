"""Task repository for database operations."""

from datetime import datetime
from typing import Optional

from psycopg import AsyncConnection
from psycopg.types.json import Json

from app.tasks.models import (
    AITaskRecord,
    AITaskStatus,
    AITaskType,
    AIPriority,
    AISourceType,
    ListTasksQuery,
    TaskActionDTO,
    AuditActor,
)


async def list_tasks(
    conn: AsyncConnection,
    query: ListTasksQuery,
) -> list[AITaskRecord]:
    """List tasks with optional filters."""
    conditions = []
    params = []

    if query.status:
        conditions.append("status = %s")
        params.append(query.status)

    if query.type:
        conditions.append("task_type = %s")
        params.append(query.type)

    if query.priority:
        conditions.append("priority = %s")
        params.append(query.priority)

    if query.source_type:
        conditions.append("source_type = %s")
        params.append(query.source_type)

    if query.assignee_id:
        conditions.append("assignee_id = %s")
        params.append(query.assignee_id)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    sql = f"""
        SELECT
            id, event_id, task_type, title, summary, recommendation,
            status, priority, risk_level, source_type, source_id, source_name,
            assignee_id, assignee_name, assignee_role, requires_approval,
            due_at, created_at, updated_at, closed_at, metadata
        FROM ai_tasks
        {where_clause}
        ORDER BY updated_at DESC
    """

    async with conn.cursor() as cur:
        await cur.execute(sql, params)
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


async def get_task_by_id(
    conn: AsyncConnection,
    task_id: str,
) -> Optional[AITaskRecord]:
    """Get task by ID."""
    sql = """
        SELECT
            id, event_id, task_type, title, summary, recommendation,
            status, priority, risk_level, source_type, source_id, source_name,
            assignee_id, assignee_name, assignee_role, requires_approval,
            due_at, created_at, updated_at, closed_at, metadata
        FROM ai_tasks
        WHERE id = %s
    """

    async with conn.cursor() as cur:
        await cur.execute(sql, (task_id,))
        row = await cur.fetchone()

        if not row:
            return None

        return AITaskRecord(
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


async def create_task(
    conn: AsyncConnection,
    task: AITaskRecord,
) -> AITaskRecord:
    """Create a new task."""
    sql = """
        INSERT INTO ai_tasks (
            id, event_id, task_type, title, summary, recommendation,
            status, priority, risk_level, source_type, source_id, source_name,
            assignee_id, assignee_name, assignee_role, requires_approval,
            due_at, created_at, updated_at, closed_at, metadata
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        RETURNING
            id, event_id, task_type, title, summary, recommendation,
            status, priority, risk_level, source_type, source_id, source_name,
            assignee_id, assignee_name, assignee_role, requires_approval,
            due_at, created_at, updated_at, closed_at, metadata
    """

    async with conn.cursor() as cur:
        await cur.execute(
            sql,
            (
                task.id,
                task.event_id,
                task.task_type,
                task.title,
                task.summary,
                task.recommendation,
                task.status,
                task.priority,
                task.risk_level,
                task.source_type,
                task.source_id,
                task.source_name,
                task.assignee_id,
                task.assignee_name,
                task.assignee_role,
                task.requires_approval,
                task.due_at,
                task.created_at,
                task.updated_at,
                task.closed_at,
                Json(task.metadata),
            ),
        )
        row = await cur.fetchone()

        return AITaskRecord(
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


async def update_task_status(
    conn: AsyncConnection,
    task_id: str,
    status: AITaskStatus,
    closed_at: Optional[datetime] = None,
) -> bool:
    """Update task status."""
    sql = """
        UPDATE ai_tasks
        SET status = %s, updated_at = now(), closed_at = %s
        WHERE id = %s
    """

    async with conn.cursor() as cur:
        await cur.execute(sql, (status, closed_at, task_id))
        return cur.rowcount > 0


async def update_task_metadata(
    conn: AsyncConnection,
    task_id: str,
    metadata: dict,
) -> bool:
    """Replace task metadata."""
    sql = """
        UPDATE ai_tasks
        SET metadata = %s, updated_at = now()
        WHERE id = %s
    """

    async with conn.cursor() as cur:
        await cur.execute(sql, (Json(metadata), task_id))
        return cur.rowcount > 0


async def update_task_assignee(
    conn: AsyncConnection,
    task_id: str,
    assignee_id: str,
    assignee_name: str,
    assignee_role: Optional[str],
) -> bool:
    """Update task assignee."""
    sql = """
        UPDATE ai_tasks
        SET assignee_id = %s, assignee_name = %s, assignee_role = %s, updated_at = now()
        WHERE id = %s
    """

    async with conn.cursor() as cur:
        await cur.execute(sql, (assignee_id, assignee_name, assignee_role, task_id))
        return cur.rowcount > 0


async def list_task_actions(
    conn: AsyncConnection,
    task_id: str,
) -> list[TaskActionDTO]:
    """List actions for a task."""
    sql = """
        SELECT
            id, task_id, approval_id, action_type, from_status, to_status,
            actor, reason_codes, detail, tool_name, snapshot, created_at
        FROM ai_task_actions
        WHERE task_id = %s
        ORDER BY created_at DESC
    """

    async with conn.cursor() as cur:
        await cur.execute(sql, (task_id,))
        rows = await cur.fetchall()

        return [
            TaskActionDTO(
                id=row[0],
                task_id=row[1],
                approval_id=row[2],
                action_type=row[3],
                from_status=row[4],
                to_status=row[5],
                actor=AuditActor(**row[6]),
                reason_codes=row[7] or [],
                detail=row[8],
                tool_name=row[9],
                snapshot=row[10] or {},
                created_at=row[11],
            )
            for row in rows
        ]


async def create_task_action(
    conn: AsyncConnection,
    action_id: str,
    task_id: str,
    approval_id: Optional[str],
    action_type: str,
    from_status: Optional[AITaskStatus],
    to_status: Optional[AITaskStatus],
    actor: AuditActor,
    reason_codes: list[str],
    detail: str,
    tool_name: Optional[str],
    snapshot: dict,
    created_at: datetime,
) -> None:
    """Create a task action log."""
    sql = """
        INSERT INTO ai_task_actions (
            id, task_id, approval_id, action_type, from_status, to_status,
            actor, reason_codes, detail, tool_name, snapshot, created_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
    """

    async with conn.cursor() as cur:
        await cur.execute(
            sql,
            (
                action_id,
                task_id,
                approval_id,
                action_type,
                from_status,
                to_status,
                Json(actor.model_dump()),
                Json(reason_codes),
                detail,
                tool_name,
                Json(snapshot),
                created_at,
            ),
        )
