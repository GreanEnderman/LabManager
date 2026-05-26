## ADDED Requirements

### Requirement: Role Matrix Must Be Explicit And Enforced
The system SHALL define and enforce a fixed V1 role matrix for `admin`, `manager`, `operator`, and `viewer`.

#### Scenario: Admin accesses governance capabilities
- **WHEN** an authenticated `admin` requests system settings, import management, report-delivery management, user/bootstrap governance, or other system-governance write actions
- **THEN** the system MUST authorize the action when all request-specific validation also passes

#### Scenario: Manager supervises AI workflow
- **WHEN** an authenticated `manager` requests AI workflow supervision actions such as listing tasks, updating task workflow state, assigning tasks, generating reports, or processing approvals allowed by policy
- **THEN** the system MUST authorize only the manager capabilities listed in the role matrix and MUST reject admin-only configuration or bootstrap-governance actions

#### Scenario: Operator executes operational tasks
- **WHEN** an authenticated `operator` requests operational task actions such as viewing assigned work, updating allowed task status, or adding execution evidence
- **THEN** the system MUST authorize only operational capabilities and MUST reject approval, settings, import-governance, and delivery-configuration actions

#### Scenario: Viewer reads without mutating
- **WHEN** an authenticated `viewer` requests dashboard, inventory, equipment, task, approval, report, or log read views
- **THEN** the system MUST allow read-only access and MUST reject mutation actions

#### Scenario: Unauthenticated access to protected resource
- **WHEN** a request without valid authentication targets a protected API
- **THEN** the system MUST reject the request before evaluating role capabilities

### Requirement: Route Authorization Must Use Named Capabilities
The system MUST authorize protected backend routes through named capabilities instead of scattered ad hoc role checks.

#### Scenario: Route requires a named capability
- **WHEN** a protected route handles a request
- **THEN** the route MUST declare or call the required capability and MUST evaluate the current user role through the central role matrix

#### Scenario: Capability is not granted
- **WHEN** an authenticated user role does not include the required capability
- **THEN** the system MUST return a forbidden response and MUST NOT execute the protected action

#### Scenario: Role matrix changes are reviewed
- **WHEN** a developer changes a role capability assignment
- **THEN** tests or specification evidence MUST identify the affected role and capability boundary

### Requirement: Access Token Lifecycle Must Be Bounded
The system SHALL issue bounded lifetime bearer access tokens and MUST reject tokens that are missing, malformed, expired, incorrectly signed, or scoped to the wrong issuer or audience.

#### Scenario: Successful login returns token lifecycle metadata
- **WHEN** valid enabled credentials are submitted to the login API
- **THEN** the system MUST return an access token, authenticated user identity, and token expiry timestamp

#### Scenario: Expired token is used
- **WHEN** a protected API receives an access token after its expiry time
- **THEN** the system MUST reject the request as unauthorized and MUST require re-authentication or a future supported refresh flow

#### Scenario: Token issuer or audience is invalid
- **WHEN** a token signature is valid but issuer or audience does not match the configured runtime policy
- **THEN** the system MUST reject the request as unauthorized

#### Scenario: Token lifetime is configured for deployment
- **WHEN** the application starts in staging or production mode
- **THEN** the configured access-token lifetime MUST be bounded by the production token policy and MUST NOT silently inherit an unsafe demo lifetime

### Requirement: Authentication Invalidation Must Follow Current User State
The system MUST invalidate authentication decisions when the backing user record is disabled, unavailable, role-downgraded, or otherwise no longer eligible.

#### Scenario: Disabled user presents previously issued token
- **WHEN** a disabled user presents a token that was issued before disablement
- **THEN** the system MUST reject the request as unauthorized

#### Scenario: User role changes after token issuance
- **WHEN** a user presents a token issued before their role was changed
- **THEN** authorization MUST use the current stored user role or an equivalent current authorization version, not stale role claims alone

#### Scenario: Password reset or credential revocation occurs
- **WHEN** a user's password is reset or credentials are explicitly revoked
- **THEN** previously issued tokens MUST become invalid no later than the next protected request according to the configured invalidation strategy

### Requirement: Password Policy Must Be Production Grade
The system SHALL enforce a password policy for created, reset, or bootstrapped credentials.

#### Scenario: Password is accepted
- **WHEN** a password is created or reset for a user
- **THEN** the system MUST require a minimum length, mixed character classes, and absence from the prohibited/default password list

#### Scenario: Password violates policy
- **WHEN** a submitted password fails the password policy
- **THEN** the system MUST reject the request with a password-policy failure response and MUST NOT store the password

#### Scenario: Default or demo password is submitted
- **WHEN** a default, demo, placeholder, or repository-known password is submitted outside an allowed local/test fixture path
- **THEN** the system MUST reject the password as prohibited

### Requirement: Password Storage Must Use Salted Slow Hashing
The system MUST store user passwords using a salted slow password hash with algorithm metadata and MUST NOT store raw passwords or unsalted fast hashes for production users.

#### Scenario: New password is stored
- **WHEN** a user password is created or changed
- **THEN** the stored credential MUST include a per-password salt, slow-hash output, and enough metadata to identify the hashing algorithm

#### Scenario: Login compares password
- **WHEN** a user submits credentials to the login API
- **THEN** the system MUST verify the password using constant-time comparison of the configured password-hash format

#### Scenario: Legacy demo hash is encountered
- **WHEN** a stored credential uses a legacy demo hash format
- **THEN** staging and production MUST require migration or reset before treating that account as production-ready

### Requirement: Default Accounts Must Be Disabled For Production
The system MUST reject production readiness when default, demo, or repository-owned accounts remain enabled or implicitly creatable.

#### Scenario: Production startup detects enabled demo account
- **WHEN** staging or production startup detects an enabled default/demo account or repository-owned bootstrap user
- **THEN** the system MUST fail readiness validation or startup before serving protected requests

#### Scenario: Local fixture user is used
- **WHEN** local or test runtime explicitly enables fixture users for demonstration or tests
- **THEN** those accounts MUST be isolated to local/test policy and MUST NOT be accepted as production-ready accounts

#### Scenario: Bootstrap user is not explicitly configured
- **WHEN** no explicit bootstrap user configuration is supplied
- **THEN** the system MUST NOT create any default account

### Requirement: Login Failure Controls Must Limit Abuse
The system SHALL apply login failure controls that reduce brute-force and enumeration risk.

#### Scenario: Invalid credentials are submitted
- **WHEN** username or password validation fails during login
- **THEN** the system MUST return a generic unauthorized response and MUST NOT reveal which credential component was invalid

#### Scenario: Repeated failed login attempts occur
- **WHEN** repeated failed login attempts exceed the configured threshold for an identity or request source
- **THEN** the system MUST temporarily throttle or reject additional login attempts with a rate-limit response

#### Scenario: Authentication event is recorded
- **WHEN** login succeeds, login fails, or throttling is applied
- **THEN** the system MUST record audit-safe evidence that includes the event class and reason code without storing raw passwords or full token values

### Requirement: Authentication And Authorization Failures Must Use Stable API Responses
The system MUST standardize authentication and authorization failure responses across backend APIs.

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
