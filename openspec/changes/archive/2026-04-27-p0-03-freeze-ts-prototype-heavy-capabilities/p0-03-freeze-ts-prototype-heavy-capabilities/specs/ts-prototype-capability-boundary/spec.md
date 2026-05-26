## ADDED Requirements

### Requirement: TypeScript Prototype Backend Freeze Boundary
The system SHALL define the TypeScript prototype backend as a maintenance-only runtime for existing capabilities, allowing defect fixes and necessary stabilization work while prohibiting new heavy production capabilities from being implemented there.

#### Scenario: Evaluating a change against the TS backend boundary
- **WHEN** a team evaluates a proposed backend change for the TypeScript prototype
- **THEN** the change MUST be classified as either existing-capability maintenance or a new heavy production capability before implementation planning proceeds

#### Scenario: Continuing maintenance on an existing TS capability
- **WHEN** a change fixes defects, tightens stability, or completes minimal remediation for an already existing TypeScript backend capability
- **THEN** the work MAY proceed within the TS prototype boundary without being treated as a violation of the freeze rule

### Requirement: New Heavy Production Capabilities Are Prohibited in TS
The system MUST NOT schedule or implement new heavy production capabilities in the TypeScript prototype backend, including import expansion, report generation expansion, formal PDF capability, production email delivery, async task orchestration, or comparable backend-heavy production features.

#### Scenario: Proposing a new heavy backend feature in TS
- **WHEN** a roadmap item or implementation proposal introduces a new heavy production backend capability for the TypeScript prototype
- **THEN** the proposal MUST be rejected from the TS implementation lane and redirected to the Python target-stack intake path

#### Scenario: Reviewing a borderline TS backend enhancement
- **WHEN** a proposed TS backend change adds substantial new workflow responsibility rather than maintaining an existing behavior
- **THEN** the review outcome MUST treat it as a prohibited new heavy production capability unless it is explicitly narrowed back to maintenance-only scope
