## Purpose

Define the default intake rule for new heavy production capabilities so they enter the Python target-stack design and backlog lane instead of expanding the TypeScript prototype backend.

## Requirements

### Requirement: Python Target-Stack Default Intake for Heavy Capabilities
The system SHALL treat every new heavy production capability as a Python target-stack design and backlog item by default instead of assigning it to the TypeScript prototype backend.

#### Scenario: Intake for a new heavy production capability
- **WHEN** product, engineering, or remediation planning identifies a new heavy production capability
- **THEN** the capability MUST be recorded in Python target-stack design or backlog artifacts rather than placed into a TypeScript implementation plan

#### Scenario: Dependency on an unfinished Python implementation
- **WHEN** a heavy production capability is needed before the Python target stack has fully implemented it
- **THEN** planning MUST keep the capability in the Python intake lane and MUST NOT use TypeScript implementation as the default shortcut

### Requirement: Scheduling and Review Must Enforce the Intake Boundary
The system MUST ensure backlog grooming, remediation planning, and implementation review use a consistent rule that new heavy production capabilities do not enter the TypeScript schedule and instead remain aligned with Python migration planning.

#### Scenario: Building an iteration plan
- **WHEN** engineering scheduling or remediation planning assigns work for a future iteration
- **THEN** any new heavy production capability MUST be excluded from TypeScript implementation scope and linked to Python target-stack planning or backlog instead

#### Scenario: Documenting a heavy capability decision
- **WHEN** a new heavy production capability is accepted for future work
- **THEN** the planning record MUST state that the capability belongs to the Python target stack and that the TypeScript prototype remains out of scope for primary implementation
