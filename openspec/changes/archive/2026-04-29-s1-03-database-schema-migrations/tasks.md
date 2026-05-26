## 1. Migration Infrastructure

- [x] 1.1 Inspect the existing Python backend foundation and identify the current PostgreSQL connector, configuration, and command-entry conventions.
- [x] 1.2 Add the migration runner configuration and versioned migration directory under the Python backend boundary.
- [x] 1.3 Document the commands for applying migrations and checking migration status in local development and CI.

## 2. Formal Schema Baseline

- [x] 2.1 Create the initial migration for `ai_tasks`, `ai_task_actions`, `approvals`, `ai_reports`, `import_jobs`, `report_deliveries`, and `system_settings`.
- [x] 2.2 Add typed columns for identity, source linkage, lifecycle status, operational query fields, timestamps, actor context, and bounded `metadata` JSONB extension data.
- [x] 2.3 Add primary keys, foreign keys for task/action/approval/report-delivery relationships, and uniqueness constraints where settings or idempotency require them.
- [x] 2.4 Add operational indexes for task lists, approval queues, import history, report history, delivery tracking, settings lookup, timestamp filtering, and relationship joins.
- [x] 2.5 Add a safe pre-cutover rollback path for the initial schema in reverse dependency order.

## 3. Schema Verification

- [x] 3.1 Implement a schema verification command or script that checks required formal tables, required columns, core foreign keys, and key indexes.
- [x] 3.2 Make schema verification fail with targeted output when a required schema element is missing or invalid.
- [x] 3.3 Add verification coverage that runs migrations against a configured test database or clearly isolated local database target.

## 4. Runtime Integration

- [x] 4.1 Wire Python backend configuration so migration and verification commands use the same explicit environment-driven database settings as the runtime connector.
- [x] 4.2 Update readiness or diagnostics to distinguish database connector reachability from formal schema completeness.
- [x] 4.3 Ensure migration and verification commands can run independently of HTTP request handling and unrelated business workflows.

## 5. Compatibility And Documentation

- [x] 5.1 Document that snapshot persistence remains compatibility-only and is not authoritative once formal tables are available.
- [x] 5.2 Update persistence or migration documentation with the formal table set, rollback boundary, and post-cutover forward-repair rule.
- [x] 5.3 Cross-reference P0-05 and S1-01 assumptions so future repository work targets the migrated formal schema.

## 6. Validation

- [x] 6.1 Run the migration apply path against an empty configured PostgreSQL database and confirm all formal tables are created.
- [x] 6.2 Run schema verification after migration and confirm it passes.
- [x] 6.3 Run the relevant lint, typecheck, and test commands for the changed Python/backend files.
- [x] 6.4 Record any verification gaps, especially if a real PostgreSQL service is unavailable in the local environment.
