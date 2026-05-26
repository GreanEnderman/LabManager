## Context

The current repository already defines in-memory records for tasks, task actions, approvals, reports, deliveries, imports, and settings, but the only PostgreSQL persistence implementation is `backend/src/services/postgres-snapshot-store.ts`, which serializes the entire runtime state into `ai_state_snapshots.payload`. That snapshot approach is acceptable as a prototype safety net, but it prevents the project from establishing row-level integrity, indexed queries, audit preservation, and migration-ready repository contracts.

This change sits between two architectural facts:

- `P0-02` already established a single DTO truth for transport contracts.
- The target production architecture in `docs/final-production-architecture.md` expects PostgreSQL to store formal business tables for tasks, approvals, imports, reports, deliveries, and settings.

The design therefore needs to define the production persistence truth without over-coupling it to the current TypeScript prototype runtime or prematurely implementing the full Python stack.

## Goals / Non-Goals

**Goals:**
- Define the formal production table set for the AI workflow persistence layer.
- Make primary keys, foreign keys, indexes, audit fields, and `metadata` conventions explicit enough to drive migrations and repository work.
- Separate “strong business truth” columns from “extension / compatibility” JSONB payloads.
- Preserve a narrow transition role for snapshot storage without allowing it to remain the long-term persistence model.

**Non-Goals:**
- Implementing the full relational repository layer in this artifact set.
- Designing every secondary business table outside the scope called out by `P0-05`.
- Freezing Python ORM details, migration tooling layout, or final repository method signatures.
- Treating transport DTOs as identical to database schemas field-for-field.

## Decisions

### 1. The formal production schema centers on seven named business tables

The production persistence target for this change is the following table set:

- `ai_tasks`
- `ai_task_actions`
- `approvals`
- `ai_reports`
- `import_jobs`
- `report_deliveries`
- `system_settings`

Each table represents durable business truth, not a cache projection. The existing `ai_memories` table definition may remain in backlog scope, but it is not required to satisfy this remediation target.

Rationale:
- These are the tables explicitly required by the backlog item and final architecture guidance.
- They cover the main operational loop: task execution, approval gating, reporting, import traceability, delivery traceability, and runtime policy configuration.
- Freezing this set now gives both TS remediation and Python migration work a shared persistence target.

Alternatives considered:
- Keep persistence scoped to `ai_tasks`, `ai_task_actions`, and `approvals` only. Rejected because it leaves reports, imports, deliveries, and settings in prototype limbo.
- Include every possible auxiliary table now. Rejected because it would over-specify beyond the stated P0 goal.

### 2. Strongly queried business facts SHALL live in typed columns; `metadata` is extension-only JSONB

For each formal table, fields used for identity, joins, status transitions, SLA logic, filtering, sorting, audit, and UI/API list views must be first-class columns. `metadata` remains available as JSONB for non-relational extensions, compatibility shims, and infrequently queried context, but it must not become the primary home for core lifecycle truth.

Baseline rules:

- `metadata` defaults to `{}` and is always present on extensible business tables.
- Values needed for workflow decisions, approvals, reporting eligibility, delivery retries, or settings enforcement must not live only inside `metadata`.
- Snapshot payloads and actor snapshots remain allowed in dedicated audit-oriented JSONB columns where point-in-time capture matters.

Rationale:
- This keeps the production model queryable and indexable.
- It preserves flexibility without repeating the prototype anti-pattern of hiding all semantics in one blob.
- It aligns with the project rule that actions must be auditable and reviewable.

Alternatives considered:
- Put all optional fields into JSONB for speed of implementation. Rejected because it recreates weak schema truth.
- Eliminate JSONB entirely. Rejected because transition and extensibility needs are real.

### 3. Audit continuity is a first-class schema concern

Every formal table in scope must carry explicit audit timestamps, and tables representing actor-driven or statusful workflows must also retain actor and causality fields. The minimum audit posture is:

- `created_at` and `updated_at` on mutable business rows
- `closed_at`, `decided_at`, `sent_at`, or `completed_at` where lifecycle semantics require terminal timestamps
- actor / requester / trigger fields as structured columns or bounded JSONB, depending on whether the actor participates in joins
- a stable `metadata` object for trace extensions

`ai_task_actions` remains the canonical append-only audit trail for task and approval lifecycle transitions, with `snapshot` kept as a point-in-time JSONB evidence field rather than a substitute for relational storage.

Rationale:
- The product definition requires every important action to be traceable and reviewable.
- Audit continuity must survive dual-stack migration and cannot depend on reconstructing history from the latest snapshot blob.

Alternatives considered:
- Rely on application logs instead of relational audit fields. Rejected because logs are insufficient for business-state reconstruction and operator review.

### 4. Foreign-key and index design follows the operational loop

The formal schema should enforce the following baseline relationships and access paths:

- `ai_task_actions.task_id -> ai_tasks.id`
- `ai_task_actions.approval_id -> approvals.id` when an action is tied to an approval transition
- `approvals.task_id -> ai_tasks.id`
- `report_deliveries.report_id -> ai_reports.id`

Baseline indexes should support the main read paths:

- `ai_tasks(status, priority, risk_level, due_at)`
- `ai_tasks(source_type, source_id)`
- `ai_task_actions(task_id, created_at desc)`
- `approvals(status, risk_level, created_at desc)`
- `ai_reports(type, created_at desc)`
- `import_jobs(status, created_at desc)`
- `report_deliveries(report_id, status, sent_at desc)`
- `system_settings(setting_key)` or another unique scope key depending on final row shape

Rationale:
- These paths match dashboard, task center, approvals, reports, import history, and delivery follow-up use cases.
- They also support transition to Python repositories without guessing query surfaces later.

Alternatives considered:
- Leave indexes unspecified until implementation. Rejected because the backlog explicitly requires formal indexing expectations.

### 5. `system_settings` is modeled as versioned scoped configuration, not a singleton blob

Although the current runtime treats settings as a single DTO-shaped object, the formal persistence model should treat `system_settings` as structured scoped configuration with a unique scope key, typed policy columns where stable, `metadata` for overflow, and audit/version fields for change tracking. This may still be implemented as one default row in V1, but the schema must not assume global-singleton forever.

Rationale:
- The platform already expects threshold, approval strategy, and SLA policy configuration to evolve by environment or scope.
- A scoped design supports future expansion without needing a destructive schema rewrite.

Alternatives considered:
- Persist one JSON blob row only. Rejected because it repeats the snapshot problem at a smaller scale.

### 6. Snapshot persistence remains a transition aid only

`PostgresSnapshotStore` and `ai_state_snapshots` may remain temporarily for prototype hydration, fallback export/import, or migration verification, but they are explicitly non-authoritative once formal relational tables exist. New production features, repositories, and migration plans must target the relational schema first, and any snapshot write path must be documented as compatibility or rollback support only.

Rationale:
- The prototype already depends on snapshots for bootstrapping.
- Removing it immediately is unnecessary, but allowing it to stay authoritative would block the remediation objective.

Alternatives considered:
- Delete snapshot persistence from the plan immediately. Rejected because a transitional fallback is useful during migration.
- Continue using snapshot persistence as the source of truth and derive tables later. Rejected because it delays the necessary truth boundary again.

## Risks / Trade-offs

- [The existing TS records and future Python ORM models may diverge on naming or nullability] -> Mitigation: treat this change as the normalization contract both implementations must map to.
- [Freezing table expectations before repository implementation may expose later gaps] -> Mitigation: keep open questions explicit and require follow-up deltas instead of silent drift.
- [Some actor fields are currently embedded objects, which can tempt overuse of JSONB] -> Mitigation: document where bounded JSONB is acceptable and where relational columns are mandatory.
- [Keeping snapshot persistence alive in transition can confuse implementers] -> Mitigation: mark it as compatibility-only in specs, tasks, and future code comments.

## Migration Plan

1. Introduce migration-facing schema definitions for the seven formal tables plus transitional notes for `ai_state_snapshots`.
2. Align current TS domain model definitions and repository interfaces to the formal relational field set.
3. Add migration scripts and repository implementations that read/write formal tables first.
4. Keep snapshot hydrate/export support only where needed for prototype continuity or rollback verification.
5. Remove source-of-truth dependencies on `ai_state_snapshots` once relational reads are complete and validated.

Rollback strategy:

- If relational persistence rollout fails, services may temporarily continue hydrating from the snapshot store, but the schema contract remains unchanged.
- Rollback must not redefine snapshot storage as production truth; it is only an operational fallback while fixes are applied.

## Open Questions

- Should `system_settings` normalize approval strategy and SLA policy into child tables immediately, or remain one scoped row with typed columns plus `metadata` in V1?
- Does `import_jobs` need a separate `import_job_errors` table in the first formal migration, or can row-level errors remain nested temporarily while `import_jobs` is formalized?
- Should actor references eventually point at a formal `users` table across all audit-bearing records, or remain denormalized for migration simplicity in V1?
