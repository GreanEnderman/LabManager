# API Test Baseline Verification

## Purpose
This document records the baseline test status for migration validation.

## Baseline Established
Date: 2026-05-01

## Test Suite Summary

### Contract Tests
- **Location**: `tests/api/contract/`
- **Coverage**: Tasks, Approvals, Imports, Reports, Deliveries, Error responses
- **Baseline Snapshots**: Generated in `tests/api/contract/snapshots/`

### Permission Tests
- **Location**: `tests/api/permissions/`
- **Coverage**: RBAC, Task operations, Approval operations, Import operations, Report operations, Delivery operations

## Test Execution

To verify the baseline:
```bash
pytest tests/api/ -v
```

## Expected Behavior

### Pre-Migration
All tests should pass against the current API implementation.

### Post-Migration
- **Pass**: API behavior unchanged, migration successful
- **Fail**: Breaking change detected, requires investigation

## Failure Investigation

When tests fail post-migration:

1. **Contract test failure**: API schema or status code changed
   - Check response structure against baseline snapshot
   - Verify required fields are present
   - Confirm status codes match expectations

2. **Permission test failure**: Access control behavior changed
   - Check role-based permissions
   - Verify resource ownership boundaries
   - Confirm authorization logic

## Baseline Files

- Contract baselines: `tests/api/contract/snapshots/*.json`
- Permission matrix: `tests/api/PERMISSION_MATRIX.md`
- Test execution guide: `tests/api/README.md`

## Notes

- Tests are designed to pinpoint failures to interface or permission layer
- Baseline snapshots use schema validation (required fields) rather than exact matching
- Permission tests use matrix-based approach for systematic coverage
