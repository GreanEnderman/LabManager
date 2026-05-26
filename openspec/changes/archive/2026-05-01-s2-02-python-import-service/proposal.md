## Why

The TS prototype backend is frozen per M-02, and heavy capabilities like import, validation, and batch tracing must migrate to the Python target stack. This change establishes the Python import service as the primary implementation for online import workflows.

## What Changes

- Implement Python-based import service supporting manual entry and batch upload
- Add validation engine that returns structured error lists
- Build batch history and traceability system
- Integrate with rule checking system (post-import validation)
- Expose unified import API for frontend consumption

## Capabilities

### New Capabilities
- `import-api`: Online import endpoints for manual and batch data entry
- `import-validation`: Validation engine with error reporting
- `batch-traceability`: Batch history tracking and audit trail

### Modified Capabilities
<!-- No existing capabilities are being modified at the spec level -->

## Impact

- Frontend will consume new Python import API (requires gateway/facade adaptation per M-01)
- TS prototype import endpoints will be deprecated after traffic switch (per M-04)
- Depends on S2-01 (Python API foundation) and S1-03 (audit continuity)
- Audit fields (operator, reason, result, time, runId) must remain consistent per M-03
