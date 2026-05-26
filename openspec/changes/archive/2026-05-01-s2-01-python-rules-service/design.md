## Context

LabManager currently has rules logic in the TS prototype backend handling three event types (task creation, approval, activity logging) with deduplication. Per M-02, TS backend is frozen for new features and Python becomes the target for heavy capabilities. This is the first migration establishing the pattern for subsequent service transfers.

Dependencies S1-02 (data model alignment) and S1-03 (audit continuity) must be complete to ensure consistent data structures and audit trail across stacks.

## Goals / Non-Goals

**Goals:**
- Migrate three-class event recognition and deduplication to Python with output matching TS reference
- Establish protocol adapter pattern for TS/Python interop during migration
- Create validation framework comparing Python vs TS outputs
- Maintain audit continuity (runId, operator, timestamp) across stacks

**Non-Goals:**
- Extending rules logic beyond current TS capabilities (per M-02)
- Migrating other services (import, reports, PDF) in this change
- Changing rules protocol semantics (input/output must stay stable)

## Decisions

**Decision 1: FastAPI service with dedicated rules module**
- **Why**: FastAPI aligns with Python target stack, provides async support, and has minimal overhead
- **Alternatives**: Flask (less async-native), Django (too heavy for microservice)

**Decision 2: Protocol adapter in gateway layer, not in Python service**
- **Why**: Keeps Python service clean, centralizes adaptation logic per M-01
- **Alternatives**: Adapter in Python service (violates M-01), dual endpoints (frontend complexity)

**Decision 3: Comparison framework as separate test harness, not inline**
- **Why**: Avoids production code carrying test-only logic, allows independent execution
- **Alternatives**: Inline comparison (pollutes production), manual testing (not repeatable)

**Decision 4: Shared Pydantic models for rules I/O**
- **Why**: Type safety, validation, and easy serialization matching TS types
- **Alternatives**: Plain dicts (no validation), dataclasses (less serialization support)

## Risks / Trade-offs

**[Risk]** Python and TS outputs diverge due to subtle logic differences  
→ **Mitigation**: Comparison framework runs on every commit, blocks merge if outputs differ

**[Risk]** Protocol adapter becomes bottleneck or single point of failure  
→ **Mitigation**: Keep adapter stateless and thin, monitor latency, maintain TS fallback path per M-04

**[Risk]** Audit fields (runId, operator) lost during cross-stack calls  
→ **Mitigation**: Explicit audit context propagation in protocol adapter, validated by S1-03 tests

**[Trade-off]** Dual-stack maintenance overhead during migration period  
→ **Accepted**: Temporary cost for safe phased migration per M-04, TS decommissioned after M-05 criteria met
