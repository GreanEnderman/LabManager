# Frontend Live Integration Mode

## Purpose

This capability defines the frontend runtime mode constraints for test, staging, and production environments, ensuring that live integration validates the HTTP backend through `/api/ai` without silent fallback to mock or direct gateway paths.

## Requirements

### Requirement: Test And Pre-Release Frontend Runtime Must Use HTTP AI Gateway
The frontend SHALL use the HTTP AI gateway as the only supported runtime path for test, staging, and production-like integration environments.

#### Scenario: Integration environment starts without explicit gateway override
- **WHEN** the frontend is built or started for test, staging, or pre-release integration and `VITE_AI_GATEWAY_MODE` is omitted
- **THEN** the runtime MUST resolve the AI gateway to the HTTP implementation and MUST target `/api/ai` unless an explicit HTTP base URL override is provided

#### Scenario: Integration environment sets gateway mode to http
- **WHEN** `VITE_AI_GATEWAY_MODE=http` is provided in a live integration environment
- **THEN** the frontend MUST initialize live AI providers through the HTTP gateway and MUST NOT instantiate direct or mock-backed runtime providers for AI state, AI settings, or import state

#### Scenario: Integration environment provides explicit base URL
- **WHEN** `VITE_AI_API_BASE_URL` is configured for a test or pre-release deployment
- **THEN** the frontend MUST send AI HTTP requests to that base URL and MUST treat it as an override of the default `/api/ai` path without changing the gateway type

### Requirement: Unsupported Gateway Modes Must Fail Fast
The frontend MUST reject unsupported AI gateway modes in live integration environments instead of silently falling back.

#### Scenario: Non-http gateway mode is configured
- **WHEN** the frontend runtime reads `VITE_AI_GATEWAY_MODE` with a value other than `http`
- **THEN** gateway initialization MUST fail before live AI requests proceed and MUST surface a clear configuration error

#### Scenario: HTTP backend is unavailable
- **WHEN** a live provider or facade request cannot reach the configured `/api/ai` backend
- **THEN** the frontend MUST surface the HTTP failure through the live runtime path and MUST NOT substitute mock or direct data to keep the page appearing healthy

### Requirement: Live Integration Pages Must Preserve HTTP-Only Behavior
Pages and providers that participate in live AI integration SHALL consume only the live HTTP-backed runtime contract.

#### Scenario: Application bootstraps AI runtime
- **WHEN** the main frontend application mounts AI state, AI settings, or import providers
- **THEN** it MUST wire the live provider variants and MUST NOT mount legacy mock/direct providers in the live app entrypoint

#### Scenario: Live page reads or mutates AI workflow data
- **WHEN** users open AI workbench, runtime settings, reports, approvals, tasks, or HTTP-backed import views in a test or pre-release integration environment
- **THEN** those pages MUST fetch and mutate data through the HTTP-backed facade and MUST NOT catch integration failures by switching to mock workflow data

### Requirement: Runtime Mode Switching Rules Must Be Documented
The project SHALL document how frontend AI runtime mode is selected and which environments may use each path.

#### Scenario: Engineer prepares a test or pre-release deployment
- **WHEN** an engineer reads the frontend environment or integration documentation
- **THEN** the documentation MUST state that test and pre-release integration validate only the HTTP backend through `/api/ai`, including the default base path and the allowed override variables

#### Scenario: Engineer configures bootstrap authentication for HTTP integration
- **WHEN** an engineer configures `VITE_AI_HTTP_USERNAME` and `VITE_AI_HTTP_PASSWORD`
- **THEN** the documentation MUST explain that these variables are optional helpers for HTTP login bootstrap and MUST NOT be described as a mock or direct-mode bypass

### Requirement: Frontend Must Not Quietly Revert To Mock Logic During Integration
The frontend MUST make integration regressions observable instead of silently recovering with local mock behavior.

#### Scenario: Authenticated live request returns auth failure
- **WHEN** `/api/ai/auth/*` or another protected AI endpoint returns 401, 403, 422, or 429 during test or pre-release integration
- **THEN** the frontend MUST propagate the live auth failure behavior defined by the HTTP runtime and MUST NOT replace the response with locally synthesized mock success state

#### Scenario: Legacy mock implementation remains in repository
- **WHEN** legacy mock/direct providers continue to exist for local demo reference
- **THEN** their presence in source code MUST NOT alter the runtime path used by test or pre-release builds and MUST NOT be presented as an automatic fallback
