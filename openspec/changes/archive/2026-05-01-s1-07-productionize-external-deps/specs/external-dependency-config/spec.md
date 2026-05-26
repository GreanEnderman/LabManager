## ADDED Requirements

### Requirement: PDF font path configuration
The system SHALL support environment-based PDF font path configuration that works across platforms.

#### Scenario: Environment variable provided
- **WHEN** `PDF_FONT_PATH` environment variable is set
- **THEN** system uses fonts from the specified directory

#### Scenario: Fallback to system fonts
- **WHEN** `PDF_FONT_PATH` is not set
- **THEN** system searches platform-specific system font directories

#### Scenario: No fonts available
- **WHEN** no fonts are found in configured or system paths
- **THEN** system fails with clear error message indicating missing fonts

### Requirement: LLM service configuration
The system SHALL require environment-based configuration for LLM service integration.

#### Scenario: All LLM config provided
- **WHEN** `LLM_API_KEY`, `LLM_ENDPOINT`, and `LLM_MODEL` are set
- **THEN** system connects to LLM service successfully

#### Scenario: Missing LLM configuration
- **WHEN** any required LLM environment variable is missing
- **THEN** system fails at startup with clear error message

### Requirement: SMTP service configuration
The system SHALL support environment-based SMTP configuration with development fallback.

#### Scenario: Production SMTP configuration
- **WHEN** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` are set
- **THEN** system sends emails via configured SMTP server

#### Scenario: Development mode fallback
- **WHEN** SMTP configuration is incomplete and system is in development mode
- **THEN** system logs email content to file instead of sending

#### Scenario: Production without SMTP config
- **WHEN** SMTP configuration is incomplete and system is in production mode
- **THEN** system fails email operations with clear error message

### Requirement: Startup configuration validation
The system SHALL validate all required external dependency configuration at startup.

#### Scenario: All required config present
- **WHEN** application starts with all required environment variables
- **THEN** system completes startup successfully

#### Scenario: Missing required config
- **WHEN** application starts with missing required environment variables
- **THEN** system fails startup with list of missing configuration
