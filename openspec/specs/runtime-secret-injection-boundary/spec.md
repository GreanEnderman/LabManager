## ADDED Requirements

### Requirement: Sensitive Runtime Values Must Be Externally Injected
The system SHALL load JWT signing secrets, SMTP credentials, LLM provider credentials, and LLM API keys from explicitly injected runtime configuration and MUST NOT generate production-usable fallback values from repository-owned defaults.

#### Scenario: Starting a deployment-oriented environment
- **WHEN** the application starts in staging or production mode
- **THEN** JWT secrets, enabled SMTP credentials, enabled LLM credentials, and LLM API keys MUST come from explicit runtime injection and MUST NOT resolve to hard-coded fallback values

#### Scenario: Disabled optional integration
- **WHEN** SMTP or LLM functionality is explicitly disabled by configuration
- **THEN** the runtime MAY start without the corresponding provider credentials, but it MUST NOT synthesize fake defaults for an enabled integration

### Requirement: Environment Classes Must Define Allowed Configuration Behavior
The system MUST define distinct configuration expectations for local, test, staging, and production environments so that development-only placeholders and relaxed defaults never cross into deployment-oriented environments.

#### Scenario: Loading local or test configuration
- **WHEN** the application starts in a local or test environment
- **THEN** the runtime MUST apply the development/test configuration policy and clearly distinguish allowed illustrative values from production-required secrets

#### Scenario: Loading staging or production configuration
- **WHEN** the application starts in staging or production
- **THEN** the runtime MUST apply strict secret validation and reject any configuration path marked as development-only

### Requirement: Unsafe Deployment Configuration Must Fail Fast
The system MUST stop startup with a clear configuration error when a staging or production environment is missing required sensitive values or still uses prohibited placeholder configuration.

#### Scenario: Missing JWT secret in production
- **WHEN** production startup occurs without an explicitly injected JWT signing secret
- **THEN** the application MUST fail startup before serving requests and MUST report that the JWT secret is required

#### Scenario: Placeholder configuration detected in staging
- **WHEN** staging startup detects a development placeholder, checked-in secret source, or prohibited fallback value for a sensitive integration
- **THEN** the application MUST fail startup and identify the offending configuration boundary
