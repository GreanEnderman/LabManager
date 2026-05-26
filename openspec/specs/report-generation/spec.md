## ADDED Requirements

### Requirement: Generate daily report
The system SHALL generate daily activity reports containing task completions, approvals, and key metrics for a specified date.

#### Scenario: Generate daily report for valid date
- **WHEN** user requests daily report for a valid date
- **THEN** system returns report with task completions, approvals, and metrics for that date

#### Scenario: Generate daily report with no data
- **WHEN** user requests daily report for date with no activity
- **THEN** system returns empty report with zero counts

### Requirement: Generate weekly report
The system SHALL generate weekly summary reports aggregating activity across a 7-day period.

#### Scenario: Generate weekly report for valid date range
- **WHEN** user requests weekly report for a valid date range
- **THEN** system returns report with aggregated task, approval, and metric data for the week

#### Scenario: Generate weekly report spanning partial data
- **WHEN** user requests weekly report where some days have no data
- **THEN** system returns report with available data and zero counts for missing days

### Requirement: Include audit metadata in reports
The system SHALL include audit metadata (operator, timestamp, runId) in all generated reports.

#### Scenario: Report includes audit trail
- **WHEN** system generates any report
- **THEN** report metadata includes operator ID, generation timestamp, and unique runId

### Requirement: Support async report generation
The system SHALL support asynchronous report generation for long-running requests.

#### Scenario: Submit async report request
- **WHEN** user submits report generation request
- **THEN** system returns task ID immediately and processes report in background

#### Scenario: Check async report status
- **WHEN** user checks status of async report task
- **THEN** system returns current status (pending, processing, completed, failed)

#### Scenario: Retrieve completed async report
- **WHEN** user retrieves completed async report by task ID
- **THEN** system returns generated report data

### Requirement: Report data aggregation
The system SHALL aggregate data from task, approval, and activity log sources for report generation.

#### Scenario: Aggregate data for report period
- **WHEN** system generates report for specified period
- **THEN** system queries all relevant data sources and aggregates results

#### Scenario: Handle missing data sources gracefully
- **WHEN** data source is unavailable during report generation
- **THEN** system logs error and continues with available data sources
