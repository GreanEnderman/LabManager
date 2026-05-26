## Why

LabManager already defines the production persistence target, but implementation still needs a formal database schema and migration mechanism before Python services can become the authoritative backend for tasks, approvals, imports, reports, deliveries, settings, and audit history. This change turns the P0-05 persistence model and S1-01 Python runtime foundation into an implementation-ready database contract.

## What Changes

- Add a migration-managed PostgreSQL schema for the formal AI workflow table set.
- Define the migration mechanism, naming rules, execution path, rollback expectations, and verification command for schema changes.
- Model core workflow identity, lifecycle, relationship, query, and audit fields as typed columns rather than snapshot-only or metadata-only data.
- Preserve snapshot persistence only as transitional compatibility behavior while formal tables become the production target.
- Add schema-level support for task, approval, import, report, delivery, configuration, and audit workflows.

## Capabilities

### New Capabilities

- `database-schema-migration-mechanism`: Covers migration-managed PostgreSQL schema creation, schema verification, rollback expectations, and formal table definitions for Python production persistence.

### Modified Capabilities

- `formal-persistence-model-governance`: Clarifies that the formal persistence model must be materialized through versioned database migrations before implementation can treat it as production-ready.
- `python-runtime-foundation`: Clarifies that the Python backend foundation must expose database migration and schema verification entry points alongside its PostgreSQL connector boundary.

## Impact

- Affects Python backend database infrastructure, migration scripts, environment configuration, and readiness checks.
- Affects repository contracts for AI tasks, task actions, approvals, reports, import jobs, report deliveries, system settings, and audit activity.
- Affects migration-era documentation that distinguishes formal relational truth from snapshot compatibility storage.
- Does not add new business workflows beyond the formal persistence and migration mechanism required to support already planned AI workflow capabilities.
