from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass
from pathlib import Path

import psycopg

from app.core.config import Settings
from app.db.postgres import get_postgres_connection_factory


MIGRATIONS_TABLE = "schema_migrations"
MIGRATIONS_DIR = Path(__file__).parent / "migrations"


@dataclass(frozen=True)
class Migration:
    version: str
    name: str
    path: Path

    @property
    def up_sql(self) -> str:
        return (self.path / "up.sql").read_text(encoding="utf-8")

    @property
    def down_sql(self) -> str:
        return (self.path / "down.sql").read_text(encoding="utf-8")


def list_migrations(migrations_dir: Path = MIGRATIONS_DIR) -> list[Migration]:
    migrations: list[Migration] = []
    for item in migrations_dir.iterdir():
        if not item.is_dir() or "_" not in item.name:
            continue
        version, name = item.name.split("_", 1)
        if (item / "up.sql").is_file() and (item / "down.sql").is_file():
            migrations.append(Migration(version=version, name=name, path=item))
    return sorted(migrations, key=lambda migration: migration.version)


def migrations_table_exists(connection: psycopg.Connection) -> bool:
    row = connection.execute(
        """
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = %s
        );
        """,
        (MIGRATIONS_TABLE,),
    ).fetchone()
    return bool(row and row[0])


def ensure_migrations_table(connection: psycopg.Connection) -> None:
    if migrations_table_exists(connection):
        return
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {MIGRATIONS_TABLE} (
          version TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )


def execute_sql_script(connection: psycopg.Connection, sql: str) -> None:
    for statement in [part.strip() for part in sql.split(";") if part.strip()]:
        connection.execute(f"{statement};")


def get_applied_versions(connection: psycopg.Connection) -> set[str]:
    ensure_migrations_table(connection)
    rows = connection.execute(f"SELECT version FROM {MIGRATIONS_TABLE};").fetchall()
    return {row[0] for row in rows}


def apply_migrations(
    connection_factory: Callable[[], psycopg.Connection],
    migrations: Iterable[Migration] | None = None,
) -> list[Migration]:
    migration_list = list(migrations) if migrations is not None else list_migrations()
    applied: list[Migration] = []

    with connection_factory() as connection:
        ensure_migrations_table(connection)
        applied_versions = get_applied_versions(connection)

        for migration in migration_list:
            if migration.version in applied_versions:
                continue
            with connection.transaction():
                execute_sql_script(connection, migration.up_sql)
                connection.execute(
                    f"INSERT INTO {MIGRATIONS_TABLE} (version, name) VALUES (%s, %s);",
                    (migration.version, migration.name),
                )
            applied.append(migration)

    return applied


def rollback_last_migration(
    connection_factory: Callable[[], psycopg.Connection],
    migrations: Iterable[Migration] | None = None,
) -> Migration | None:
    migration_list = list(migrations) if migrations is not None else list_migrations()
    migrations_by_version = {migration.version: migration for migration in migration_list}

    with connection_factory() as connection:
        ensure_migrations_table(connection)
        row = connection.execute(
            f"SELECT version FROM {MIGRATIONS_TABLE} ORDER BY version DESC LIMIT 1;"
        ).fetchone()
        if row is None:
            return None

        migration = migrations_by_version[row[0]]
        with connection.transaction():
            execute_sql_script(connection, migration.down_sql)
            connection.execute(f"DELETE FROM {MIGRATIONS_TABLE} WHERE version = %s;", (migration.version,))
        return migration


def get_migration_status(
    connection_factory: Callable[[], psycopg.Connection],
    migrations: Iterable[Migration] | None = None,
) -> list[dict[str, object]]:
    migration_list = list(migrations) if migrations is not None else list_migrations()
    with connection_factory() as connection:
        applied_versions = get_applied_versions(connection)

    return [
        {
            "version": migration.version,
            "name": migration.name,
            "applied": migration.version in applied_versions,
        }
        for migration in migration_list
    ]


def connection_factory_from_settings(settings: Settings) -> Callable[[], psycopg.Connection]:
    return get_postgres_connection_factory(settings)
