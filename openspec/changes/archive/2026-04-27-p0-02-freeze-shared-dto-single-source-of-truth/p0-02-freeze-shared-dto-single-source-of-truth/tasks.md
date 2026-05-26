## 1. Shared Contract Governance

- [x] 1.1 Audit `backend/src/contracts/shared.ts`, `backend/src/contracts/api.ts`, and `backend/src/contracts/responses.ts` for any DTO semantics that are defined outside the canonical shared contract.
- [x] 1.2 Refactor contract exports so shared transport DTO meanings are defined only in `backend/src/contracts/shared.ts`, with other contract files acting only as pass-through surfaces.
- [x] 1.3 Add or update repository guidance documenting that new shared transport fields must be introduced through `backend/src/contracts/shared.ts` before downstream implementation changes.

## 2. Frontend Consumption Boundary

- [x] 2.1 Audit frontend runtime and feature code for DTO-to-UI transformations outside centralized gateway, client, or facade layers.
- [x] 2.2 Consolidate any out-of-boundary protocol mapping into approved transport-boundary modules such as `frontend/src/runtime/aiAppFacade.ts` or related gateway/client layers.
- [x] 2.3 Verify page and feature code consume stabilized frontend models without introducing parallel field aliases or protocol branching.

## 3. Verification And Migration Guardrails

- [x] 3.1 Add or update documentation that defines the gateway/facade mapping boundary and forbids page-level parallel DTO semantics.
- [x] 3.2 Add regression checks or targeted tests that prove shared DTO consumers still work after contract export cleanup and mapping-boundary consolidation.
- [x] 3.3 Run relevant lint, typecheck, and test commands to confirm the single-source DTO rule does not break existing frontend-backend integration paths.
