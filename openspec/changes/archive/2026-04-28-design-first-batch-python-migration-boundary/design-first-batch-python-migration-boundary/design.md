## Context

The repository already established three important upstream constraints before this change:

- `shared-dto-governance` freezes `backend/src/contracts/shared.ts` as the canonical shared transport source.
- `python-heavy-capability-intake` requires new heavy production backend capabilities to enter the Python target-stack lane by default.
- `python-backend-coexistence-boundary` and the existing `python_backend/` skeleton define a separate Python service boundary that can coexist with the current TypeScript prototype backend.

At the same time, the current TypeScript backend still contains the only concrete implementations for the first migration-wave capabilities:

- rules and event execution in `backend/src/services/rule-engine-service.ts`
- import flows in `backend/src/services/import-service.ts`
- report generation in `backend/src/services/report-service.ts`
- PDF export in `backend/src/services/report-export-service.ts`
- email delivery in `backend/src/services/report-delivery-service.ts` and `backend/src/services/smtp-email-sender.ts`

This means the repository has a destination stack and a working reference implementation, but it still lacks a migration contract that answers four implementation-critical questions:

1. Which capabilities belong to the first Python migration wave
2. What their input and output contracts are
3. How each Python capability maps back to current TypeScript behavior
4. In what order traffic can move, and how rollback is controlled

## Goals / Non-Goals

**Goals:**
- Define the first Python migration wave as rules service, import service, report generation, PDF export, email delivery, and async job execution.
- Establish canonical migration-facing input/output contracts for each first-wave capability using existing shared DTOs where available.
- Document the current TypeScript reference surface for each capability so parity work can be verified against concrete implementation ownership.
- Define migration order, cutover sequence, and rollback rules that allow staged adoption instead of a repo-wide switch.
- Clarify how async job execution becomes the execution substrate for report delivery and future long-running backend work in Python.

**Non-Goals:**
- Implement the Python versions of these services in this change.
- Replace or delete the current TypeScript services during this planning phase.
- Redefine shared DTO semantics outside `backend/src/contracts/shared.ts`.
- Finalize all persistence table details, queue topology, or production infrastructure manifests.

## Decisions

### 1. The first migration wave is capability-scoped, not API-scoped

The migration boundary will be defined by backend capability ownership rather than by immediately moving every related HTTP endpoint at once. The first batch is:

- rules service
- import service
- report generation
- PDF export
- email delivery
- async job execution

Each capability gets its own contract, TypeScript reference mapping, dependency order, and cutover/rollback rule. This prevents “all reports” or “all APIs” from being treated as a single opaque migration event.

Rationale:
- The backlog explicitly prioritizes staged migration and controlled rollback.
- Several capabilities are internally dependent. For example, email delivery depends on PDF export and generated reports, and those in turn benefit from async execution.
- Capability-scoped ownership fits the existing Python service boundary without forcing immediate frontend or route-level consolidation.

Alternatives considered:
- Migrate by route group only. Rejected because route grouping hides service dependencies and makes rollback coarse.
- Migrate the whole TypeScript backend as one wave. Rejected because it increases risk and violates the staged-cutover intent.

### 2. Shared DTOs remain the canonical transport contract, while capability contracts may define composition boundaries

For migration planning, per-capability contracts will reference existing shared DTO request/response types whenever those DTOs already exist in `backend/src/contracts/shared.ts`. Where the current TypeScript implementation exposes internal composition that is not yet a public DTO, the migration plan will describe a composition boundary but MUST NOT create a competing canonical DTO source.

Examples:
- Rules service maps to `InspectRulesRequest`, `InspectRulesResponse`, `ExecuteRuleEventRequest`, and `ExecuteRuleEventResponse`.
- Import service maps to `ImportChemicalsRequest`, `ImportChemicalsResponse`, `ImportEquipmentRequest`, `ImportEquipmentResponse`, and related batch/detail DTOs.
- Report generation maps to `GenerateReportRequest` and `GenerateReportResponse`.
- PDF export maps to `ExportReportPdfResponse`.
- Email delivery maps to `SendReportRequest`, `SendReportResponse`, and delivery config/mapping DTOs.

Rationale:
- This keeps `P0-02` intact and avoids inventing a second source of truth during migration.
- It lets Python implementation work begin from stable transport semantics while still documenting service-level ownership.

Alternatives considered:
- Create Python-only contract files for the first migration wave. Rejected because that would reintroduce parallel field semantics.
- Delay contract definition until implementation. Rejected because the backlog explicitly requires input/output boundaries before work starts.

### 3. TypeScript remains the reference implementation until each capability passes parity review and is cut over independently

Each first-wave capability will treat the current TypeScript codebase as the reference behavior during migration:

- rules: `backend/src/services/rule-engine-service.ts` and related `backend/src/ai/*`
- import: `backend/src/services/import-service.ts`
- reports: `backend/src/services/report-service.ts`
- PDF: `backend/src/services/report-export-service.ts`
- email delivery: `backend/src/services/report-delivery-service.ts`, `backend/src/services/email-sender.ts`, and `backend/src/services/smtp-email-sender.ts`
- async execution reference ownership: current synchronous orchestration plus background responsibility markers in rules/report delivery flows; Python will become the production async substrate

Traffic MAY move for one capability only after:

- its Python implementation exists
- shared DTO compatibility is verified
- parity scenarios are checked against the TypeScript reference
- rollback to the TypeScript path remains available for that capability

Rationale:
- The current TypeScript backend is the only executable reference for business behavior.
- Independent cutover reduces blast radius and supports backlog item `M-04` style staged migration.

Alternatives considered:
- Treat TypeScript as documentation-only and skip behavioral comparison. Rejected because it would make migration correctness subjective.
- Require perfect repo-wide parity before any cutover. Rejected because it blocks incremental delivery.

### 4. Migration order follows dependency gravity: rules -> import -> report -> PDF -> email, with async execution prepared before dependent cutovers

The first-wave migration order will be:

1. async job execution foundation in Python for production-grade background work
2. rules service
3. import service
4. report generation
5. PDF export
6. email delivery

Interpretation:
- Async execution is the enabling substrate and SHOULD be available before report/PDF/email workloads rely on it.
- Rules move early because they are core production logic and a prerequisite for later import-triggered rule inspection behavior.
- Import follows rules because imported data can trigger rule inspection.
- Report generation precedes PDF export because PDF depends on a generated report artifact.
- Email delivery moves last because it depends on report content, PDF attachment generation, and background execution reliability.

Rationale:
- This ordering matches current service dependency flow and minimizes cutover surprises.
- It creates rollback seams around clear producer/consumer boundaries.

Alternatives considered:
- Move email first because it is operationally visible. Rejected because it depends on upstream report/PDF behavior.
- Move import before rules. Rejected because import currently triggers rule inspection and would produce split logic ownership.

### 5. Rollout and rollback are per-capability and must preserve coexistence

Every first-wave capability needs an explicit cutover toggle or routing boundary so that Python can become the active implementation for one responsibility without forcing unrelated responsibilities to move at the same time. Rollback MUST restore the TypeScript implementation for that same capability without changing shared DTO semantics or current frontend demo operability.

The migration plan therefore distinguishes:

- ownership boundary: which stack is the default implementation owner
- request routing boundary: which runtime currently serves traffic
- rollback boundary: how to restore TypeScript handling when parity, stability, or dependency health fails

Rationale:
- The current repository is still in coexistence mode, so cutover needs to be reversible.
- Rollback on a per-capability basis is safer than reverting the whole migration wave.

Alternatives considered:
- One global “Python on/off” switch. Rejected because failures in email or PDF should not force rules/import rollback.

## Risks / Trade-offs

- [The capability list could expand before the first implementation wave starts] -> Mitigation: freeze this change to the six backlog-defined capabilities and treat later additions as new changes.
- [Current TypeScript behavior may contain implicit coupling not captured in shared DTOs] -> Mitigation: require explicit TS-to-Python reference mapping and parity scenarios per capability before cutover.
- [Async execution is partly a platform capability and partly a product capability] -> Mitigation: model it as a first-wave capability with substrate ownership so downstream services can depend on it intentionally.
- [Per-capability cutover introduces routing complexity] -> Mitigation: keep cutover order explicit and require rollback ownership for each capability instead of hiding it behind a vague “migration mode.”
- [The TypeScript PDF implementation has environment-specific font assumptions] -> Mitigation: treat PDF deployment/runtime constraints as part of parity review rather than assuming Python output is equivalent by default.

## Migration Plan

1. Freeze the first-batch capability list and publish the per-capability contracts, TypeScript mappings, ordering, cutover rules, and rollback expectations in OpenSpec artifacts.
2. For each capability, implement Python-side service ownership behind the existing shared DTO contract boundary without changing frontend-facing semantics.
3. Introduce capability-level routing or execution toggles so one capability can shift to Python while others continue on TypeScript.
4. Verify parity for the capability being migrated using scenario-based checks against the TypeScript reference path.
5. Cut traffic over in the defined order, beginning with async execution readiness and then the dependent business capabilities.
6. If any cutover fails parity, stability, or dependency checks, roll only that capability back to the TypeScript implementation while preserving DTO and audit continuity.

Rollback strategy:

- Rollback restores TypeScript implementation ownership for the affected capability only.
- Rollback MUST NOT create new shared DTO variants or move unrelated capabilities back and forth unnecessarily.
- Rollback MUST preserve audit and activity continuity across both stacks for the reverted capability.

## Open Questions

- Should capability-level cutover be expressed as gateway routing, runtime feature flags, or deployment-level service binding for this repository’s target environment?
- For async execution parity, what is the minimum acceptance baseline: queue completion only, or full retry/visibility/audit behavior parity with the TypeScript reference flows?
- Should PDF parity be defined as semantic content parity only, or also require layout/font fidelity thresholds before production cutover?
