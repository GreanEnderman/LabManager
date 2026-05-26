# database-schema-migration-mechanism Specification

## Purpose
TBD - created by archiving change s1-03-database-schema-migrations. Update Purpose after archive.
## Requirements
### Requirement: Versioned PostgreSQL Migrations
The system SHALL provide a versioned PostgreSQL migration mechanism for the Python backend database schema.

#### Scenario: Creating the migration baseline
- **WHEN** a developer prepares the S1-03 persistence implementation
- **THEN** the repository MUST contain a versioned migration path that creates the formal AI workflow schema in a deterministic order

#### Scenario: Running migrations in development or CI
- **WHEN** a developer or CI job runs the documented migration command against a configured PostgreSQL database
- **THEN** the migration mechanism MUST apply pending migrations and record which schema revisions have been applied

### Requirement: Formal AI Workflow Schema
The system SHALL create formal PostgreSQL tables for `ai_tasks`, `ai_task_actions`, `approvals`, `ai_reports`, `import_jobs`, `report_deliveries`, and `system_settings`.

#### Scenario: Applying the initial schema migration
- **WHEN** the initial schema migration is applied to an empty configured PostgreSQL database
- **THEN** all formal AI workflow tables MUST exist with primary keys, lifecycle timestamps, status fields, relationship fields, audit fields, and bounded `metadata` JSONB extension fields

#### Scenario: Avoiding snapshot-only schema truth
- **WHEN** a task, approval, import, report, delivery, configuration, or audit workflow field is required for filtering, joining, state transitions, or audit review
- **THEN** that field MUST be represented as a typed relational column rather than existing only inside a snapshot payload or `metadata`

### Requirement: Relational Integrity And Operational Indexes
The system MUST define foreign keys and indexes needed by task, approval, report, import, delivery, settings, and audit workflows.

#### Scenario: Enforcing workflow relationships
- **WHEN** the formal schema is created
- **THEN** the database MUST enforce relationships from task actions to tasks, approvals to tasks, task actions to approvals when present, and report deliveries to reports

#### Scenario: Supporting operational reads
- **WHEN** dashboard, task center, approval queue, import history, report history, delivery tracking, or settings lookup paths query formal persistence
- **THEN** the schema MUST provide indexes for status, relationship, timestamp, and settings-key access patterns required by those reads

### Requirement: Schema Verification
The system SHALL provide a schema verification path that proves the formal persistence baseline exists after migrations run.

#### Scenario: Verifying migrated schema
- **WHEN** schema verification runs against a migrated database
- **THEN** it MUST check the required tables, required columns, core foreign keys, and key indexes for the formal AI workflow schema

#### Scenario: Reporting incomplete schema
- **WHEN** schema verification detects a missing formal table, required column, foreign key, or key index
- **THEN** it MUST fail with output that identifies the missing or invalid schema element

### Requirement: Migration Rollback Boundary
The system MUST document the rollback boundary for the initial formal schema migration.

#### Scenario: Rolling back before production cutover
- **WHEN** formal tables have not yet become authoritative for migrated production data
- **THEN** the migration rollback path MAY remove the initial schema in reverse dependency order

#### Scenario: Rolling back after production cutover
- **WHEN** formal tables contain authoritative migrated production data
- **THEN** rollback MUST use forward repair migrations or an explicit data recovery procedure rather than silently dropping formal workflow tables

