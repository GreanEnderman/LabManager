## Context

The TS prototype backend is frozen (M-02), and import capabilities must migrate to Python. This design covers the Python import service that handles online import, validation, batch tracing, and rule integration. Dependencies: S2-01 (Python API foundation) and S1-03 (audit continuity).

## Goals / Non-Goals

**Goals:**
- Python service for manual and batch import
- Validation engine with structured error reporting
- Batch history and traceability with audit fields
- Integration with rule checking post-import
- Frontend-consumable unified API

**Non-Goals:**
- Offline/scheduled imports (future scope)
- Data transformation beyond validation
- Migration of existing TS import data (handled separately)

## Decisions

**1. FastAPI for import endpoints**
- Rationale: Consistent with S2-01 Python API foundation, async support for batch processing
- Alternative: Flask (rejected: less async-native)

**2. Pydantic for validation engine**
- Rationale: Type-safe validation, structured error messages, integrates with FastAPI
- Alternative: Custom validators (rejected: reinventing the wheel)

**3. SQLAlchemy for batch history storage**
- Rationale: ORM consistency with S2-01, supports audit fields (operator, reason, result, time, runId per M-03)
- Alternative: Raw SQL (rejected: harder to maintain audit consistency)

**4. Gateway/facade layer for frontend adaptation**
- Rationale: M-01 requires single DTO for frontend, isolates protocol differences
- Alternative: Direct frontend migration (rejected: violates M-01)

**5. Rule checking as post-import hook**
- Rationale: Decouples import from rule engine, allows async rule execution
- Alternative: Inline rule checking (rejected: blocks import response)

## Risks / Trade-offs

**[Risk]** Batch import performance for large files → Mitigation: Stream processing, chunked validation, progress tracking

**[Risk]** Audit field inconsistency during dual-track phase → Mitigation: Shared audit schema, cross-stack validation tests (M-03)

**[Risk]** Frontend breaking during gateway switch → Mitigation: Phased rollout per M-04, rollback plan to TS endpoints

**[Trade-off]** Gateway layer adds latency → Acceptable: Simplifies frontend, enables clean migration
