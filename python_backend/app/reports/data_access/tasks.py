from datetime import date

from psycopg import AsyncConnection


async def get_task_completions(conn: AsyncConnection, start_date: date, end_date: date) -> list[dict]:
    """Query task completions for date range."""
    query = """
        SELECT
            id,
            closed_at,
            assignee_name,
            status
        FROM ai_tasks
        WHERE closed_at >= %s AND closed_at < %s
        AND status = 'completed'
        ORDER BY closed_at
    """
    async with conn.cursor() as cur:
        await cur.execute(query, (start_date, end_date))
        rows = await cur.fetchall()
        return [
            {
                "task_id": row[0],
                "completed_at": row[1],
                "completed_by": row[2],
                "status": row[3],
            }
            for row in rows
        ]


async def count_task_completions(conn: AsyncConnection, target_date: date) -> int:
    """Count task completions for a specific date."""
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
