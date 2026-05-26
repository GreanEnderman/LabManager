## ADDED Requirements

### Requirement: Record email send attempts
The system SHALL record every email send attempt with timestamp, recipients, status, and operator.

#### Scenario: Record successful send
- **WHEN** email sends successfully
- **THEN** system creates send record with status "sent" and timestamp

#### Scenario: Record failed send
- **WHEN** email send fails
- **THEN** system creates send record with status "failed" and error message

#### Scenario: Record includes operator
- **WHEN** user triggers email send
- **THEN** send record includes user ID for audit trail

### Requirement: Track delivery status
The system SHALL track delivery status transitions (queued → sending → sent/failed).

#### Scenario: Update status on send
- **WHEN** email moves from queued to sending
- **THEN** system updates send record status and timestamp

#### Scenario: Query send history
- **WHEN** user queries send history for a report
- **THEN** system returns all send attempts with status and timestamps

### Requirement: Retry failed deliveries
The system SHALL support manual retry of failed email deliveries.

#### Scenario: Retry failed send
- **WHEN** user retries failed send record
- **THEN** system queues new send task and creates new send record linked to original

#### Scenario: Track retry chain
- **WHEN** send is retried multiple times
- **THEN** system maintains link between original and retry records

### Requirement: Delivery audit log
The system SHALL provide queryable audit log of all delivery attempts per M-03 audit continuity rule.

#### Scenario: Query delivery audit by date range
- **WHEN** user queries deliveries between two dates
- **THEN** system returns all send records in that range

#### Scenario: Query delivery audit by recipient
- **WHEN** user queries deliveries to specific recipient
- **THEN** system returns all send records for that recipient

#### Scenario: Audit includes task runId
- **WHEN** send record is created
- **THEN** record includes task runId for cross-stack traceability per M-03
