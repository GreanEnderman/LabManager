## Why

Current validation scripts are insufficient for migration safety. We need comprehensive API-level regression and permission testing to ensure dual-stack migration doesn't break critical workflows or introduce permission vulnerabilities.

## What Changes

- Establish contract testing framework covering all critical API endpoints
- Add permission boundary testing for role-based access control
- Create baseline test suite for pre/post migration comparison
- Cover failure branches and error handling paths

## Capabilities

### New Capabilities
- `api-regression-tests`: Contract tests for tasks, approvals, imports, reports, and delivery endpoints
- `permission-boundary-tests`: Tests validating role-based access control and permission enforcement

### Modified Capabilities
<!-- No existing capabilities are being modified at the requirement level -->

## Impact

- Dependencies: Builds on P0-02 (core API structure) and S1-04 (validation scripts)
- Test infrastructure: New test suites for contract and permission validation
- CI/CD: Test baseline becomes part of migration validation process
- Debugging: Failed tests pinpoint interface or permission layer issues
