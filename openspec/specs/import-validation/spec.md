## ADDED Requirements

### Requirement: Field-level validation
The system SHALL validate each field against defined rules (type, format, range, required).

#### Scenario: Type validation failure
- **WHEN** a field value does not match expected type (e.g., string in numeric field)
- **THEN** system returns error with field name, expected type, and actual value

#### Scenario: Required field missing
- **WHEN** a required field is missing or empty
- **THEN** system returns error identifying the missing field

### Requirement: Cross-field validation
The system SHALL validate relationships between fields (e.g., start date before end date).

#### Scenario: Date range validation
- **WHEN** end date is before start date
- **THEN** system returns error describing the constraint violation

### Requirement: Structured error reporting
The system SHALL return errors in a structured format with field path, error code, and message.

#### Scenario: Multiple validation errors
- **WHEN** a record has multiple validation failures
- **THEN** system returns all errors in a list, each with field path, error code, and human-readable message

#### Scenario: Batch error aggregation
- **WHEN** batch import has multiple failed records
- **THEN** system returns error list grouped by record index with all validation errors per record
