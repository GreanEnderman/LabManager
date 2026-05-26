## ADDED Requirements

### Requirement: Each First-Batch Python Capability MUST Map To A Current TypeScript Reference Surface
The system SHALL document the concrete TypeScript implementation surface that acts as the behavioral reference for every first-batch Python capability.

#### Scenario: Mapping rules capability
- **WHEN** the migration plan records the rules service boundary
- **THEN** it MUST map that capability to the current TypeScript rule engine and related AI execution modules that define rule generation, inspection, and execution behavior

#### Scenario: Mapping report and delivery capabilities
- **WHEN** the migration plan records report generation, PDF export, and email delivery
- **THEN** it MUST map each capability to its current TypeScript service files rather than treating all reporting responsibilities as one undifferentiated reference

### Requirement: Parity Review MUST Compare Python Behavior Against TypeScript Before Cutover
The system MUST require a capability-specific parity review between the Python implementation and the mapped TypeScript reference before production traffic moves.

#### Scenario: Approving a Python capability cutover
- **WHEN** a first-batch capability is proposed for cutover to Python
- **THEN** the change record MUST include evidence that Python input handling, output semantics, and failure behavior were checked against the mapped TypeScript reference

#### Scenario: Detecting parity gaps
- **WHEN** parity review finds a mismatch between Python behavior and the mapped TypeScript reference
- **THEN** the capability MUST remain on the TypeScript runtime path or roll back to it until the mismatch is resolved

### Requirement: Parity Boundaries MUST Include Dependency And Runtime Constraints
The system SHALL record parity expectations that are not limited to pure DTO shape, including runtime constraints that materially affect production behavior.

#### Scenario: Reviewing PDF parity
- **WHEN** PDF export parity is evaluated
- **THEN** the review MUST consider content correctness and deployment-relevant rendering constraints that could change produced documents

#### Scenario: Reviewing email delivery parity
- **WHEN** email delivery parity is evaluated
- **THEN** the review MUST include recipient resolution, attachment behavior, error recording, and audit consequences in addition to response DTO compatibility
