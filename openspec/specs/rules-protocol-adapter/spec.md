## ADDED Requirements

### Requirement: Protocol version compatibility
The system SHALL maintain protocol compatibility with TS implementation for rules input and output formats.

#### Scenario: TS input format accepted
- **WHEN** request uses TS-compatible input format
- **THEN** adapter successfully parses and forwards to Python rules engine

#### Scenario: Python output converted to TS format
- **WHEN** Python rules engine returns results
- **THEN** adapter converts output to TS-compatible format before response

### Requirement: Field mapping consistency
The system SHALL map all fields between TS and Python representations without data loss.

#### Scenario: All input fields mapped
- **WHEN** TS request contains all standard fields
- **THEN** adapter maps every field to Python equivalent

#### Scenario: All output fields mapped
- **WHEN** Python returns results with all fields
- **THEN** adapter maps every field back to TS format

#### Scenario: Unknown fields preserved
- **WHEN** request contains fields not in mapping
- **THEN** adapter preserves them in passthrough mode

### Requirement: Audit context propagation
The system SHALL propagate audit context (runId, operator, timestamp) across protocol boundaries.

#### Scenario: Audit fields forwarded to Python
- **WHEN** TS request includes audit context
- **THEN** adapter includes audit fields in Python service call

#### Scenario: Audit fields returned in response
- **WHEN** Python service returns with audit context
- **THEN** adapter includes audit fields in TS-format response

### Requirement: Error format translation
The system SHALL translate Python error responses to TS-compatible error format.

#### Scenario: Validation error translated
- **WHEN** Python service returns validation error
- **THEN** adapter converts to TS error format with matching error codes

#### Scenario: System error translated
- **WHEN** Python service returns system error
- **THEN** adapter converts to TS error format preserving error details
