## Why

The repository already has shared backend contracts, but the production remediation backlog makes it explicit that the project cannot continue dual-stack migration with multiple DTO truths or parallel field semantics. This change is needed now to freeze `backend/src/contracts/shared.ts` as the single protocol source before more APIs, frontend adapters, or migration work drift further apart.

## What Changes

- Establish `backend/src/contracts/shared.ts` as the authoritative DTO source for frontend and backend integration.
- Define a formal frontend consumption rule so page and feature code do not introduce parallel field semantics outside a gateway or facade boundary.
- Require new interfaces and API expansions to reuse shared DTO semantics instead of inventing duplicate field contracts.
- Document the migration-facing contract boundary for current TypeScript code and future dual-stack integration work.

## Capabilities

### New Capabilities
- `shared-dto-governance`: Defines the single-source DTO contract, ownership rules, and allowed extension path for shared API payloads.
- `frontend-dto-consumption-boundary`: Defines how frontend code consumes shared DTOs through centralized mapping boundaries without page-level protocol branching.

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->

## Impact

- Affected code: `backend/src/contracts/shared.ts`, frontend gateway or facade mapping layers, and any API contract definitions that currently duplicate DTO semantics.
- Affected systems: frontend-backend integration, remediation backlog execution, and dual-stack migration planning.
- Dependencies: aligns with backlog item `P0-01` and unblocks later remediation and migration work that assumes a single DTO truth.
