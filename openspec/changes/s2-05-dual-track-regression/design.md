## Context

The LabManager project is migrating from a TypeScript prototype backend to a Python production backend. Per M-02, the TS backend is frozen for new features and serves as reference implementation. We need systematic verification that Python reimplementation maintains behavioral equivalence on critical paths (tasks, approvals, imports, reports, PDF, email, async operations).

Current state: Both backends exist but no automated comparison mechanism. Manual testing is insufficient for catching subtle differences in business logic, audit field semantics, or data transformations.

Constraints:
- Must not disrupt ongoing development (S2-01 through S2-04)
- Must integrate with audit continuity requirements (M-03, S1-06)
- Must support phased traffic switching (M-04) by providing go/no-go signal
- Comparison must be deterministic and repeatable

## Goals / Non-Goals

**Goals:**
- Automated regression comparison for key API endpoints
- Capture and adjudicate behavior differences before production
- Provide admission gate for phased traffic switching
- Support both CI/CD pipeline and manual investigation workflows

**Non-Goals:**
- Performance benchmarking (separate concern)
- Load testing or stress testing
- Comparing internal implementation details (only observable behavior matters)
- Replacing unit tests (this is integration-level comparison)

## Decisions

### Decision 1: Comparison Architecture - Proxy-Based Dual Invocation

**Choice:** HTTP proxy that duplicates requests to both TS and Python backends, compares responses.

**Rationale:**
- Minimal code changes to existing backends
- Can run in CI or locally
- Captures real HTTP semantics (headers, status codes, body)

**Alternatives considered:**
- Shared test harness calling both backends: Requires maintaining test fixtures, harder to capture real traffic patterns
- Production traffic shadowing: Too risky during migration, harder to control inputs

### Decision 2: Comparison Scope - Critical Path Endpoints Only

**Endpoints to compare:**
- `POST /api/tasks` (create task)
- `POST /api/approvals` (approval workflow)
- `POST /api/imports` (data import)
- `GET /api/reports/:id` (report generation)
- `POST /api/pdf/generate` (PDF generation)
- `POST /api/email/send` (email dispatch)

**Rationale:**
- These are the heavy capabilities being migrated (per M-02)
- Cover audit-critical operations (per M-03)
- Manageable scope for initial implementation

**Alternatives considered:**
- All endpoints: Too broad, many are trivial CRUD
- Only read endpoints: Misses critical write-path logic

### Decision 3: Difference Adjudication - Manual Review with Categorization

**Process:**
1. Comparison detects difference → logged to `tests/regression/diffs/<timestamp>.json`
2. Developer reviews diff, categorizes as:
   - `acceptable`: Expected difference (e.g., timestamp precision, UUID format)
   - `python-correct`: Python is right, TS had bug
   - `ts-correct`: TS is right, Python needs fix
   - `needs-discussion`: Ambiguous, requires team decision
3. Acceptable differences added to allowlist
4. Blocking differences prevent traffic switch

**Rationale:**
- Not all differences are bugs (timestamps, IDs, formatting)
- Human judgment needed for business logic equivalence
- Builds institutional knowledge of migration decisions

**Alternatives considered:**
- Fully automated pass/fail: Too brittle, can't handle legitimate differences
- No categorization: Loses context for future reference

### Decision 4: Test Data Strategy - Fixture-Based with Seed Database

**Approach:**
- Seed database with known state before each comparison run
- Use fixture files in `tests/regression/fixtures/` for request payloads
- Reset database after run

**Rationale:**
- Deterministic, repeatable comparisons
- Can version control fixtures alongside code
- Avoids flaky tests from shared state

**Alternatives considered:**
- Random data generation: Non-deterministic, hard to debug failures
- Production data snapshots: Privacy concerns, too large

## Risks / Trade-offs

**[Risk]** Comparison proxy becomes bottleneck in CI pipeline  
→ **Mitigation:** Run only on pre-merge, not every commit; parallelize endpoint tests

**[Risk]** Allowlist grows too large, masking real bugs  
→ **Mitigation:** Require justification comment for each allowlist entry; periodic review

**[Risk]** Fixtures diverge from real usage patterns  
→ **Mitigation:** Seed fixtures from anonymized production logs; update quarterly

**[Risk]** Adjudication becomes rubber-stamp process  
→ **Mitigation:** Require two reviewers for `acceptable` categorization; track metrics

**[Trade-off]** Manual adjudication slows migration velocity  
→ **Accepted:** Correctness over speed; one-time cost during migration period

## Migration Plan

**Phase 1: Framework Setup**
1. Implement comparison proxy in `tests/regression/proxy.py`
2. Add fixture management utilities
3. Create diff logging and storage

**Phase 2: Endpoint Coverage**
1. Add comparison tests for each critical endpoint
2. Build initial allowlist from known differences
3. Document adjudication process

**Phase 3: CI Integration**
1. Add regression job to GitHub Actions
2. Block merges on unadjudicated differences
3. Create dashboard for diff tracking

**Phase 4: Traffic Switch Gate**
1. Run full regression suite before each M-04 phase
2. Require zero blocking differences
3. Archive results for audit trail

**Rollback:** If comparison framework causes CI instability, disable job but keep code for manual runs.

## Open Questions

- Should we compare response timing (performance) or only correctness?
- How to handle non-deterministic fields (timestamps, UUIDs) - normalize or allowlist?
- Who owns adjudication review - backend team or QA?
- Should allowlist be per-endpoint or global?
