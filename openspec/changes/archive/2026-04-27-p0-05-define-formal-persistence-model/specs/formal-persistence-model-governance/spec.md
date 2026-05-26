## ADDED Requirements

### Requirement: Formal AI Workflow Tables
The system SHALL define the production persistence target for AI workflow data as formal relational tables named `ai_tasks`, `ai_task_actions`, `approvals`, `ai_reports`, `import_jobs`, `report_deliveries`, and `system_settings`.

#### Scenario: Freezing the production table set
- **WHEN** the team prepares schema migrations, repository contracts, or target-stack persistence work for AI workflows
- **THEN** those implementations MUST target the formal table set of `ai_tasks`, `ai_task_actions`, `approvals`, `ai_reports`, `import_jobs`, `report_deliveries`, and `system_settings` rather than inventing alternate source-of-truth tables

#### Scenario: Reviewing persistence scope for a new workflow feature
- **WHEN** a new AI workflow capability depends on task, approval, reporting, import, delivery, or runtime policy data
- **THEN** the persistence review MUST map that capability onto the formal table set or explicitly propose a follow-up spec delta before adding new authoritative storage surfaces

### Requirement: Strong Business Fields Must Be Structured
The system MUST store workflow identity, lifecycle, relationship, status, query, and audit fields in typed relational columns, using `metadata` JSONB only for bounded extension data that is not the sole home of core business truth.

#### Scenario: Modeling task lifecycle data
- **WHEN** the team defines fields such as task status, source linkage, due time, approval requirement, or report delivery status
- **THEN** those fields MUST be modeled as structured columns and MUST NOT exist only inside `metadata` or snapshot payloads

#### Scenario: Adding optional extension context
- **WHEN** an implementation needs to preserve auxiliary context that is not part of the core relational workflow truth
- **THEN** that context MAY be stored in `metadata`, provided the row still exposes all fields required for joins, filtering, state transitions, and audit review as first-class columns

### Requirement: Formal Relationships And Access Paths
The system SHALL define relational integrity and index expectations for the AI workflow persistence model, including links from task actions to tasks, approvals to tasks, report deliveries to reports, and indexes that support primary operational queries.

#### Scenario: Creating schema constraints
- **WHEN** relational migrations are created for the formal persistence model
- **THEN** they MUST include foreign-key constraints for `ai_task_actions.task_id`, `ai_task_actions.approval_id` when present, `approvals.task_id`, and `report_deliveries.report_id`

#### Scenario: Preparing operational read paths
- **WHEN** the team defines indexes for task lists, approval queues, report history, import history, delivery tracking, or settings lookup
- **THEN** the index plan MUST cover status-oriented and relationship-oriented reads needed by dashboard, task center, approvals, reports, imports, and delivery workflows

### Requirement: Audit Fields Are Mandatory
The system MUST retain explicit audit timestamps and action evidence on formal persistence rows so workflow history remains queryable without reconstructing truth from a snapshot blob.

#### Scenario: Persisting mutable workflow rows
- **WHEN** a row in `ai_tasks`, `approvals`, `ai_reports`, `import_jobs`, `report_deliveries`, or `system_settings` is created or updated
- **THEN** the schema MUST provide explicit lifecycle timestamps such as `created_at`, `updated_at`, and domain-specific terminal timestamps where applicable

#### Scenario: Recording workflow actions
- **WHEN** a task or approval transition is persisted
- **THEN** the system MUST record it through `ai_task_actions` with actor context, action detail, and point-in-time evidence so auditors can review why the transition occurred

### Requirement: Snapshot Store Is Transitional Only
The system MUST treat `PostgresSnapshotStore` and `ai_state_snapshots` as transition-only compatibility infrastructure and MUST NOT use them as the production authoritative persistence model once formal tables exist.

#### Scenario: Implementing new production persistence work
- **WHEN** a developer adds or migrates production persistence behavior for tasks, approvals, reports, imports, deliveries, or settings
- **THEN** the implementation MUST write against the formal relational table model first and MUST NOT introduce new source-of-truth dependencies on `ai_state_snapshots`

#### Scenario: Using snapshot persistence during migration
- **WHEN** snapshot hydrate or persist logic is retained for fallback, export, rollback, or prototype continuity during migration
- **THEN** that path MUST be documented as non-authoritative compatibility behavior rather than the primary persistence truth
