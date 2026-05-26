## Context

The current backend runtime still allows production-unsafe bootstrap behavior in a single shared configuration path. `backend/src/services/app-config.ts` provides default JWT, SMTP, and bootstrap admin values, while `backend/.env` demonstrates that secrets can live directly in the repository. The remediation backlog already identifies this as `P0-04`, so this design needs to turn that concern into explicit implementation boundaries before more deployment and AI integration work accumulates on top of weak defaults.

This is a cross-cutting change because it affects configuration loading, authentication bootstrap, email delivery, LLM integration, environment templates, and deployment documentation. The design therefore needs to separate development convenience from deployable runtime safety without breaking the local demo loop that the project still depends on.

## Goals / Non-Goals

**Goals:**
- Define a single runtime policy for sensitive configuration so JWT secrets, SMTP credentials, and LLM credentials are externally injected rather than silently defaulted at runtime.
- Remove or disable default administrator bootstrap behavior that creates a valid admin account from repository-owned fallback credentials.
- Establish environment-specific boundaries for local, test, staging, and production so the runtime can distinguish between allowed development conveniences and prohibited deploy-time defaults.
- Require startup validation or equivalent guardrails so unsafe production-like configuration fails fast instead of degrading into insecure behavior.

**Non-Goals:**
- Introduce a new secret manager product or require a specific cloud provider integration in this change.
- Redesign the full authentication model, RBAC model, or user lifecycle beyond bootstrap credential hardening.
- Replace all local developer ergonomics with production-grade infrastructure; local and test workflows may still use explicit non-secret development values when clearly isolated.
- Solve unrelated persistence, deployment orchestration, or Python migration items outside the configuration and credential boundary itself.

## Decisions

### 1. Split configuration policy by environment instead of using one fallback policy everywhere

The runtime will treat local/test as development-oriented environments and staging/production as deployment-oriented environments. Development-oriented environments may allow explicit non-secret placeholders or disabled integrations, but staging/production must reject unsafe defaults and missing required secrets.

Rationale:
- The project still depends on a local demo loop, so fully removing all non-production convenience would slow down progress unnecessarily.
- The real risk comes from the same fallback path being valid in production-like environments.
- An explicit environment boundary is easier to document, test, and review than a collection of ad hoc exceptions.

Alternatives considered:
- Remove every fallback in every environment. Rejected because it adds friction to local mock/demo flows without improving production safety proportionally.
- Keep current fallbacks and rely only on documentation. Rejected because documentation alone cannot prevent insecure startup behavior.

### 2. Sensitive runtime values must be explicitly injected, not synthesized from repository defaults

JWT signing secrets, SMTP credentials, and LLM API keys must come from environment variables or an external secret injection layer. The runtime may allow an integration to remain disabled when explicitly configured that way, but it must not fabricate production-usable defaults such as hard-coded JWT secrets, SMTP hosts, or seeded provider credentials.

Rationale:
- Signing and third-party credentials are security boundaries, not convenience options.
- The repository currently contains examples of dangerous defaults and checked-in secrets, so the requirement must be explicit and enforceable.
- This keeps the implementation compatible with multiple deployment targets because the injection source can remain generic.

Alternatives considered:
- Keep harmless-looking defaults like `labmanager-dev-secret` or `localhost` in all environments. Rejected because these values are easy to leak into staging/production and weaken the trust boundary.
- Make only JWT strict and leave SMTP/LLM optional with implicit defaults. Rejected because the backlog item explicitly covers all sensitive configuration surfaces.

### 3. Bootstrap admin creation must require explicit opt-in and must be blocked in staging/production

The runtime will no longer create a valid administrator from built-in fallback credentials. Bootstrap users may still exist as a controlled development/test mechanism, but only when explicitly supplied and only in environments that allow bootstrap seeding. Staging/production must reject startup if bootstrap credentials are still enabled through a development-only path.

Rationale:
- A default admin account is equivalent to a shipped credential and creates an immediate production blocker.
- Explicit opt-in preserves local setup flexibility without making it the default runtime path.
- The boundary is simple to audit: no repository-owned fallback user, no production bootstrap seed.

Alternatives considered:
- Keep a default admin but force a password change at first login. Rejected because the unsafe credential still exists before first login.
- Hide bootstrap credentials in sample files only. Rejected because generated fallback users in code remain exploitable.

### 4. Startup validation should fail fast on unsafe deployment configuration

The implementation should validate environment class, required secrets, and bootstrap settings during startup. If a staging/production environment is missing a required JWT secret, uses development placeholders, or enables forbidden bootstrap credentials, startup must fail with a clear configuration error.

Rationale:
- Security boundaries are most reliable when enforced before the service becomes reachable.
- Fast failure reduces the chance that unsafe instances reach preview, pre-production, or production traffic.
- Validation produces a deterministic contract that can be covered by unit and configuration tests.

Alternatives considered:
- Warn in logs but continue starting. Rejected because warnings are easy to miss and do not remove the exposure window.
- Validate only in deployment scripts. Rejected because runtime enforcement must remain portable across deployment mechanisms.

## Risks / Trade-offs

- [Local development becomes slightly more explicit] -> Mitigation: keep a documented local/test path with explicit `.env.example` guidance and opt-in bootstrap seed configuration.
- [Environment classification may be misconfigured] -> Mitigation: centralize environment mode parsing and test representative local/test/staging/production cases.
- [Existing demos may currently rely on implicit defaults] -> Mitigation: include migration steps for sample config, seed setup, and startup validation updates in the implementation tasks.
- [Developers may confuse disabled integrations with missing secrets] -> Mitigation: document the distinction between "feature disabled by config" and "feature enabled but secret missing" in both spec and implementation notes.

## Migration Plan

1. Introduce an explicit environment mode and sensitive-config validation path in runtime configuration loading.
2. Remove repository-owned fallback admin credentials and switch bootstrap seeding to explicit opt-in configuration.
3. Update `.env.example` and related docs so local/test values remain illustrative without implying production-safe defaults.
4. Add tests for startup validation, bootstrap gating, and secret injection behavior across environment classes.
5. Remove checked-in sensitive values from tracked environment files as part of implementation and repository hygiene.
6. Rollback strategy: if validation blocks local demo unexpectedly, temporarily use explicit development-only configuration values rather than restoring insecure global defaults.

## Open Questions

- Whether pre-production should be modeled as the same strict class as production or as a distinct alias with identical secret requirements.
- Whether bootstrap user provisioning should move fully into an admin setup command after this change or remain as an explicit development/test runtime option.
