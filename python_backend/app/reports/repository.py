"""Report repository for database operations.

This module provides a consistent repository pattern for report data access,
matching the task/approval repository pattern.
"""

from datetime import date
from typing import Optional
from psycopg import AsyncConnection

from app.reports.models import (
    TaskCompletionRecord,
    ApprovalRecord,
    ActivityMetrics,
)


async def get_task_completions(
    conn: AsyncConnection,
    start_date: date,
    end_date: date,
) -> list[TaskCompletionRecord]:
    """Get task completions for date range.

    Args:
        conn: Database connection
        start_date: Start date (inclusive)
        end_date: End date (exclusive)

    Returns:
        List of task completion records
    """
    query = """
        SELECT
            id, task_type, status, closed_at,
            assignee_id, assignee_name, priority, risk_level
        FROM ai_tasks
        WHERE closed_at >= %s AND closed_at < %s
        AND status = 'completed'
        ORDER BY closed_at
    """

    async with conn.cursor() as cur:
        await cur.execute(query, (start_date, end_date))
        rows = await cur.fetchall()

        return [
            TaskCompletionRecord(
                task_id=row[0],
                type=row[1],
                status=row[2],
                completed_at=row[3],
                assignee_id=row[4],
                assignee_name=row[5],
                priority=row[6],
                risk_level=row[7],
            )
            for row in rows
        ]


async def count_task_completions(
    conn: AsyncConnection,
    target_date: date,
) -> int:
    """Count task completions for a specific date.

    Args:
        conn: Database connection
        target_date: Target date

    Returns:
        Count of completed tasks
    """
    query = """
        SELECT COUNT(*)
        FROM ai_tasks
        WHERE DATE(closed_at) = %s
        AND status = 'completed'
    """

    async with conn.cursor() as cur:
        await cur.execute(query, (target_date,))
        result = await cur.fetchone()
        return result[0] if result else 0


async def get_approval_records(
    conn: AsyncConnection,
    start_date: date,
    end_date: date,
) -> list[ApprovalRecord]:
    """Get approval records for date range.

    Args:
        conn: Database connection
        start_date: Start date (inclusive)
        end_date: End date (exclusive)

    Returns:
        List of approval records
    """
    query = """
        SELECT
            id, task_id, status, decided_at,
            reviewer_id, reviewer_name, risk_level
        FROM ai_approvals
        WHERE decided_at >= %s AND decided_at < %s
        AND status IN ('approved', 'rejected')
        ORDER BY decided_at
    """

    async with conn.cursor() as cur:
        await cur.execute(query, (start_date, end_date))
        rows = await cur.fetchall()

        return [
            ApprovalRecord(
                approval_id=row[0],
                task_id=row[1],
                status=row[2],
                decided_at=row[3],
                reviewer_id=row[4],
                reviewer_name=row[5],
                risk_level=row[6],
            )
            for row in rows
        ]


async def count_approvals(
    conn: AsyncConnection,
    target_date: date,
) -> int:
    """Count approvals for a specific date.

    Args:
        conn: Database connection
        target_date: Target date

    Returns:
        Count of decided approvals
    """
    query = """
        SELECT COUNT(*)
        FROM ai_approvals
        WHERE DATE(decided_at) = %s
        AND status IN ('approved', 'rejected')
    """

    async with conn.cursor() as cur:
        await cur.execute(query, (target_date,))
        result = await cur.fetchone()
        return result[0] if result else 0


async def get_activity_metrics(
    conn: AsyncConnection,
    start_date: date,
    end_date: date,
) -> ActivityMetrics:
    """Get activity metrics for date range.

    Args:
        conn: Database connection
        start_date: Start date (inclusive)
        end_date: End date (exclusive)

    Returns:
        Activity metrics
    """
    # Count total actions
    total_query = """
        SELECT COUNT(*)
        FROM ai_task_actions
        WHERE created_at >= %s AND created_at < %s
    """

    # Count by action type
    by_type_query = """
        SELECT action_type, COUNT(*)
        FROM ai_task_actions
        WHERE created_at >= %s AND created_at < %s
        GROUP BY action_type
    """

    # Count by actor
    by_actor_query = """
        SELECT actor->>'id', actor->>'name', COUNT(*)
        FROM ai_task_actions
        WHERE created_at >= %s AND created_at < %s
        GROUP BY actor->>'id', actor->>'name'
    """

    async with conn.cursor() as cur:
        # Get total
        await cur.execute(total_query, (start_date, end_date))
        total_result = await cur.fetchone()
        total_actions = total_result[0] if total_result else 0

        # Get by type
        await cur.execute(by_type_query, (start_date, end_date))
        by_type_rows = await cur.fetchall()
        by_type = {row[0]: row[1] for row in by_type_rows}

        # Get by actor
        await cur.execute(by_actor_query, (start_date, end_date))
        by_actor_rows = await cur.fetchall()
        by_actor = {
            row[0]: {"name": row[1], "count": row[2]} for row in by_actor_rows
        }

        return ActivityMetrics(
            total_actions=total_actions,
            by_type=by_type,
            by_actor=by_actor,
        )


async def get_daily_activity_count(
    conn: AsyncConnection,
    target_date: date,
) -> int:
    """Get activity count for a specific date.

    Args:
        conn: Database connection
        target_date: Target date

    Returns:
        Count of activities
    """
    query = """
        SELECT COUNT(*)
        FROM ai_task_actions
        WHERE DATE(created_at) = %s
    """

    async with conn.cursor() as cur:
        await cur.execute(query, (target_date,))
        result = await cur.fetchone()
        return result[0] if result else 0
