## ADDED Requirements

### Requirement: Formal Persistence MUST Be Materialized Through Migrations
The system MUST materialize the formal persistence model through versioned database migrations before implementation treats the model as production-ready.

#### Scenario: Implementing production repositories
- **WHEN** a repository implementation begins writing authoritative task, approval, report, import, delivery, settings, or audit data
- **THEN** the target tables MUST be created by versioned migrations rather than ad hoc startup DDL, in-memory maps, or snapshot-only persistence

#### Scenario: Reviewing persistence readiness
- **WHEN** the team reviews whether formal persistence is ready for production migration work
- **THEN** the review MUST include evidence that migrations create the required schema and schema verification passes against a configured PostgreSQL database

### Requirement: Snapshot Compatibility MUST Remain Non-Authoritative
The system MUST keep snapshot persistence separate from the formal migrated schema and MUST NOT allow snapshot storage to become the source of truth for new production persistence work.

#### Scenario: Retaining snapshots during migration
- **WHEN** snapshot hydrate or persist behavior remains available during the dual-stack transition
- **THEN** the implementation MUST label it as compatibility, fallback, export, rollback, or prototype continuity behavior rather than production authoritative storage

#### Scenario: Adding new persistence behavior
- **WHEN** new production persistence behavior needs task, approval, report, import, delivery, settings, or audit data
- **THEN** it MUST target the formal migrated tables first unless a separate approved spec changes the persistence boundary
