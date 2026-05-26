from __future__ import annotations

import argparse
import json
import sys

import psycopg

from app.core.config import get_settings
from app.db.migration_runner import (
    apply_migrations,
    connection_factory_from_settings,
    get_migration_status,
    rollback_last_migration,
)
from app.db.schema_verifier import verify_schema


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="LabManager database migration commands.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("apply", help="Apply pending database migrations.")
    subparsers.add_parser("status", help="Show migration status as JSON.")
    subparsers.add_parser("rollback", help="Rollback the latest applied migration.")
    subparsers.add_parser("verify", help="Verify the formal AI workflow schema.")

    args = parser.parse_args(argv)
    settings = get_settings()

    try:
        connection_factory = connection_factory_from_settings(settings)

        if args.command == "apply":
            applied = apply_migrations(connection_factory)
            print(json.dumps({"applied": [migration.version for migration in applied]}, indent=2))
            return 0

        if args.command == "status":
            print(json.dumps({"migrations": get_migration_status(connection_factory)}, indent=2))
            return 0

        if args.command == "rollback":
            migration = rollback_last_migration(connection_factory)
            print(json.dumps({"rolledBack": migration.version if migration else None}, indent=2))
            return 0

        if args.command == "verify":
            result = verify_schema(connection_factory)
            print(
                json.dumps(
                    {
                        "ok": result.ok,
                        "errors": result.errors,
                        "missingTables": result.missing_tables,
                        "missingColumns": result.missing_columns,
                        "missingForeignKeys": result.missing_foreign_keys,
                        "missingIndexes": result.missing_indexes,
                    },
                    indent=2,
                )
            )
            return 0 if result.ok else 1
    except (ValueError, psycopg.OperationalError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2))
        return 1

    return 2


if __name__ == "__main__":
    sys.exit(main())
