## Context

Current implementation has three hardcoded external dependencies:
- PDF fonts: Fixed Windows paths (C:\Windows\Fonts)
- LLM: API keys and endpoints hardcoded or missing
- SMTP: Email server configuration hardcoded

This prevents deployment to non-Windows environments and lacks failure handling.

## Goals / Non-Goals

**Goals:**
- Environment-based configuration for all external dependencies
- Cross-platform PDF font resolution
- Graceful degradation when services are unavailable
- Clear deployment documentation

**Non-Goals:**
- Implementing new PDF/LLM/SMTP features
- Changing existing API contracts
- Adding new external dependencies

## Decisions

**PDF Font Strategy:**
- Use environment variable `PDF_FONT_PATH` to specify font directory
- Fallback to system font directories (platform-specific)
- Fail gracefully with error message if no fonts found
- Alternative considered: Embed fonts in application (rejected due to licensing and size)

**LLM Configuration:**
- Environment variables: `LLM_API_KEY`, `LLM_ENDPOINT`, `LLM_MODEL`
- Fail fast on missing configuration (no silent fallback)
- Alternative considered: Optional LLM with degraded features (rejected - LLM is core functionality)

**SMTP Configuration:**
- Environment variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- Fallback: Log email content to file if SMTP unavailable (dev mode only)
- Alternative considered: Queue-based retry (deferred to future work)

## Risks / Trade-offs

**Risk: Missing environment variables in production** → Mitigation: Startup validation checks all required config
**Risk: Font availability varies by platform** → Mitigation: Document required fonts and provide validation script
**Trade-off: More configuration complexity** → Benefit: Deployment flexibility and security
