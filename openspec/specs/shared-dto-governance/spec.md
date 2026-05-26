## Purpose

Define the canonical shared DTO contract boundary for backend APIs, frontend runtime adapters, and migration-facing integration work.

## Requirements

### Requirement: Shared DTO Canonical Source
The system SHALL define `backend/src/contracts/shared.ts` as the only canonical source for shared transport DTO semantics used across backend APIs, frontend integration layers, and migration-facing contract definitions.

#### Scenario: Adding a new shared transport field
- **WHEN** a developer needs to add or change a transport field used by more than one application boundary
- **THEN** the canonical field definition MUST be added or updated in `backend/src/contracts/shared.ts` before dependent code is changed

#### Scenario: Referencing shared DTOs from contract surfaces
- **WHEN** a backend contract surface such as `api.ts` or `responses.ts` exposes shared DTO types
- **THEN** it MUST reference or re-export definitions from `backend/src/contracts/shared.ts` rather than redefining payload semantics locally

### Requirement: No Parallel Field Semantics
The system MUST reject new API or integration contract work that introduces duplicate transport meanings through parallel field names, route-local DTO clones, or alternative canonical definitions outside `backend/src/contracts/shared.ts`.

#### Scenario: Reviewing a new endpoint contract
- **WHEN** a new endpoint, request shape, or response shape is introduced
- **THEN** the contract review MUST verify that its shared semantics reuse fields defined in `backend/src/contracts/shared.ts` instead of creating a competing DTO meaning elsewhere

#### Scenario: Extending an existing DTO
- **WHEN** an existing integration flow needs additional transport data
- **THEN** the shared DTO in `backend/src/contracts/shared.ts` MUST be extended and downstream consumers updated from that source rather than adding temporary parallel fields
