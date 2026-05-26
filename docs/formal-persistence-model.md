# Formal Persistence Model

> Boundary note: This document defines the production-facing persistence target and migration contract. It does not claim that the full relational target has already replaced the current TypeScript prototype implementation everywhere.

## Purpose

This document defines the production-facing persistence target introduced by `p0-05-define-formal-persistence-model`. It exists to close the gap between the current snapshot-style PostgreSQL prototype and the formal relational model expected by later repository and Python migration work.

## Authoritative Tables

The following tables are the authoritative persistence target for AI workflow data:

- `ai_tasks`
- `ai_task_actions`
- `approvals`
- `ai_reports`
- `import_jobs`
- `report_deliveries`
- `system_settings`

`ai_state_snapshots` remains compatibility-only infrastructure for prototype hydration, fallback export/import, and migration verification.

S1-03 materializes this target through versioned Python backend database migrations under `python_backend/app/db/migrations/`. New production repository work must treat those migrations, not ad hoc startup DDL or snapshot payloads, as the executable schema contract.

## Field Ownership

### `ai_tasks`

- Primary key: `id`
- Workflow truth: `status`, `type`, `priority`, `riskLevel`, `requiresApproval`, `dueAt`
- Relationship fields: `eventId`, `sourceType`, `sourceId`
- Audit fields: `createdAt`, `updatedAt`, `closedAt`
- Metadata rule: `metadata` may hold extra context but must not be the sole home of task lifecycle truth

### `ai_task_actions`

- Primary key: `id`
- Foreign keys: `taskId -> ai_tasks.id`, `approvalId -> approvals.id`
- Audit truth: append-only row with `actionType`, `actor`, `reasonCodes`, `detail`, `createdAt`
- Snapshot rule: `snapshot` is point-in-time evidence only, not authoritative business storage

### `approvals`

- Primary key: `id`
- Foreign key: `taskId -> ai_tasks.id`
- Workflow truth: `status`, `riskLevel`, `requestedBy`, `reviewerId`, `reviewerName`
- Audit fields: `createdAt`, `updatedAt`, `decidedAt`
- Metadata rule: `metadata` may hold supporting approval context only

### `ai_reports`

- Primary key: `id`
- Workflow truth: `type`, `title`, `summary`, `highlights`
- Audit fields: `createdAt`
- Metadata rule: generation context may extend `metadata`, but core report content must remain structured

### `import_jobs`

- Primary key: `id`
- Workflow truth: `entityType`, `source`, `status`, `totalCount`, `successCount`, `failureCount`
- Audit fields: `createdAt`, `completedAt`
- Trace fields: `importedBy`, `importedRecordIds`, `ruleInspectionTriggered`, `generatedEventCount`, `errors`
- Metadata rule: `metadata` may hold batch extras, not the only copy of import statistics

### `report_deliveries`

- Primary key: `id`
- Foreign key: `reportId -> ai_reports.id`
- Workflow truth: `recipientEmail`, `channel`, `status`, `errorMessage`, `triggerMode`
- Audit fields: `createdAt`, `sentAt`
- Metadata rule: transport-provider responses may extend `metadata`, but delivery outcome stays structured

### `system_settings`

- Primary key: `id`
- Unique lookup: `settingKey`
- Scope fields: `scopeType`, `scopeId`
- Workflow truth: `thresholds`, `approvalStrategy`, `sla`, `version`
- Audit fields: `createdAt`, `updatedAt`, `updatedBy`
- Metadata rule: `metadata` supports forward-compatible extension only

## Index And Foreign-Key Baseline

- `ai_tasks(status, priority, riskLevel, dueAt)`
- `ai_tasks(sourceType, sourceId)`
- `ai_task_actions(taskId, createdAt)`
- `approvals(status, riskLevel, createdAt)`
- `ai_reports(type, createdAt)`
- `import_jobs(status, createdAt)`
- `report_deliveries(reportId, status, sentAt)`
- `system_settings(settingKey)` unique

Baseline foreign keys:

- `ai_task_actions.taskId -> ai_tasks.id`
- `ai_task_actions.approvalId -> approvals.id`
- `approvals.taskId -> ai_tasks.id`
- `report_deliveries.reportId -> ai_reports.id`

## Transition Boundary

- New production persistence work must target the formal relational table model first.
- Snapshot persistence must not be used as the source of truth for new behavior.
- Rollback may temporarily rehydrate from `ai_state_snapshots`, but that does not redefine production truth.
- Before production cutover, the initial schema migration can be rolled back by dropping formal workflow tables in reverse dependency order.
- After production cutover, rollback must use forward repair migrations or an explicit data recovery procedure rather than dropping authoritative workflow tables.

## Migration Commands

The Python backend owns the formal migration entry points:

```bash
cd python_backend
python -m app.db.manage apply
python -m app.db.manage status
python -m app.db.manage verify
```

All commands use `LABMANAGER_PY_DATABASE_URL`. Readiness diagnostics can include schema verification when `LABMANAGER_PY_SCHEMA_CHECK_ON_READINESS=true`, but verification remains available as an independent command for local development and CI.

## Follow-up Questions

- Whether `system_settings` should split into child tables in V1 or remain one scoped row with structured JSON payload columns.
- Whether `import_jobs` should gain a separate `import_job_errors` table in the first relational migration.
- Whether audit-bearing actor fields should stay denormalized in V1 or later reference a formal `users` table.
