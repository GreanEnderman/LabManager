## 1. Role Matrix And Authorization Boundary

- [x] 1.1 Inventory protected backend routes and frontend permission checks that currently depend on `requireUser`, `requireAdmin`, or local role assumptions.
- [x] 1.2 Define a central named-capability matrix for `admin`, `manager`, `operator`, and `viewer` covering AI tasks, approvals, reports, report delivery, imports, settings, inventory/equipment reads, rule execution, and agent execution.
- [x] 1.3 Replace route-level ad hoc role checks with named-capability authorization helpers.
- [x] 1.4 Add route authorization tests for allowed and rejected actions for each role.
- [x] 1.5 Update frontend role-gated navigation/actions to consume the same capability semantics or a shared DTO-compatible matrix.

## 2. Token Lifecycle And Invalidation

- [x] 2.1 Define token policy configuration for local/test/staging/production, including bounded access-token lifetime and production validation.
- [x] 2.2 Ensure token validation checks signature, issuer, audience, expiry, token format, current user existence, enabled state, and current authorization state.
- [x] 2.3 Add invalidation support for disabled users, role changes, password reset, or credential revocation using current user state and, if needed, token version or password-changed timestamp.
- [x] 2.4 Add tests for expired tokens, wrong issuer/audience, disabled users, role changes after token issuance, and malformed tokens.
- [x] 2.5 Update frontend auth handling so expired or invalid tokens clear authenticated state and route users back through login without retry loops.

## 3. Password Policy And Credential Storage

- [x] 3.1 Define password policy constants and validation helpers for length, character mix, prohibited/default passwords, and local/test fixture exceptions.
- [x] 3.2 Replace demo SHA-256 password storage with salted slow hashing and algorithm metadata using existing platform capabilities.
- [x] 3.3 Add controlled handling for legacy demo hashes, requiring migration or reset before staging/production readiness.
- [x] 3.4 Apply password policy validation to bootstrap and any user/password creation or reset entry points.
- [x] 3.5 Add tests for accepted passwords, rejected weak/default passwords, constant-time verification, and legacy-hash production rejection.

## 4. Default Account And Bootstrap Readiness

- [x] 4.1 Extend production readiness validation to detect enabled default/demo accounts and repository-owned bootstrap users.
- [x] 4.2 Ensure no account is implicitly created when bootstrap users are not explicitly configured.
- [x] 4.3 Preserve explicit local/test fixture users while marking them as non-production-ready.
- [x] 4.4 Add tests that staging/production fail readiness when default/demo accounts or prohibited fixture credentials are present.
- [x] 4.5 Update environment examples and deployment docs to explain allowed local/test fixtures versus forbidden production accounts.

## 5. Failure Response And Audit Contract

- [x] 5.1 Standardize auth-related errors for `401 unauthorized`, `403 forbidden`, `422 password_policy_violation`, and `429 too_many_attempts`.
- [x] 5.2 Ensure public auth failure messages do not reveal whether username, password, user state, token signature, or role boundary was the exact cause.
- [x] 5.3 Add login failure throttling policy and storage interface suitable for current prototype and later persistent backend.
- [x] 5.4 Record audit-safe login success, login failure, throttling, forbidden action, and token invalidation evidence without raw passwords or full tokens.
- [x] 5.5 Add backend and frontend tests for stable error codes and UI behavior on 401, 403, 422, and 429.

## 6. Documentation And Validation

- [x] 6.1 Document the production authentication and authorization baseline, including role matrix, token lifecycle, password policy, default account policy, and failure response contract.
- [x] 6.2 Cross-reference P0-04 so future work does not weaken runtime secret injection or bootstrap credential hardening.
- [x] 6.3 Run backend lint/typecheck/tests and relevant frontend checks after implementation.
- [x] 6.4 Run OpenSpec validation for `s1-04-production-authz-baseline` and record any verification gaps.
