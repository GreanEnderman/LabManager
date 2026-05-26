## ADDED Requirements

### Requirement: First-Batch Python Migration Scope MUST Freeze The Initial Capability Set
The system SHALL define the first Python migration wave as exactly six production backend capabilities: rules service, import service, report generation, PDF export, email delivery, and async job execution.

#### Scenario: Recording the first migration wave
- **WHEN** planning artifacts define the initial Python migration scope
- **THEN** they MUST list rules service, import service, report generation, PDF export, email delivery, and async job execution as the first-batch capability set

#### Scenario: Reviewing a proposed migration addition
- **WHEN** a new heavy backend capability is proposed for the first migration wave after the scope has been frozen
- **THEN** the review MUST treat it as out of scope for this change unless a separate planning change explicitly extends the capability set

### Requirement: Each First-Batch Capability MUST Have An Explicit Input And Output Contract
The system SHALL define a migration-facing input and output contract for every first-batch capability, using canonical shared DTOs where transport semantics already exist.

#### Scenario: Defining the rules service contract
- **WHEN** the migration plan documents rules service ownership
- **THEN** it MUST define the service input and output boundary in terms of the canonical rule inspection and rule execution DTOs rather than an implementation-only description

#### Scenario: Defining the import service contract
- **WHEN** the migration plan documents import capability ownership
- **THEN** it MUST define the chemical and equipment import request and response boundaries, including batch and error outputs, using the canonical shared DTO contract

#### Scenario: Defining downstream delivery contracts
- **WHEN** the migration plan documents report generation, PDF export, email delivery, or async execution
- **THEN** each capability MUST have a documented input and output boundary that is specific enough to guide implementation and parity checks

### Requirement: Migration Order MUST Respect Capability Dependencies
The system SHALL define the first-batch migration order so that enabling capabilities move before the capabilities that depend on them.

#### Scenario: Sequencing the first migration wave
- **WHEN** the first-batch implementation order is documented
- **THEN** async job execution MUST be prepared before dependent background workloads, rules service MUST precede import-triggered rule inspection, report generation MUST precede PDF export, and PDF export MUST precede email delivery

#### Scenario: Reviewing a cutover plan that violates dependencies
- **WHEN** a rollout proposal places a dependent capability ahead of an upstream dependency
- **THEN** the proposal MUST be rejected or revised before implementation begins

### Requirement: Each Capability MUST Define Cutover And Rollback Rules
The system SHALL define an independent cutover path and rollback path for every first-batch capability so the migration can proceed in stages without repo-wide reversal.

#### Scenario: Planning a capability cutover
- **WHEN** the migration plan marks a capability ready to move to Python ownership
- **THEN** it MUST state the trigger for cutover, the runtime boundary that changes, and the parity evidence required before traffic moves

#### Scenario: Planning a capability rollback
- **WHEN** the migration plan defines rollback for a first-batch capability
- **THEN** it MUST specify how that capability returns to the TypeScript implementation without changing shared DTO semantics or unrelated capability ownership
