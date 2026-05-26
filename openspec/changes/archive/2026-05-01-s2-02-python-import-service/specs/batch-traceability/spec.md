## ADDED Requirements

### Requirement: Batch history storage
The system SHALL store batch metadata (batch ID, timestamp, operator, file name, record counts).

#### Scenario: Batch record created
- **WHEN** a batch import starts
- **THEN** system creates a batch record with unique ID, timestamp, operator, and file name

#### Scenario: Batch status updated
- **WHEN** a batch import completes
- **THEN** system updates batch record with final counts (total, success, failed) and completion timestamp

### Requirement: Batch history retrieval
The system SHALL provide an API endpoint to retrieve batch history with filtering and pagination.

#### Scenario: List recent batches
- **WHEN** user requests GET /api/import/batches
- **THEN** system returns paginated list of batches ordered by timestamp descending

#### Scenario: Filter by operator
- **WHEN** user requests GET /api/import/batches?operator=<id>
- **THEN** system returns only batches created by that operator

### Requirement: Batch detail retrieval
The system SHALL provide an API endpoint to retrieve detailed batch information including error records.

#### Scenario: Get batch details
- **WHEN** user requests GET /api/import/batches/<batch-id>
- **THEN** system returns batch metadata, record counts, and list of failed records with error details

### Requirement: Cross-stack audit traceability
The system SHALL maintain runId consistency with TS backend during migration phase for audit continuity.

#### Scenario: RunId preserved
- **WHEN** an import operation is traced across Python and TS systems
- **THEN** both systems reference the same runId in their audit logs
