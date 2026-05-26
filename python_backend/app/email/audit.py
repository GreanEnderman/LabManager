import logging
from datetime import datetime
from typing import Optional

from app.db.postgres import get_db_connection
from app.email.models import EmailSendRecord

logger = logging.getLogger(__name__)


async def create_send_record(
    recipients: str,
    subject: str,
    status: str,
    operator_id: Optional[int] = None,
    task_run_id: Optional[str] = None,
    report_id: Optional[int] = None,
    error: Optional[str] = None
) -> int:
    """Create email send record."""
    async with get_db_connection() as conn:
        result = await conn.fetchrow(
            """
            INSERT INTO email_send_records
            (recipients, subject, status, operator_id, task_run_id, report_id, error, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING id
            """,
            recipients, subject, status, operator_id, task_run_id, report_id, error
        )
        return result['id']


async def update_send_record_status(
    record_id: int,
    status: str,
    error: Optional[str] = None
) -> None:
    """Update send record status."""
    async with get_db_connection() as conn:
        await conn.execute(
            """
            UPDATE email_send_records
            SET status = $1, error = $2, updated_at = NOW()
            WHERE id = $3
            """,
            status, error, record_id
        )


async def get_send_history(
    report_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    recipient: Optional[str] = None
) -> list[EmailSendRecord]:
    """Query send history with filters."""
    conditions = []
    params = []
    param_idx = 1

    if report_id:
        conditions.append(f"report_id = ${param_idx}")
        params.append(report_id)
        param_idx += 1

    if start_date:
        conditions.append(f"created_at >= ${param_idx}")
        params.append(start_date)
        param_idx += 1

    if end_date:
        conditions.append(f"created_at <= ${param_idx}")
        params.append(end_date)
        param_idx += 1

    if recipient:
        conditions.append(f"recipients LIKE ${param_idx}")
        params.append(f"%{recipient}%")
        param_idx += 1

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    async with get_db_connection() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM email_send_records WHERE {where_clause} ORDER BY created_at DESC",
            *params
        )
        return [EmailSendRecord(**dict(row)) for row in rows]
