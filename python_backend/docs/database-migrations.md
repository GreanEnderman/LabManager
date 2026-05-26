# Database Migrations

S1-03 establishes the Python backend migration boundary for the formal AI workflow schema.

## Commands

All commands use `LABMANAGER_PY_DATABASE_URL`.

```bash
cd python_backend
python -m app.db.manage apply
python -m app.db.manage status
python -m app.db.manage verify
```

Installed environments can also use:

```bash
labmanager-db apply
labmanager-db status
labmanager-db verify
```

## Formal Table Set

The initial migration creates:

- `ai_tasks`
- `ai_task_actions`
- `approvals`
- `ai_reports`
- `import_jobs`
- `report_deliveries`
- `system_settings`

Core workflow identity, lifecycle, relationship, query, and audit fields are typed relational columns. `metadata` JSONB fields are reserved for bounded extension context and must not become the only home of authoritative workflow truth.

## Verification

`python -m app.db.manage verify` checks:

- Required formal tables
- Required columns
- Core foreign keys
- Operational indexes

Readiness diagnostics can include the same schema verification when `LABMANAGER_PY_SCHEMA_CHECK_ON_READINESS=true`. Keep that flag disabled in lightweight local development when PostgreSQL is not running.

## Rollback Boundary

Before formal tables contain authoritative migrated production data, `python -m app.db.manage rollback` may roll back the latest migration and the initial schema may drop formal workflow tables in reverse dependency order.

After production cutover, do not drop authoritative workflow tables as a rollback mechanism. Use forward repair migrations or an explicit data recovery procedure.

## Current Verification Gap

In environments without a configured `LABMANAGER_PY_DATABASE_URL` and reachable PostgreSQL service, implementation can verify migration discovery, CLI wiring, schema verifier behavior, and health diagnostics with unit tests, but cannot prove that the initial migration creates tables on a real database.

Current local verification evidence:

- Docker CLI is installed, but the Docker daemon is not running.
- A local PostgreSQL 18 service is listening on `127.0.0.1:5432`.
- The available session does not have valid PostgreSQL credentials; `postgres/postgres`, `postgres` without password, and the current Windows username without password all fail authentication.

Run `apply` and `verify` against an isolated PostgreSQL database with valid credentials before production cutover.
