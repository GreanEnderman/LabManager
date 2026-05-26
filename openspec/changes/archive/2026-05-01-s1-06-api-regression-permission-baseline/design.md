## Context

Building on P0-02 (core API structure) and S1-04 (validation scripts), we need a comprehensive test baseline for dual-stack migration. Current scripts validate basic functionality but lack contract testing and permission boundary validation needed for safe migration.

## Goals / Non-Goals

**Goals:**
- Establish contract tests for critical API endpoints (tasks, approvals, imports, reports, delivery)
- Validate permission boundaries and role-based access control
- Create reusable baseline for pre/post migration comparison
- Enable pinpointing failures to interface or permission layer

**Non-Goals:**
- Unit testing (covered by existing test suites)
- Performance/load testing (separate effort)
- UI/E2E testing (out of scope)

## Decisions

**Test Framework**: Use pytest with requests library for API contract testing
- Rationale: Consistent with existing Python backend, simple HTTP assertions, good fixture support
- Alternative considered: Postman/Newman (rejected: less flexible for permission matrix testing)

**Permission Test Strategy**: Matrix-based testing (role × endpoint × expected outcome)
- Rationale: Systematic coverage of all role/endpoint combinations, easy to identify gaps
- Alternative considered: Scenario-based tests (rejected: harder to ensure complete coverage)

**Baseline Storage**: JSON snapshots of request/response contracts
- Rationale: Diffable, version-controllable, can detect unintended API changes
- Alternative considered: Database fixtures (rejected: harder to review in PRs)

**Test Organization**: Separate suites for contract vs permission tests
- Rationale: Different failure modes, different debugging workflows
- Contract tests: `tests/api/contract/`
- Permission tests: `tests/api/permissions/`

## Risks / Trade-offs

**[Risk]** Contract tests may be brittle if API responses change frequently
→ Mitigation: Use schema validation (required fields) rather than exact matching, allow optional fields to vary

**[Risk]** Permission matrix grows large (N roles × M endpoints)
→ Mitigation: Parameterized tests, focus on boundary cases (admin/user/guest), skip redundant combinations

**[Trade-off]** Baseline snapshots add maintenance overhead
→ Accepted: Migration safety justifies the cost, snapshots provide clear diff on breaking changes
