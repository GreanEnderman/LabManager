## ADDED Requirements

### Requirement: Manual entry endpoint
The system SHALL provide an API endpoint for manual data entry that accepts single records.

#### Scenario: Successful manual entry
- **WHEN** user submits a valid record via POST /api/import/manual
- **THEN** system validates the record, stores it, and returns success with record ID

#### Scenario: Invalid manual entry
- **WHEN** user submits an invalid record via POST /api/import/manual
- **THEN** system returns 400 with structured error details

### Requirement: Batch upload endpoint
The system SHALL provide an API endpoint for batch file upload that accepts CSV/Excel files.

#### Scenario: Successful batch upload
- **WHEN** user uploads a valid file via POST /api/import/batch
- **THEN** system processes all records, returns batch ID and summary (success/error counts)

#### Scenario: Partial batch failure
- **WHEN** user uploads a file with some invalid records
- **THEN** system processes valid records, returns batch ID, error list, and partial success status

### Requirement: Audit metadata capture
The system SHALL capture audit fields (operator, reason, time, runId) for all import operations.

#### Scenario: Audit fields recorded
- **WHEN** any import operation completes
- **THEN** system stores operator ID, reason text, timestamp, and runId in audit log
