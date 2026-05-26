from dataclasses import dataclass
from datetime import date, timedelta

from psycopg import AsyncConnection


@dataclass(frozen=True)
class ReportRiskThresholds:
    near_low_stock_ratio: float = 0.25
    near_maintenance_days: int = 7
    fault_frequency_window_days: int = 30
    high_fault_count: int = 2

    @property
    def low_stock_multiplier(self) -> float:
        return 1 + max(self.near_low_stock_ratio, 0)


async def get_task_status_distribution(conn: AsyncConnection, start_date: date, end_date: date) -> dict[str, int]:
    query = """
        SELECT status, COUNT(*)
        FROM ai_tasks
        WHERE created_at < %s AND (closed_at IS NULL OR closed_at >= %s)
        GROUP BY status
    """
    async with conn.cursor() as cur:
        await cur.execute(query, (end_date, start_date))
        rows = await cur.fetchall()
        return {str(row[0]): int(row[1]) for row in rows}


async def get_inventory_changes(conn: AsyncConnection, start_date: date, end_date: date) -> dict:
    query = """
        SELECT movement_type, COUNT(*), COALESCE(SUM(quantity), 0)
        FROM inventory_movements
        WHERE movement_date >= %s AND movement_date < %s
        GROUP BY movement_type
    """
    async with conn.cursor() as cur:
        await cur.execute(query, (start_date, end_date))
        rows = await cur.fetchall()

    changes = {
        "inbound": {"count": 0, "quantity": 0},
        "outbound": {"count": 0, "quantity": 0},
    }
    for movement_type, count, quantity in rows:
        key = str(movement_type)
        changes[key] = {"count": int(count), "quantity": int(quantity)}
    return changes


async def get_potential_risks(
    conn: AsyncConnection,
    start_date: date,
    end_date: date,
    thresholds: ReportRiskThresholds | None = None,
) -> dict:
    thresholds = thresholds or ReportRiskThresholds()
    maintenance_end_date = start_date + timedelta(days=max(thresholds.near_maintenance_days, 0))
    fault_window_start = end_date - timedelta(days=max(thresholds.fault_frequency_window_days, 0))
    near_low_stock_query = """
        SELECT id, name, current_quantity, threshold, unit
        FROM chemicals
        WHERE status != 'deleted'
          AND current_quantity > threshold
          AND current_quantity <= CEIL(threshold * %s)
        ORDER BY current_quantity ASC
        LIMIT 20
    """
    near_maintenance_query = """
        SELECT id, name, next_maintenance_at
        FROM equipment
        WHERE status != 'deleted'
          AND next_maintenance_at IS NOT NULL
          AND next_maintenance_at >= %s
          AND next_maintenance_at < %s
        ORDER BY next_maintenance_at ASC
        LIMIT 20
    """
    frequent_fault_query = """
        SELECT source_id, source_name, COUNT(*)
        FROM ai_tasks
        WHERE task_type = 'equipment_repair'
          AND created_at >= %s
          AND created_at < %s
        GROUP BY source_id, source_name
        HAVING COUNT(*) >= %s
        ORDER BY COUNT(*) DESC
        LIMIT 20
    """
    async with conn.cursor() as cur:
        await cur.execute(near_low_stock_query, (thresholds.low_stock_multiplier,))
        near_low_stock = await cur.fetchall()
        await cur.execute(near_maintenance_query, (start_date, maintenance_end_date))
        near_maintenance = await cur.fetchall()
        await cur.execute(frequent_fault_query, (fault_window_start, end_date, thresholds.high_fault_count))
        frequent_faults = await cur.fetchall()

    return {
        "near_low_stock": [
            {
                "id": row[0],
                "name": row[1],
                "current_quantity": row[2],
                "threshold": row[3],
                "unit": row[4],
            }
            for row in near_low_stock
        ],
        "near_maintenance_due": [
            {"id": row[0], "name": row[1], "next_maintenance_at": row[2]}
            for row in near_maintenance
        ],
        "high_fault_frequency": [
            {"equipment_id": row[0], "equipment_name": row[1], "fault_count": int(row[2])}
            for row in frequent_faults
        ],
        "thresholds": {
            "near_low_stock_ratio": thresholds.near_low_stock_ratio,
            "near_maintenance_days": thresholds.near_maintenance_days,
            "fault_frequency_window_days": thresholds.fault_frequency_window_days,
            "high_fault_count": thresholds.high_fault_count,
        },
    }
