## MODIFIED Requirements

### Requirement: Sensitive Runtime Values Must Be Externally Injected
The system SHALL load JWT signing secrets, SMTP credentials, LLM provider credentials, and LLM API keys from explicitly injected runtime configuration and MUST NOT generate production-usable fallback values from repository-owned defaults.

#### Scenario: Starting a deployment-oriented environment
- **WHEN** the application starts in staging or production mode
- **THEN** JWT secrets, enabled SMTP credentials, enabled LLM credentials, and LLM API keys MUST come from explicit runtime injection and MUST NOT resolve to hard-coded fallback values

#### Scenario: Disabled optional integration
- **WHEN** SMTP or LLM functionality is explicitly disabled by configuration
- **THEN** the runtime MAY start without the corresponding provider credentials, but it MUST NOT synthesize fake defaults for an enabled integration
