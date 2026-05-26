## ADDED Requirements

### Requirement: Python Backend MUST Coexist With The Current Repository Architecture
The system SHALL introduce the Python backend as a distinct service boundary that coexists with the current frontend and TypeScript prototype backend without forcing an immediate end-to-end migration, and the coexistence model MUST support staged capability ownership for the first migration batch.

#### Scenario: Adding the Python backend to the repository
- **WHEN** the Python backend skeleton is created
- **THEN** it MUST live in a clearly distinct repository area with its own runtime entrypoints, dependency definition, and service documentation

#### Scenario: Preserving current demo flows
- **WHEN** the Python backend skeleton is added
- **THEN** existing frontend demonstration flows and current TypeScript prototype behavior MUST remain runnable without requiring the Python backend to already implement all business APIs

#### Scenario: Introducing first-batch staged coexistence
- **WHEN** the first Python migration wave begins implementation
- **THEN** coexistence planning MUST allow rules service, import service, report generation, PDF export, email delivery, and async execution to move independently without requiring a repo-wide backend switch

### Requirement: New Heavy Production Backend Work MUST Target The Python Service Boundary
The system MUST treat the Python backend skeleton as the default entry point for future heavy production backend capabilities that exceed the intended scope of the TypeScript prototype backend, and first-batch migration work MUST attach those capabilities to explicit Python ownership before cutover begins.

#### Scenario: Planning a new production-grade backend capability
- **WHEN** engineering schedules new heavy backend work such as rules execution, async delivery, formal persistence, or LangGraph orchestration
- **THEN** that work MUST attach to the Python backend service boundary rather than expanding the TypeScript prototype backend as the default implementation path

#### Scenario: Reviewing a migration-scoped implementation
- **WHEN** a proposed backend change introduces production-oriented infrastructure or long-lived service responsibilities
- **THEN** the implementation review MUST confirm whether the change belongs in the Python backend boundary and document any exception explicitly

#### Scenario: Assigning first-batch migration ownership
- **WHEN** first-batch migration planning covers rules, import, report generation, PDF export, email delivery, or async execution
- **THEN** the plan MUST mark Python as the destination ownership boundary even if the TypeScript implementation remains the active runtime path during coexistence

### Requirement: Python Backend MUST Align With Shared Contracts And Formal Persistence Governance
The system SHALL position the Python backend skeleton to integrate with shared DTO governance and formal persistence governance without redefining those contracts inside the skeleton change, and staged capability cutover MUST preserve those upstream governance boundaries.

#### Scenario: Referencing shared transport or persistence models
- **WHEN** the Python backend prepares to consume workflow DTOs or formal persistence tables
- **THEN** the implementation MUST treat the existing shared contract and persistence governance artifacts as upstream constraints rather than inventing a conflicting local source of truth

#### Scenario: Deferring full business integration
- **WHEN** the Python backend skeleton is introduced before full repository migration
- **THEN** it MAY use placeholders or adapter boundaries for future DTO and persistence integration, provided those placeholders preserve the existing governance direction

#### Scenario: Cutting over a first-batch capability
- **WHEN** a first-batch capability shifts runtime ownership from TypeScript to Python
- **THEN** the cutover MUST preserve shared DTO semantics, formal persistence direction, and rollback compatibility with the coexistence model
