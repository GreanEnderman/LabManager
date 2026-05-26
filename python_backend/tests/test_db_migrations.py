from __future__ import annotations

from pathlib import Path
from typing import Any

import psycopg

from app.db.manage import main
from app.db.migration_runner import apply_migrations, execute_sql_script, list_migrations
from app.db.schema_verifier import REQUIRED_TABLES, verify_schema


FIXTURE_MIGRATIONS_DIR = Path(__file__).parent / "fixtures" / "migrations"


class FakeCursor:
    def __init__(self, rows: list[tuple[Any, ...]]) -> None:
        self._rows = rows

    def fetchall(self) -> list[tuple[Any, ...]]:
        return self._rows

    def fetchone(self) -> tuple[Any, ...] | None:
        return self._rows[0] if self._rows else None


class FakeTransaction:
    def __enter__(self) -> None:
        return None

    def __exit__(self, *args: object) -> None:
        return None


class FakeConnection:
    def __init__(
        self,
        *,
        tables: set[str] | None = None,
        columns: dict[str, set[str]] | None = None,
        foreign_keys: set[str] | None = None,
        indexes: set[str] | None = None,
        applied_versions: set[str] | None = None,
    ) -> None:
        self.tables = tables or set()
        self.columns = columns or {}
        self.foreign_keys = foreign_keys or set()
        self.indexes = indexes or set()
        self.applied_versions = applied_versions or set()
        self.executed: list[str] = []

    def __enter__(self) -> "FakeConnection":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def transaction(self) -> FakeTransaction:
        return FakeTransaction()

    def execute(self, sql: str, params: object | None = None) -> FakeCursor:
        self.executed.append(sql)
        normalized = " ".join(sql.split()).lower()

        if "select version from schema_migrations" in normalized:
            return FakeCursor([(version,) for version in sorted(self.applied_versions)])
        if "insert into schema_migrations" in normalized and isinstance(params, tuple):
            self.applied_versions.add(params[0])
            return FakeCursor([])
        if "information_schema.tables" in normalized:
            return FakeCursor([(table,) for table in sorted(self.tables)])
        if "information_schema.columns" in normalized and isinstance(params, tuple):
            table = params[0]
            return FakeCursor([(column,) for column in sorted(self.columns.get(table, set()))])
        if "information_schema.table_constraints" in normalized:
            return FakeCursor([(name,) for name in sorted(self.foreign_keys)])
        if "from pg_indexes" in normalized:
            return FakeCursor([(name,) for name in sorted(self.indexes)])
        return FakeCursor([])


def test_list_migrations_discovers_versioned_sql_pairs() -> None:
    migrations = list_migrations(FIXTURE_MIGRATIONS_DIR)

    assert [migration.version for migration in migrations] == ["001"]
    assert migrations[0].name == "example"


def test_apply_migrations_records_only_pending_versions() -> None:
    migrations = list_migrations(FIXTURE_MIGRATIONS_DIR)

    connection = FakeConnection()
    applied = apply_migrations(lambda: connection, migrations)

    assert [migration.version for migration in applied] == ["001"]
    assert "001" in connection.applied_versions


def test_execute_sql_script_runs_statements_individually() -> None:
    connection = FakeConnection()

    execute_sql_script(connection, "SELECT 1;\n\nSELECT 2;")

    assert connection.executed == ["SELECT 1;", "SELECT 2;"]


def test_manage_reports_missing_database_url_without_traceback(capsys) -> None:
    exit_code = main(["status"])
    output = capsys.readouterr().out

    assert exit_code == 1
    assert '"ok": false' in output.lower()
    assert "LABMANAGER_PY_DATABASE_URL is required" in output


def test_verify_schema_reports_missing_schema_elements() -> None:
    connection = FakeConnection(tables={"ai_tasks"}, columns={"ai_tasks": {"id"}})

    result = verify_schema(lambda: connection)

    assert result.ok is False
    assert "approvals" in result.missing_tables
    assert "status" in result.missing_columns["ai_tasks"]
    assert any(error.startswith("missing table: approvals") for error in result.errors)


def test_verify_schema_accepts_complete_formal_baseline() -> None:
    connection = FakeConnection(
        tables=set(REQUIRED_TABLES),
        columns={table: set(columns) for table, columns in REQUIRED_TABLES.items()},
        foreign_keys={
            "fk_ai_task_actions_task_id",
            "fk_ai_task_actions_approval_id",
            "fk_approvals_task_id",
            "fk_report_deliveries_report_id",
        },
        indexes={
            "idx_ai_tasks_status_priority_risk_due_at",
            "idx_ai_tasks_source_type_source_id",
            "idx_ai_task_actions_task_id_created_at",
            "idx_approvals_status_risk_created_at",
            "idx_ai_reports_type_created_at",
            "idx_import_jobs_status_created_at",
            "idx_report_deliveries_report_id_status_sent_at",
            "ux_system_settings_setting_key",
            "idx_app_users_role_active",
        },
    )

    result = verify_schema(lambda: connection)

    assert result.ok is True
    assert result.errors == []
