## ADDED Requirements

### Requirement: Dual backend invocation
The system SHALL invoke identical HTTP requests against both TS and Python backends in parallel.

#### Scenario: Successful dual invocation
- **WHEN** a test request is submitted to the comparison proxy
- **THEN** the proxy SHALL send the request to both TS backend and Python backend
- **AND** both responses SHALL be captured with full headers, status codes, and body content

#### Scenario: Backend timeout handling
- **WHEN** one backend times out while the other responds
- **THEN** the comparison SHALL record the timeout as a difference
- **AND** the test SHALL not block indefinitely

### Requirement: Response comparison
The system SHALL compare responses from both backends and detect differences.

#### Scenario: Identical responses
- **WHEN** both backends return identical status codes, headers, and body content
- **THEN** the comparison SHALL pass with no differences recorded

#### Scenario: Status code difference
- **WHEN** backends return different HTTP status codes
- **THEN** the comparison SHALL record a difference with both status codes

#### Scenario: Body content difference
- **WHEN** response bodies differ in structure or values
- **THEN** the comparison SHALL record a JSON diff showing the differences

#### Scenario: Header difference
- **WHEN** response headers differ (excluding allowlisted headers)
- **THEN** the comparison SHALL record the header differences

### Requirement: Allowlist support
The system SHALL support an allowlist of acceptable differences that do not fail comparisons.

#### Scenario: Allowlisted field difference
- **WHEN** a field listed in the allowlist differs between responses
- **THEN** the comparison SHALL pass and log the difference as expected

#### Scenario: Allowlist configuration
- **WHEN** a developer adds a field to the allowlist
- **THEN** the allowlist SHALL require a justification comment
- **AND** the allowlist SHALL be version controlled

### Requirement: Fixture management
The system SHALL support deterministic test fixtures for repeatable comparisons.

#### Scenario: Database seeding
- **WHEN** a comparison test starts
- **THEN** the system SHALL seed the database with fixture data
- **AND** the database state SHALL be identical for both backends

#### Scenario: Database cleanup
- **WHEN** a comparison test completes
- **THEN** the system SHALL reset the database to clean state

#### Scenario: Request fixture loading
- **WHEN** a comparison test runs
- **THEN** the system SHALL load request payloads from fixture files
- **AND** fixtures SHALL be version controlled in tests/regression/fixtures/

### Requirement: Difference logging
The system SHALL log all detected differences to persistent storage.

#### Scenario: Difference file creation
- **WHEN** a comparison detects differences
- **THEN** the system SHALL create a JSON file at tests/regression/diffs/<timestamp>.json
- **AND** the file SHALL contain request details, both responses, and diff analysis

#### Scenario: Difference metadata
- **WHEN** logging a difference
- **THEN** the log SHALL include endpoint, timestamp, fixture name, and difference type

### Requirement: CI integration
The system SHALL integrate with CI/CD pipeline to block merges on unadjudicated differences.

#### Scenario: Pre-merge regression check
- **WHEN** a pull request is created
- **THEN** the CI pipeline SHALL run regression comparison tests
- **AND** the pipeline SHALL fail if unadjudicated differences are detected

#### Scenario: Adjudicated differences
- **WHEN** all differences have been adjudicated as acceptable
- **THEN** the CI pipeline SHALL pass the regression check
