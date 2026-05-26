## ADDED Requirements

### Requirement: Role-based access control validation
The system SHALL validate that role-based access control is enforced across all API endpoints.

#### Scenario: Admin access to all endpoints
- **WHEN** admin user calls any protected endpoint
- **THEN** request is authorized and returns expected response

#### Scenario: Regular user access to permitted endpoints
- **WHEN** regular user calls endpoints within their permission scope
- **THEN** request is authorized and returns expected response

#### Scenario: Regular user blocked from admin endpoints
- **WHEN** regular user calls admin-only endpoint
- **THEN** request returns 403 Forbidden with standard error format

#### Scenario: Guest access blocked from protected endpoints
- **WHEN** unauthenticated user calls protected endpoint
- **THEN** request returns 401 Unauthorized with standard error format

### Requirement: Permission boundary validation for task operations
The system SHALL enforce permission boundaries for task-related operations.

#### Scenario: User can only modify own tasks
- **WHEN** user attempts to update task owned by another user
- **THEN** request returns 403 Forbidden

#### Scenario: User can view tasks within scope
- **WHEN** user requests task list
- **THEN** response includes only tasks user has permission to view

#### Scenario: Admin can modify any task
- **WHEN** admin user updates any task
- **THEN** request is authorized and task is updated

### Requirement: Permission boundary validation for approval operations
The system SHALL enforce permission boundaries for approval workflows.

#### Scenario: Only designated approvers can approve
- **WHEN** non-approver attempts to approve request
- **THEN** request returns 403 Forbidden

#### Scenario: Approver can only approve assigned requests
- **WHEN** approver attempts to approve unassigned request
- **THEN** request returns 403 Forbidden

#### Scenario: Requester cannot self-approve
- **WHEN** request creator attempts to approve their own request
- **THEN** request returns 403 Forbidden with appropriate error message

### Requirement: Permission boundary validation for import operations
The system SHALL enforce permission boundaries for data import operations.

#### Scenario: Only authorized users can initiate imports
- **WHEN** unauthorized user attempts to start import
- **THEN** request returns 403 Forbidden

#### Scenario: Users can only view own import jobs
- **WHEN** user requests import job owned by another user
- **THEN** request returns 403 Forbidden or 404 Not Found

### Requirement: Permission boundary validation for report operations
The system SHALL enforce permission boundaries for report generation and access.

#### Scenario: Users can only generate reports within scope
- **WHEN** user attempts to generate report for unauthorized data
- **THEN** request returns 403 Forbidden

#### Scenario: Report access restricted to authorized users
- **WHEN** user attempts to access report they don't own
- **THEN** request returns 403 Forbidden

### Requirement: Permission boundary validation for delivery operations
The system SHALL enforce permission boundaries for delivery tracking.

#### Scenario: Users can only view deliveries within scope
- **WHEN** user requests delivery information for unauthorized delivery
- **THEN** request returns 403 Forbidden

#### Scenario: Delivery modification restricted by role
- **WHEN** non-admin user attempts to modify delivery status
- **THEN** request returns 403 Forbidden

### Requirement: Permission matrix coverage
The system SHALL provide comprehensive test coverage of role-endpoint permission combinations.

#### Scenario: All critical endpoints tested for each role
- **WHEN** permission test suite runs
- **THEN** each role (admin, user, guest) is tested against all critical endpoints

#### Scenario: Permission test failures identify specific boundary violations
- **WHEN** permission test fails
- **THEN** test output clearly identifies role, endpoint, and expected vs actual permission result
