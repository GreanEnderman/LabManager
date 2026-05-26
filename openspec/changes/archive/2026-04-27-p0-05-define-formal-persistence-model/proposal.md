## Why

The current PostgreSQL persistence path stores the AI runtime as a single snapshot blob, which is useful for prototype hydration but does not define the production source of truth for tasks, approvals, reports, imports, deliveries, and runtime settings. This change is needed now to formalize the relational persistence target before migration work continues on Python, schema design, and repository replacement.

## What Changes

- Define the formal relational persistence model for `ai_tasks`, `ai_task_actions`, `approvals`, `ai_reports`, `import_jobs`, `report_deliveries`, and `system_settings`.
- Specify required primary keys, foreign keys, indexes, audit columns, and `metadata` JSONB usage rules for those tables.
- Establish the boundary between structured columns and extension metadata so future implementations do not collapse business truth back into generic snapshots.
- Document that `PostgresSnapshotStore` and `ai_state_snapshots` remain transition-only infrastructure for prototype hydration and rollback, not the production persistence target.

## Capabilities

### New Capabilities
- `formal-persistence-model-governance`: Defines the production relational schema contract, audit expectations, metadata rules, and transition boundary away from snapshot-only persistence.

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->

## Impact

- Affected code: `backend/src/domain/models.ts`, `backend/src/services/postgres-snapshot-store.ts`, repository and persistence abstractions, future migration scripts, and target-stack schema work.
- Affected systems: TypeScript prototype persistence, Python target-stack schema planning, audit/logging continuity, and production remediation backlog execution.
- Dependencies: builds on `P0-02` shared DTO governance so persisted fields can align to a single contract truth while remaining distinct from transport-only concerns.
