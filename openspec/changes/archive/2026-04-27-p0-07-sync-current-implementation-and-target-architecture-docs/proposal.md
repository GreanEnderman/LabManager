## Why

Current architecture and planning documents mix three different layers of truth: the already-landed TypeScript prototype, the temporary migration window, and the long-term Python production target. This causes planning and implementation decisions to drift because historical direction documents are still easy to misread as current runtime reality.

## What Changes

- Define a documentation governance capability that requires architecture and backlog artifacts to clearly label current implementation state, TS prototype boundaries, Python target-stack planning, and migration-window guidance.
- Fix the default reference order teams should use when planning or implementing new work so current-state docs win over older directional documents.
- Require historical or target-state architecture documents to explicitly declare that they are not the source of truth for current implementation status.
- Align backlog and sync documents so "already implemented", "prototype-only", and "target production" statements no longer appear in the same layer without boundary labels.

## Capabilities

### New Capabilities
- `architecture-documentation-governance`: Defines how architecture and backlog documents distinguish current implementation truth, TS prototype limits, Python target-stack intent, migration-window guidance, and default reading order.

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->

## Impact

- Affected docs: `docs/ai-executable-backlog.md`, `docs/project-sync-status.md`, `docs/final-production-architecture.md`, `docs/stack-migration-roadmap.md`, and related architecture/reference documents.
- Affected workflow: planning, architecture review, backlog grooming, and implementation kickoff now follow a fixed documentation precedence order.
- Affected systems: no runtime behavior change, but this becomes the governance layer that prevents future TS/Python scope confusion and mis-scoped implementation work.
