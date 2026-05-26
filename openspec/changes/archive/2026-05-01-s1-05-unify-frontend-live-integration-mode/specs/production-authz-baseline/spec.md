## MODIFIED Requirements

### Requirement: Authentication And Authorization Failures Must Use Stable API Responses
The system MUST standardize authentication and authorization failure responses across backend APIs, and the live frontend integration runtime MUST consume those responses through the HTTP `/api/ai` path without substituting local demo behavior.

#### Scenario: Missing or invalid authentication
- **WHEN** a request lacks a valid bearer token or provides an invalid, malformed, expired, or revoked token
- **THEN** the API MUST respond with HTTP 401 and an error envelope using code `unauthorized`

#### Scenario: Authenticated user lacks capability
- **WHEN** an authenticated user requests an action outside their role matrix capabilities
- **THEN** the API MUST respond with HTTP 403 and an error envelope using code `forbidden`

#### Scenario: Password policy input is invalid
- **WHEN** a user-management or bootstrap request provides a password that fails policy validation
- **THEN** the API MUST respond with HTTP 422 and an error envelope using code `password_policy_violation`

#### Scenario: Login throttling is active
- **WHEN** login attempts are throttled by policy
- **THEN** the API MUST respond with HTTP 429 and an error envelope using code `too_many_attempts`

#### Scenario: Frontend receives auth failure
- **WHEN** the frontend receives 401, 403, 422, or 429 authentication-related responses
- **THEN** it MUST handle them through stable error codes rather than parsing sensitive backend messages

#### Scenario: Test or pre-release frontend consumes auth failure
- **WHEN** the frontend is running in test or pre-release integration mode and `/api/ai/auth/*` or another protected AI endpoint returns an authentication or authorization failure
- **THEN** the live HTTP runtime MUST surface that failure through its real auth/session handling path and MUST NOT recover by switching to mock state, direct gateway calls, or synthetic success data
