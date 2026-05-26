# Frontend AI Runtime Boundary

## Goal

Freeze the production runtime path for the frontend AI workflow and stop treating legacy mock state as a real execution path.

## Runtime rule

- Production builds must use `VITE_AI_GATEWAY_MODE=http`.
- Pre-release / staging builds must use `VITE_AI_GATEWAY_MODE=http`.
- The live runtime entry is `frontend/src/ai/AIStateLive.tsx`.
- The live gateway selection happens in `frontend/src/runtime/getAiGateway.ts`.
- New frontend AI features must extend the runtime facade / gateway path, not the legacy in-memory mock providers.

## Legacy demo-only modules

The following modules are retained only for demo/history/reference purposes:

- `frontend/src/ai/AIContext.tsx`
- `frontend/src/ai/AIStateContext.tsx`
- `frontend/src/ai/AISettingsContext.tsx`

These files must not be used as the production or pre-release source of truth.

## Required extension path for new work

When adding a new AI capability:

1. Add or extend DTO/contracts in the shared backend contract layer when needed.
2. Extend `frontend/src/runtime/aiGateway.ts`.
3. Implement the behavior in the HTTP gateway and facade layer.
4. Expose the live state/action through `AIStateLive` or the runtime live providers actually mounted in `frontend/src/main.tsx`.

## Shared DTO boundary

- `backend/src/contracts/shared.ts` is the only canonical source for shared transport DTO semantics.
- Direct imports from `backend/src/contracts/shared.ts` are allowed only in centralized runtime transport-boundary modules under `frontend/src/runtime/`.
- Pages, hooks, and feature modules must consume mapped frontend models instead of raw shared DTOs.
- Detailed repository-wide rules live in `docs/shared-dto-contract-boundary.md`.

## Guardrails in repo

- `frontend/.env.production` pins `VITE_AI_GATEWAY_MODE=http`.
- `frontend/.env.staging` pins `VITE_AI_GATEWAY_MODE=http`.
- `frontend/src/runtime/getAiGateway.ts` only resolves the live frontend to `httpAiGateway` and rejects any non-HTTP mode configuration.
