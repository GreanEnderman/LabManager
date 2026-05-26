## Context

The repository already exposes shared DTO definitions from `backend/src/contracts/shared.ts`, and frontend runtime layers such as `frontend/src/runtime/aiAppFacade.ts` and `frontend/src/runtime/aiAppClient.ts` already import those types directly. At the same time, the production remediation backlog requires the project to stop treating multiple field shapes as acceptable during dual-stack migration.

This change is cross-cutting because it affects backend contract ownership, frontend mapping boundaries, and the rules for all new API work. The design therefore needs to establish a clear protocol source, define where translation is still allowed, and prevent future drift while the TypeScript stack remains in service and migration planning continues.

## Goals / Non-Goals

**Goals:**
- Make `backend/src/contracts/shared.ts` the single authoritative DTO definition file for shared request and response payload semantics.
- Keep frontend transformation logic centralized in gateway or facade layers, with pages and feature components consuming app-facing models rather than ad hoc DTO variants.
- Define a reviewable extension path for adding or changing DTO fields so new interfaces do not create parallel field semantics.
- Preserve current behavior while tightening contract ownership and migration discipline.

**Non-Goals:**
- Replacing frontend view models such as `AITask` or `AIReport` with raw DTOs everywhere in the UI.
- Reworking all backend domain models or persistence structures to exactly mirror transport DTOs.
- Completing the broader dual-stack migration or introducing Python-side generated contracts in this change.
- Redesigning business workflows unrelated to contract governance.

## Decisions

### 1. `backend/src/contracts/shared.ts` remains the only DTO source of truth

All shared transport field semantics will be defined in `backend/src/contracts/shared.ts`, with `api.ts` and `responses.ts` acting only as re-export or grouping surfaces. New API contracts must either reference existing DTOs from `shared.ts` or add fields there first.

Rationale:
- The file already contains the core AI DTO shapes and is consumed by both stacks today.
- Keeping one canonical definition reduces migration ambiguity and makes review of protocol changes straightforward.
- Re-export files remain useful for ergonomics, but they should not become alternate places to redefine payload meaning.

Alternatives considered:
- Split DTOs across per-feature contract files. Rejected because it weakens the “single truth” rule and makes drift easier during migration.
- Allow route-local response DTOs outside `shared.ts`. Rejected because it recreates the parallel semantics this remediation item is meant to stop.

### 2. Frontend mapping is allowed only at gateway or facade boundaries

Frontend code may adapt shared DTOs into UI-facing records, but that adaptation must stay in centralized transport-boundary modules such as gateway, app client, or facade layers. Page components, hooks, and feature modules should consume stabilized frontend models rather than inventing alternative protocol fields.

Rationale:
- The current runtime structure already has `aiAppFacade` and `aiAppClient` functions like `mapTask`, `mapApproval`, and `mapEvent`, which provides a natural containment boundary.
- This keeps protocol translation auditable and prevents field-shape branching from leaking into presentation code.
- The boundary still supports UI ergonomics without sacrificing shared contract discipline.

Alternatives considered:
- Ban all frontend mapping and use DTOs directly in UI state. Rejected because the existing app-facing models capture presentation concerns and would make UI code less stable.
- Permit page-level adaptation whenever needed. Rejected because it spreads protocol logic and makes migration regressions difficult to detect.

### 3. New interface changes must follow a contract-first update path

When adding a new field or endpoint, the change sequence will be: update `shared.ts`, update gateway/facade mapping if needed, then update downstream consumers. Reviews should treat any new transport fields defined outside this path as a contract violation.

Rationale:
- A contract-first flow aligns frontend and backend updates and makes migration intent explicit.
- It creates a predictable place to document breaking versus non-breaking changes.
- It keeps future API work compatible with a single DTO governance model.

Alternatives considered:
- Let implementation code introduce temporary fields and normalize later. Rejected because “temporary” protocol drift tends to become permanent.

### 4. Migration enforcement is documentation-first, then code cleanup

This change will first establish the formal rules in OpenSpec and supporting documentation, then use follow-on implementation work to align any outliers in code. The design does not assume every duplicate semantic is removed in the same step, but it does require all new work to follow the rule immediately.

Rationale:
- The repo already partially follows the target pattern, so the immediate need is governance clarity rather than a large refactor.
- A staged approach reduces risk while still unblocking dependent remediation items.

Alternatives considered:
- Mandate a repo-wide DTO refactor as part of this artifact set. Rejected because it couples governance definition to a larger implementation effort than the backlog item requires.

## Risks / Trade-offs

- [Existing code may still contain scattered semantic duplication outside the obvious runtime layers] -> Mitigation: use subsequent specs and tasks to identify cleanup targets and define review gates for new changes.
- [Keeping frontend view models distinct from DTOs can be misread as allowing alternate contract meaning] -> Mitigation: document that mapping may rename or reshape for UI ergonomics, but must not invent competing transport semantics.
- [Developers may add convenience DTOs in `api.ts` or `responses.ts` because those files already re-export types] -> Mitigation: make those files pass-through surfaces only and call out the rule explicitly in specs and review guidance.
- [Future Python-side migration work may need generated or mirrored contract artifacts] -> Mitigation: require any generated surfaces to derive from the canonical shared contract, not replace it.
