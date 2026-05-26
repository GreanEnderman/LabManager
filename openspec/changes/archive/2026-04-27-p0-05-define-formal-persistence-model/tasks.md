## 1. Freeze Formal Persistence Contract

- [x] 1.1 Audit current TS domain records, snapshot payloads, and architecture docs against the `P0-05` target table set.
- [x] 1.2 Extend persistence-facing model definitions to cover `ai_reports`, `import_jobs`, `report_deliveries`, and `system_settings` alongside the existing core tables.
- [x] 1.3 Document field-by-field ownership for primary keys, foreign keys, audit timestamps, and `metadata` usage on each formal table.

## 2. Design Relational Schema And Migration Boundary

- [x] 2.1 Define relational schema artifacts or migration scaffolds for `ai_tasks`, `ai_task_actions`, `approvals`, `ai_reports`, `import_jobs`, `report_deliveries`, and `system_settings`.
- [x] 2.2 Add explicit index and foreign-key definitions that support task lists, approval queues, report history, import history, delivery tracking, and settings lookup.
- [x] 2.3 Mark `ai_state_snapshots` and `PostgresSnapshotStore` as transition-only compatibility storage in code and supporting documentation.

## 3. Align Repository And Runtime Persistence

- [x] 3.1 Refactor repository interfaces and persistence services so formal relational tables become the source-of-truth target for new implementation work.
- [x] 3.2 Preserve snapshot hydrate/export behavior only as a fallback path that does not own workflow truth.
- [x] 3.3 Cross-check persistence field names against shared DTO governance and existing domain state machines so contract and storage semantics stay aligned.

## 4. Verify Migration Readiness

- [x] 4.1 Add targeted tests or schema checks covering relational constraints, audit-field presence, and snapshot transition boundaries.
- [x] 4.2 Run relevant lint, typecheck, and verification commands for persistence-layer changes.
- [x] 4.3 Update implementation-facing docs with the final production persistence boundary and known follow-up questions for Python migration.
