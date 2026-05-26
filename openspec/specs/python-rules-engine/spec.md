## ADDED Requirements

### Requirement: Three-class event recognition
The system SHALL recognize and classify three types of events: task creation, approval requests, and activity log entries.

#### Scenario: Task creation event recognized
- **WHEN** a task creation event is received
- **THEN** system classifies it as "task" type and extracts task metadata

#### Scenario: Approval event recognized
- **WHEN** an approval request event is received
- **THEN** system classifies it as "approval" type and extracts approval metadata

#### Scenario: Activity log event recognized
- **WHEN** an activity log event is received
- **THEN** system classifies it as "activity" type and extracts activity metadata

### Requirement: Event deduplication
The system SHALL deduplicate events based on event type and key fields to prevent duplicate processing.

#### Scenario: Duplicate task event rejected
- **WHEN** two task events with identical task ID arrive within deduplication window
- **THEN** system processes first event and rejects second as duplicate

#### Scenario: Duplicate approval event rejected
- **WHEN** two approval events with identical approval ID arrive within deduplication window
- **THEN** system processes first event and rejects second as duplicate

#### Scenario: Different events not deduplicated
- **WHEN** two events with different IDs or types arrive
- **THEN** system processes both events independently

### Requirement: Output parity with TS reference
The system SHALL produce output matching the TS reference implementation for identical inputs.

#### Scenario: Recognition output matches TS
- **WHEN** same event is processed by both Python and TS implementations
- **THEN** event classification and extracted metadata are identical

#### Scenario: Deduplication behavior matches TS
- **WHEN** same event sequence is processed by both implementations
- **THEN** deduplication decisions (accept/reject) are identical

### Requirement: Audit context preservation
The system SHALL preserve audit fields (runId, operator, timestamp) throughout event processing.

#### Scenario: Audit fields propagated
- **WHEN** event is processed with audit context
- **THEN** output includes original runId, operator, and timestamp

#### Scenario: Missing audit context rejected
- **WHEN** event arrives without required audit fields
- **THEN** system rejects event with validation error
