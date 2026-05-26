from datetime import date

from psycopg import AsyncConnection


async def get_approval_records(conn: AsyncConnection, start_date: date, end_date: date) -> list[dict]:
    """Query approval records for date range."""
    query = """
        SELECT
            id,
            decided_at,
            reviewer_name,
            status,
            'task' as entity_type,
            task_id
        FROM approvals
        WHERE decided_at >= %s AND decided_at < %s
        AND decided_at IS NOT NULL
        ORDER BY decided_at
    """
    async with conn.cursor() as cur:
        await cur.execute(query, (start_date, end_date))
        rows = await cur.fetchall()
        return [
            {
                "approval_id": row[0],
                "approved_at": row[1],
                "approved_by": row[2],
                "status": row[3],
                "entity_type": row[4],
                "entity_id": row[5],
            }
            for row in rows
        ]


async def count_approvals(conn: AsyncConnection, target_date: date) -> int:
    """Count approvals for a specific date."""
    query = """
        SELECT COUNT(*)
        FROM approvals
        WHERE DATE(decided_at) = %s
        AND decided_at IS NOT NULL
    """
    async with conn.cursor() as cur:
        await cur.execute(query, (target_date,))
        result = await cur.fetchone()
        return result[0] if result else 0
