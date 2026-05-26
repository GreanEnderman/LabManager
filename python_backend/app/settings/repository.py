"""Settings repository for database operations."""

from typing import Optional
from psycopg import AsyncConnection


async def get_settings(
    conn: AsyncConnection,
    setting_key: str = "default",
) -> Optional[dict]:
    """Load settings from database.

    Args:
        conn: Database connection
        setting_key: Settings key (default: "default")

    Returns:
        Settings dict with thresholds, approval_strategy, sla, or None if not found
    """
    sql = """
        SELECT
            thresholds, approval_strategy, sla, smtp, updated_at, updated_by
        FROM system_settings
        WHERE setting_key = %s
        ORDER BY updated_at DESC
        LIMIT 1
    """

    async with conn.cursor() as cur:
        await cur.execute(sql, (setting_key,))
        row = await cur.fetchone()

        if not row:
            return None

        return {
            "thresholds": row[0] or {},
            "approvalStrategy": row[1] or {},
            "sla": row[2] or {},
            "emailDelivery": row[3] or {},
            "updatedAt": row[4].isoformat() if row[4] else None,
            "updatedBy": row[5],
        }


async def upsert_settings(
    conn: AsyncConnection,
    setting_key: str,
    thresholds: dict,
    approval_strategy: dict,
    sla: dict,
    smtp: dict,
    updated_by: str,
) -> None:
    """Insert or update settings in database.

    Args:
        conn: Database connection
        setting_key: Settings key
        thresholds: Thresholds configuration
        approval_strategy: Approval strategy configuration
        sla: SLA configuration
        updated_by: User ID who updated the settings
    """
    sql = """
        INSERT INTO system_settings (
            setting_key, thresholds, approval_strategy, sla, smtp, updated_by, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, NOW()
        )
        ON CONFLICT (setting_key)
        DO UPDATE SET
            thresholds = EXCLUDED.thresholds,
            approval_strategy = EXCLUDED.approval_strategy,
            sla = EXCLUDED.sla,
            smtp = EXCLUDED.smtp,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW(),
            version = system_settings.version + 1
    """

    async with conn.cursor() as cur:
        await cur.execute(
            sql,
            (setting_key, thresholds, approval_strategy, sla, smtp, updated_by),
        )


async def list_settings_history(
    conn: AsyncConnection,
    setting_key: str = "default",
    limit: int = 10,
) -> list[dict]:
    """List settings history for audit trail.

    Args:
        conn: Database connection
        setting_key: Settings key
        limit: Maximum number of history entries to return

    Returns:
        List of settings history entries
    """
    sql = """
        SELECT
            id, setting_key, thresholds, approval_strategy, sla, smtp,
            version, updated_by, updated_at
        FROM system_settings
        WHERE setting_key = %s
        ORDER BY updated_at DESC
        LIMIT %s
    """

    async with conn.cursor() as cur:
        await cur.execute(sql, (setting_key, limit))
        rows = await cur.fetchall()

        return [
            {
                "id": row[0],
                "settingKey": row[1],
                "thresholds": row[2] or {},
                "approvalStrategy": row[3] or {},
                "sla": row[4] or {},
                "emailDelivery": _redact_email_delivery(row[5] or {}),
                "version": row[6],
                "updatedBy": row[7],
                "updatedAt": row[8].isoformat() if row[8] else None,
            }
            for row in rows
        ]


def _redact_email_delivery(email_delivery: dict) -> dict:
    redacted = dict(email_delivery)
    password = redacted.pop("smtpPassword", None)
    redacted["passwordConfigured"] = bool(password or redacted.get("passwordConfigured"))
    return redacted
