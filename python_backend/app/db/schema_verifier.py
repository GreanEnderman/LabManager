from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

import psycopg


REQUIRED_TABLES = {
    "ai_tasks": {
        "id",
        "event_id",
        "task_type",
        "title",
        "summary",
        "recommendation",
        "status",
        "priority",
        "risk_level",
        "source_type",
        "source_id",
        "source_name",
        "assignee_id",
        "assignee_name",
        "assignee_role",
        "requires_approval",
        "due_at",
        "created_at",
        "updated_at",
        "closed_at",
        "metadata",
    },
    "ai_task_actions": {
        "id",
        "task_id",
        "approval_id",
        "action_type",
        "from_status",
        "to_status",
        "actor",
        "reason_codes",
        "detail",
        "tool_name",
        "snapshot",
        "created_at",
    },
    "approvals": {
        "id",
        "task_id",
        "title",
        "reason",
        "status",
        "risk_level",
        "requested_by",
        "reviewer_id",
        "reviewer_name",
        "comment",
        "created_at",
        "updated_at",
        "decided_at",
        "metadata",
    },
    "ai_reports": {"id", "report_type", "title", "summary", "highlights", "created_at", "metadata"},
    "import_jobs": {
        "id",
        "entity_type",
        "source",
        "file_name",
        "status",
        "total_count",
        "success_count",
        "failure_count",
        "imported_by",
        "created_at",
        "completed_at",
        "imported_record_ids",
        "rule_inspection_triggered",
        "generated_event_count",
        "errors",
        "metadata",
    },
    "report_deliveries": {
        "id",
        "report_id",
        "report_title",
        "report_type",
        "recipient_name",
        "recipient_email",
        "channel",
        "status",
        "error_message",
        "triggered_by",
        "trigger_mode",
        "sent_at",
        "created_at",
        "metadata",
    },
    "system_settings": {
        "id",
        "scope_type",
        "scope_id",
        "setting_key",
        "thresholds",
        "approval_strategy",
        "sla",
        "smtp",
        "version",
        "updated_by",
        "created_at",
        "updated_at",
        "metadata",
    },
    "app_users": {
        "id",
        "username",
        "display_name",
        "role",
        "password_hash",
        "is_active",
        "created_at",
        "updated_at",
        "metadata",
    },
}

REQUIRED_FOREIGN_KEYS = {
    "fk_ai_task_actions_task_id",
    "fk_ai_task_actions_approval_id",
    "fk_approvals_task_id",
    "fk_report_deliveries_report_id",
}

REQUIRED_INDEXES = {
    "idx_ai_tasks_status_priority_risk_due_at",
    "idx_ai_tasks_source_type_source_id",
    "idx_ai_task_actions_task_id_created_at",
    "idx_approvals_status_risk_created_at",
    "idx_ai_reports_type_created_at",
    "idx_import_jobs_status_created_at",
    "idx_report_deliveries_report_id_status_sent_at",
    "ux_system_settings_setting_key",
    "idx_app_users_role_active",
}


@dataclass(frozen=True)
class SchemaVerificationResult:
    ok: bool
    missing_tables: list[str]
    missing_columns: dict[str, list[str]]
    missing_foreign_keys: list[str]
    missing_indexes: list[str]

    @property
    def errors(self) -> list[str]:
        messages: list[str] = []
        messages.extend(f"missing table: {table}" for table in self.missing_tables)
        for table, columns in self.missing_columns.items():
            messages.append(f"missing columns on {table}: {', '.join(columns)}")
        messages.extend(f"missing foreign key: {name}" for name in self.missing_foreign_keys)
        messages.extend(f"missing index: {name}" for name in self.missing_indexes)
        return messages


def verify_schema(connection_factory: Callable[[], psycopg.Connection]) -> SchemaVerificationResult:
    with connection_factory() as connection:
        existing_tables = _fetch_table_names(connection)
        missing_tables = sorted(set(REQUIRED_TABLES) - existing_tables)
        missing_columns = _find_missing_columns(connection, existing_tables)
        existing_foreign_keys = _fetch_constraint_names(connection)
        existing_indexes = _fetch_index_names(connection)

    missing_foreign_keys = sorted(REQUIRED_FOREIGN_KEYS - existing_foreign_keys)
    missing_indexes = sorted(REQUIRED_INDEXES - existing_indexes)
    ok = not missing_tables and not missing_columns and not missing_foreign_keys and not missing_indexes
    return SchemaVerificationResult(
        ok=ok,
        missing_tables=missing_tables,
        missing_columns=missing_columns,
        missing_foreign_keys=missing_foreign_keys,
        missing_indexes=missing_indexes,
    )


def _fetch_table_names(connection: psycopg.Connection) -> set[str]:
    rows = connection.execute(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE';
        """
    ).fetchall()
    return {row[0] for row in rows}


def _find_missing_columns(connection: psycopg.Connection, existing_tables: set[str]) -> dict[str, list[str]]:
    missing_columns: dict[str, list[str]] = {}
    for table, required_columns in REQUIRED_TABLES.items():
        if table not in existing_tables:
            continue
        rows = connection.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s;
            """,
            (table,),
        ).fetchall()
        existing_columns = {row[0] for row in rows}
        missing = sorted(required_columns - existing_columns)
        if missing:
            missing_columns[table] = missing
    return missing_columns


def _fetch_constraint_names(connection: psycopg.Connection) -> set[str]:
    rows = connection.execute(
        """
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND constraint_type = 'FOREIGN KEY';
        """
    ).fetchall()
    return {row[0] for row in rows}


def _fetch_index_names(connection: psycopg.Connection) -> set[str]:
    rows = connection.execute(
        """
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public';
        """
    ).fetchall()
    return {row[0] for row in rows}
