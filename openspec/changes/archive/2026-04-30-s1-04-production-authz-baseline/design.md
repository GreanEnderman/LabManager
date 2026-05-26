## Context

LabManager currently has a working demo authentication path in the TypeScript backend: `/api/ai/auth/login` issues an HMAC-signed JWT, `/api/ai/auth/me` reads the authenticated user, and protected routes mostly use either `requireUser` or `requireAdmin`. P0-04 already hardened runtime secret injection and bootstrap credential boundaries, so S1-04 should not reopen the default-secret problem; it should define the production baseline for authorization behavior on top of that boundary.

The current implementation gaps are production-relevant: roles exist as a union type but not as a documented permission matrix, route authorization is coarse, password hashing is demo-grade, token invalidation is limited to expiry plus enabled-user lookup, and API errors do not yet define a stable response contract for invalid credentials, expired tokens, forbidden actions, password policy failures, or rate limiting.

## Goals / Non-Goals

**Goals:**

- Define a clear V1 role matrix for `admin`, `manager`, `operator`, and `viewer` across AI workflow, inventory/equipment viewing, import, reporting, delivery, approval, and system settings surfaces.
- Establish token lifecycle and authentication invalidation rules that are enforceable by backend services and understandable by the frontend.
- Replace demo password handling with a production baseline for password complexity, password hashing, default/temporary password treatment, login failure controls, and audit evidence.
- Standardize authentication and authorization failure responses without leaking whether usernames, passwords, users, roles, or tokens are individually valid.
- Keep implementation aligned with P0-04: production must still rely on injected secrets and must not reintroduce repository-owned bootstrap credentials.

**Non-Goals:**

- Add SSO, OAuth/OIDC federation, MFA, SCIM, LDAP, or external identity provider integration.
- Build a general-purpose permission DSL, multi-tenant policy engine, or row-level access-control model.
- Implement refresh-token rotation unless the implementation explicitly chooses to add it inside the V1 token lifecycle contract.
- Redesign all user administration workflows beyond what is required to disable defaults and enforce baseline password/authz policy.
- Make LLMs decide permissions, authentication validity, or approval gates.

## Decisions

1. Use a fixed role matrix instead of ad hoc route checks.

   The implementation should introduce a central permission map or equivalent helper that maps roles to named capabilities, then have routes ask for capabilities such as `settings:update`, `imports:create`, `tasks:write`, `approvals:process`, `reports:generate`, and `report_delivery:manage`. `admin` remains the only system-governance role; `manager` may supervise AI workflow and approvals; `operator` may execute assigned operational work; `viewer` is read-only.

   Rejected alternative: keep only `requireAdmin` and `requireUser`. That is too blunt for production because many manager/operator actions are neither fully public nor admin-only.

2. Treat access tokens as short-lived bearer credentials with deterministic server-side invalidation checks.

   JWT validation must continue checking signature, issuer, audience, expiry, and user existence/enabled state. The production baseline should set a bounded access-token lifetime and require re-authentication after expiry. User disablement, role changes, password resets, and credential revocation must invalidate future authorization decisions no later than the next request, either by checking the current user record or by comparing a token version / credential timestamp if added.

   Rejected alternative: rely only on token expiry. That leaves disabled users or downgraded roles active until expiry, which is not acceptable for lab operations and approvals.

3. Move password storage to a slow salted hash and validate password policy before accepting credentials.

   SHA-256 hashing is acceptable for demos but not a production password baseline. The implementation should use Node built-in `crypto.scrypt`/`scryptSync` or another already-approved local mechanism rather than adding a new dependency by default. Stored password hashes must include algorithm and salt metadata so future migrations can detect legacy hashes. Login should reject legacy/default credentials through the same generic authentication failure path.

   Rejected alternative: introduce a new password hashing dependency immediately. A dependency may be chosen later, but the current project rule says no new dependencies without explicit request, and Node has a suitable built-in KDF.

4. Keep bootstrap/default-account policy separate from operator-managed user lifecycle.

   P0-04 already prohibits repository-owned default credentials. S1-04 should add that production and staging must also reject enabled default/demo accounts, prohibited default passwords, or bootstrap users that have not been explicitly rotated/disabled according to policy. Local/test may still seed explicit users for demos, but those users must be marked as development/test fixtures and must not satisfy production readiness.

   Rejected alternative: allow a default admin with a forced first-login password change. That still creates a valid credential window and weakens P0-04.

5. Standardize failure responses by class while keeping sensitive details internal.

   The API should return stable envelopes and status codes: `401 unauthorized` for missing, malformed, expired, invalid, or unavailable authentication; `403 forbidden` for authenticated users lacking the required capability; `422 password_policy_violation` for accepted user-management inputs that fail policy; and `429 too_many_attempts` for login throttling. Public messages must remain generic, while logs can keep audit-safe reason codes.

   Rejected alternative: expose exact token/password/user failure reasons to clients. That helps debugging but leaks enumeration and credential-validation signals.

## Risks / Trade-offs

- [Risk] Existing demos expect admin-only behavior for all writes -> Mitigation: keep the matrix small, document changed route expectations, and add tests for each role class before moving UI affordances.
- [Risk] Password hash migration could lock out existing demo users -> Mitigation: support explicit fixture reseeding in local/test and either migrate known legacy hashes on successful login or require controlled password reset for non-local environments.
- [Risk] Token invalidation without server-side sessions is partial -> Mitigation: require current user enabled/role checks on every request and add token version or password-changed timestamp if immediate reset invalidation is needed.
- [Risk] Generic error messages reduce frontend specificity -> Mitigation: use stable error codes for UI branching and keep detailed reason codes only in server logs.
- [Risk] Login throttling may be hard with snapshot/in-memory stores -> Mitigation: implement an interface that can use in-memory counters for prototype tests and a persistent/rate-limit store in production backend follow-up work.

## Migration Plan

1. Add a central role/capability matrix and replace direct route-level `requireAdmin`/`requireUser` usage where finer permissions are required.
2. Define token policy configuration, bounded defaults for local/test, strict production validation, and tests for expiry, issuer/audience, disabled users, and changed roles.
3. Replace password hashing with salted slow hashing and add password policy validation for bootstrap/user-management paths.
4. Add default/demo account detection to production readiness validation without weakening P0-04 secret and bootstrap checks.
5. Standardize auth failure errors and update backend route tests plus frontend auth-state handling for 401/403/422/429.
6. Document the role matrix, token lifecycle, password policy, and failure response contract for operators and future backend migration work.
7. Rollback strategy: revert route capability enforcement and password-hash migration only in local/test; in staging/production, prefer forward fixes because weakening auth policy after deployment can reopen access-control exposure.

## Open Questions

- Should `manager` be allowed to create approvals, process approvals, or both, when the same user may also supervise the task?
- Does V1 require immediate token invalidation after password change through a token-version field, or is current-user enabled/role re-check plus short access-token lifetime sufficient?
- Should failed-login counters be persisted in the first implementation or deferred until the formal PostgreSQL user/session tables are available?
