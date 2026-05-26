## ADDED Requirements

### Requirement: Current Implementation, Prototype Boundary, Target Stack, and Migration Window Must Be Distinguished
The documentation set SHALL explicitly distinguish four separate truth layers: current implemented state, TypeScript prototype boundary, Python target-stack target, and migration-window guidance.

#### Scenario: Reading a current-state planning document
- **WHEN** a contributor opens a canonical planning document for implementation kickoff
- **THEN** the document MUST identify which statements describe already-landed implementation state
- **AND** it MUST identify which statements describe temporary TypeScript prototype boundaries
- **AND** it MUST identify which statements describe Python target-stack planning
- **AND** it MUST identify which statements describe migration-window guidance

#### Scenario: Reading a target-state architecture document
- **WHEN** a contributor opens a target-state architecture document
- **THEN** the document MUST state that it describes the intended production architecture rather than the currently implemented stack

### Requirement: Documentation Reference Order Must Be Fixed for Planning and Implementation
The documentation set SHALL define a canonical reference order for planning and implementation so contributors begin with current-state truth before consulting directional architecture documents.

#### Scenario: Starting a new implementation slice
- **WHEN** a contributor prepares a new implementation or planning decision
- **THEN** the contributor-facing documentation MUST direct them to read `docs/ai-executable-backlog.md` before older directional architecture documents
- **AND** it MUST place `docs/project-sync-status.md` ahead of target-state and migration documents in the default order

#### Scenario: Consulting deeper technical design references
- **WHEN** a contributor needs target-state or migration guidance after checking current-state references
- **THEN** the documentation MUST direct them to consult target-state architecture and migration documents only as secondary references for destination and transition decisions

### Requirement: Historical Direction Documents Must Not Be Misrepresented as Current Runtime Truth
The documentation set MUST prevent historical or directional documents from being interpreted as the source of truth for current runtime status.

#### Scenario: A document contains historical architecture direction
- **WHEN** a document primarily describes a historical direction, target production architecture, or migration strategy
- **THEN** the document MUST include an explicit boundary note that it is not the authoritative source for current implementation completion status

#### Scenario: A planning discussion cites a directional document
- **WHEN** a planning or review artifact references a directional architecture document for a current-state claim
- **THEN** the surrounding documentation MUST provide a path back to the canonical current-state references for verification
