## Why

Current external dependencies (PDF fonts, LLM, SMTP) are hardcoded for local development with fixed Windows paths and no environment-based configuration. This prevents deployment to production environments and lacks failure handling strategies.

## What Changes

- Remove hardcoded Windows font paths from PDF generation
- Add environment-based configuration for SMTP and LLM services
- Define fallback strategies for service failures
- Document deployment configuration requirements

## Capabilities

### New Capabilities
- `external-dependency-config`: Environment-based configuration for PDF fonts, LLM, and SMTP with fallback strategies

### Modified Capabilities
- `runtime-secret-injection-boundary`: Extend to cover LLM API keys and SMTP credentials

## Impact

- PDF generation code (font path resolution)
- LLM integration configuration
- SMTP email service configuration
- Deployment documentation and environment setup guides
