from datetime import date

from psycopg import AsyncConnection


async def get_activity_metrics(conn: AsyncConnection, start_date: date, end_date: date) -> dict:
    """Query activity log metrics for date range."""
    query = """
        SELECT
            COUNT(*) as total_activities,
            COUNT(DISTINCT (actor->>'id')) as active_users,
            COUNT(DISTINCT action_type) as entity_types
        FROM ai_task_actions
        WHERE created_at >= %s AND created_at < %s
    """
    async with conn.cursor() as cur:
        await cur.execute(query, (start_date, end_date))
        row = await cur.fetchone()
        return {
            "total_activities": row[0] if row else 0,
            "active_users": row[1] if row else 0,
            "entity_types": row[2] if row else 0,
        }


async def get_daily_activity_count(conn: AsyncConnection, target_date: date) -> int:
    """Count activity log entries for a specific date."""
    query = """
        SELECT COUNT(*)
        FROM ai_task_actions
        WHERE DATE(created_at) = %s
    """
    async with conn.cursor() as cur:
        await cur.execute(query, (target_date,))
        result = await cur.fetchone()
        return result[0] if result else 0
