## Purpose

Define where frontend code may consume shared DTOs and where DTO-to-UI mapping is allowed to occur.

## Requirements

### Requirement: Frontend DTO Mapping Boundary
The frontend SHALL consume shared DTOs only through centralized transport-boundary modules such as gateway, facade, or client mapping layers, and page-level or feature-level code MUST NOT define competing protocol semantics.

#### Scenario: Mapping DTOs for UI consumption
- **WHEN** frontend code needs to transform a shared DTO into a UI-facing model
- **THEN** that transformation MUST occur in a centralized gateway, facade, or client mapping module

#### Scenario: Rendering data in page components
- **WHEN** a page, hook, or feature component reads AI task, approval, event, or report data
- **THEN** it MUST consume the stabilized frontend model exposed by the mapping boundary instead of branching on raw DTO protocol variants

### Requirement: Contract-First Frontend Adoption
The frontend MUST adopt new shared transport fields through a contract-first flow that updates `backend/src/contracts/shared.ts` first, then updates mapping boundaries, then updates downstream UI consumers.

#### Scenario: Introducing a new DTO field used by the frontend
- **WHEN** a frontend feature requires a newly exposed transport field
- **THEN** the implementation MUST first add the field to `backend/src/contracts/shared.ts`, then update the gateway or facade mapper, and only then update feature consumers

#### Scenario: Preventing page-level protocol drift
- **WHEN** a frontend change needs data that is not present in the current UI-facing model
- **THEN** the change MUST extend the centralized mapping boundary rather than adding ad hoc field aliases or duplicate semantics in page code
