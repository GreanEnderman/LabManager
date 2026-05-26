## Context

LabManager is moving from a TypeScript prototype and snapshot persistence toward a Python production backend with PostgreSQL as the authoritative store. P0-05 already freezes the formal table set and states that snapshot storage is transitional, while S1-01 establishes the Python runtime and PostgreSQL connector boundary. S1-03 must bridge those two pieces by adding a versioned schema and migration mechanism that implementation can execute and verify.

The schema must support the AI workflow backbone: tasks, task actions, approvals, reports, import jobs, report deliveries, system settings, and audit evidence. It must also preserve migration safety because TypeScript prototype paths may still exist during dual-stack migration.

## Goals / Non-Goals

**Goals:**

- Provide a migration-managed PostgreSQL schema for the formal AI workflow tables.
- Establish a repeatable migration command path for local development, CI, and future deployment.
- Define foreign keys, indexes, audit timestamps, lifecycle timestamps, and bounded `metadata` JSONB usage.
- Add verification that proves the schema exists and matches the formal table contract.
- Keep snapshot persistence explicitly non-authoritative once formal relational tables are available.

**Non-Goals:**

- Implement full task, approval, import, report, delivery, or settings business services.
- Migrate production data from snapshot storage into formal tables in this change.
- Replace all TypeScript prototype repositories in one step.
- Add a new database technology or ORM unless the existing Python foundation already chooses one.

## Decisions

1. Use PostgreSQL migrations as the source of truth for schema shape.

   The formal model must be executable and reviewable, not only described in TypeScript domain metadata or documentation. A versioned migration directory gives the team a stable contract for schema review, CI verification, and future production rollout.

   Rejected alternative: keep schema only in domain-model declarations. That preserves documentation value but does not create an operational database contract.

2. Define one initial migration for the full formal table set.

   The initial S1-03 migration should create `ai_tasks`, `ai_task_actions`, `approvals`, `ai_reports`, `import_jobs`, `report_deliveries`, and `system_settings` together because these tables form one workflow persistence baseline. Later migrations can evolve individual tables after the baseline is established.

   Rejected alternative: create one migration per table. That adds sequencing overhead without improving the first production baseline.

3. Keep core workflow truth in typed columns and reserve `metadata` for bounded extension context.

   Status, source identity, actor identity, due dates, approval links, delivery state, settings keys, lifecycle timestamps, and query fields must be columns so repositories and dashboards can filter and join reliably. `metadata` remains useful for optional contextual payloads that are not authoritative lifecycle state.

   Rejected alternative: store most workflow details in JSONB for faster scaffolding. That repeats the snapshot-store problem and weakens auditability.

4. Include schema verification as part of the migration mechanism.

   A dedicated verification path should assert required tables, columns, foreign keys, and key indexes. This gives implementation and CI a small, repeatable proof before business repositories depend on the schema.

   Rejected alternative: rely only on application startup failures. Startup failures can prove something is wrong, but they do not give targeted evidence that the formal persistence contract is complete.

5. Treat rollback as migration-level rollback only until data migration is designed.

   The initial schema can be rolled back by dropping newly created formal tables in reverse dependency order when no authoritative production data has been cut over. Once production data migration begins, destructive rollback must be replaced by forward repair migrations and explicit data recovery procedures.

## Risks / Trade-offs

- [Risk] Schema differs from shared DTO semantics during migration -> Mitigation: derive table fields from existing shared contracts and formal persistence governance, and add verification for required fields and relationships.
- [Risk] Snapshot and formal tables diverge during dual-stack operation -> Mitigation: document snapshot storage as compatibility-only and avoid making new authoritative behavior depend on snapshots.
- [Risk] Over-modeling blocks early implementation -> Mitigation: create the minimum formal table set with typed lifecycle/query fields plus bounded metadata, then evolve with later migrations.
- [Risk] Rollback assumptions become unsafe after production data cutover -> Mitigation: state that destructive down migrations are only safe before formal tables become authoritative for migrated production data.

## Migration Plan

1. Add migration infrastructure under the Python backend boundary, including migration configuration, migration directory, and documented commands.
2. Add the initial schema migration for the formal AI workflow table set.
3. Add schema verification that can run after migrations in local development and CI.
4. Wire readiness or diagnostics to report whether the database connector is configured and migration verification can be run.
5. Keep snapshot persistence available only for compatibility and rollback support until repository cutover work replaces prototype storage.
6. Roll back pre-cutover by reverting the migration in reverse dependency order; after cutover, prefer forward repair migrations and documented recovery steps.

## Open Questions

- Which migration runner will be used if the Python foundation has not already selected one during implementation?
- Will the initial migration include seed data for `system_settings`, or will default settings be inserted by a later configuration service task?
- Should audit activity use only `ai_task_actions` for this phase, or should a separate general-purpose audit table be introduced by a later change?
