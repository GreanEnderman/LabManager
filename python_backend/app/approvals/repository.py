"""Approval repository for database operations."""

from datetime import datetime

from psycopg import AsyncConnection
from psycopg.types.json import Json

from app.approvals.models import AIApprovalRecord, AIApprovalStatus


async def list_approvals(conn: AsyncConnection) -> list[AIApprovalRecord]:
    sql = """
        SELECT
            id, task_id, title, reason, status, risk_level,
            requested_by, reviewer_id, reviewer_name, comment,
            created_at, updated_at, decided_at, metadata
        FROM approvals
        ORDER BY updated_at DESC
    """
    async with conn.cursor() as cur:
        await cur.execute(sql)
        rows = await cur.fetchall()
    return [_row_to_record(row) for row in rows]


async def get_approval_by_id(conn: AsyncConnection, approval_id: str) -> AIApprovalRecord | None:
    sql = """
        SELECT
            id, task_id, title, reason, status, risk_level,
            requested_by, reviewer_id, reviewer_name, comment,
            created_at, updated_at, decided_at, metadata
        FROM approvals
        WHERE id = %s
    """
    async with conn.cursor() as cur:
        await cur.execute(sql, (approval_id,))
        row = await cur.fetchone()
    if not row:
        return None
    return _row_to_record(row)


async def get_latest_approval_for_task(conn: AsyncConnection, task_id: str) -> AIApprovalRecord | None:
    sql = """
        SELECT
            id, task_id, title, reason, status, risk_level,
            requested_by, reviewer_id, reviewer_name, comment,
            created_at, updated_at, decided_at, metadata
        FROM approvals
        WHERE task_id = %s
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
    """
    async with conn.cursor() as cur:
        await cur.execute(sql, (task_id,))
        row = await cur.fetchone()
    if not row:
        return None
    return _row_to_record(row)


async def create_approval(conn: AsyncConnection, approval: AIApprovalRecord) -> AIApprovalRecord:
    sql = """
        INSERT INTO approvals (
            id, task_id, title, reason, status, risk_level,
            requested_by, reviewer_id, reviewer_name, comment,
            created_at, updated_at, decided_at, metadata
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s
        )
        RETURNING
            id, task_id, title, reason, status, risk_level,
            requested_by, reviewer_id, reviewer_name, comment,
            created_at, updated_at, decided_at, metadata
    """
    async with conn.cursor() as cur:
        await cur.execute(
            sql,
            (
                approval.id,
                approval.task_id,
                approval.title,
                approval.reason,
                approval.status,
                approval.risk_level,
                Json(approval.requested_by.model_dump()),
                approval.reviewer_id,
                approval.reviewer_name,
                approval.comment,
                approval.created_at,
                approval.updated_at,
                approval.decided_at,
                Json(approval.metadata),
            ),
        )
        row = await cur.fetchone()
    return _row_to_record(row)


async def update_approval_processing(
    conn: AsyncConnection,
    approval_id: str,
    *,
    status: AIApprovalStatus,
    reviewer_id: str,
    reviewer_name: str,
    comment: str | None,
    updated_at: datetime,
    decided_at: datetime | None,
) -> AIApprovalRecord | None:
    sql = """
        UPDATE approvals
        SET
            status = %s,
            reviewer_id = %s,
            reviewer_name = %s,
            comment = %s,
            updated_at = %s,
            decided_at = %s
        WHERE id = %s
        RETURNING
            id, task_id, title, reason, status, risk_level,
            requested_by, reviewer_id, reviewer_name, comment,
            created_at, updated_at, decided_at, metadata
    """
    async with conn.cursor() as cur:
        await cur.execute(
            sql,
            (status, reviewer_id, reviewer_name, comment, updated_at, decided_at, approval_id),
        )
        row = await cur.fetchone()
    if not row:
        return None
    return _row_to_record(row)


def _row_to_record(row: tuple) -> AIApprovalRecord:
    return AIApprovalRecord(
        id=row[0],
        task_id=row[1],
        title=row[2],
        reason=row[3],
        status=row[4],
        risk_level=row[5],
        requested_by=row[6],
        reviewer_id=row[7],
        reviewer_name=row[8],
        comment=row[9],
        created_at=row[10],
        updated_at=row[11],
        decided_at=row[12],
        metadata=row[13] or {},
    )
