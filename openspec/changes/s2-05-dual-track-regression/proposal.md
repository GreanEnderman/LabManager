## Why

During the TS-to-Python backend migration, we need to ensure behavioral equivalence on critical paths rather than relying on subjective "feels about right" assessments. Without systematic comparison, silent regressions in business logic, audit trails, or data transformations could go undetected until production incidents occur.

## What Changes

- Add regression comparison framework that can run identical inputs against both TS and Python backends
- Implement output comparison logic for key API endpoints (tasks, approvals, imports, reports, PDF generation)
- Create behavior difference recording and adjudication workflow
- Establish regression test suite as admission gate before phased traffic switching (M-04)
- Integrate with existing audit continuity mechanisms (M-03)

## Capabilities

### New Capabilities
- `dual-track-comparison`: Framework for running parallel requests against TS and Python backends with output comparison
- `behavior-adjudication`: System for recording, reviewing, and resolving detected behavior differences between implementations

### Modified Capabilities
<!-- No existing spec requirements are changing - this is additive testing infrastructure -->

## Impact

- **Testing Infrastructure**: New regression test harness in `tests/regression/`
- **CI/CD Pipeline**: Add regression comparison step before deployment
- **Migration Process**: Blocks traffic switching (M-04) until regression passes
- **Dependencies**: Requires S1-06 (audit schema), S2-01 (Python task API), S2-02 (Python approval API), S2-03 (Python import/report), S2-04 (Python async/email)
