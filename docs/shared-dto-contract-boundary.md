# Shared DTO Contract Boundary

## Goal

Freeze `backend/src/contracts/shared.ts` as the single source of truth for shared transport DTO semantics across backend APIs, frontend runtime adapters, and migration-facing integration work.

## Canonical DTO Rule

- `backend/src/contracts/shared.ts` is the only file allowed to define shared request and response DTO semantics.
- `backend/src/contracts/api.ts` and `backend/src/contracts/responses.ts` are pass-through export surfaces only.
- New shared transport fields must be added to `backend/src/contracts/shared.ts` before any backend handler, frontend runtime adapter, or migration-facing consumer is updated.
- Route-local or feature-local DTO clones that redefine the same transport meaning are not allowed.

## Frontend Consumption Boundary

- Frontend modules may import shared DTOs only in centralized transport-boundary modules under `frontend/src/runtime/`.
- DTO-to-UI mapping must stay in gateway, client, or facade modules such as:
  - `frontend/src/runtime/aiGateway.ts`
  - `frontend/src/runtime/httpAiGateway.ts`
  - `frontend/src/runtime/aiAppClient.ts`
  - `frontend/src/runtime/aiAppFacade.ts`
  - `frontend/src/runtime/aiAppFacadeAsync.ts`
- Page components, hooks, and feature-level UI modules must consume stabilized frontend models and must not branch on raw DTO protocol variants.

## Required Change Sequence

1. Update `backend/src/contracts/shared.ts`.
2. Update runtime gateway or facade mapping code if UI-facing models need to change.
3. Update downstream backend consumers and frontend UI consumers.
4. Run DTO boundary verification and project lint/typecheck/build validation.

## Review Checklist

- Does the change introduce or modify shared transport fields only in `backend/src/contracts/shared.ts`?
- Do `api.ts` and `responses.ts` remain pass-through exports?
- Are all DTO imports outside backend contract files limited to approved runtime boundary modules?
- Are page-level and feature-level UI files free of shared DTO imports and protocol branching?
