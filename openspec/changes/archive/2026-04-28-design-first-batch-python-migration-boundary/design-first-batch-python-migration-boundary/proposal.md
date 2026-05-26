## Why

The repository has already established that new heavy production backend capabilities should move into the Python target stack, and the Python backend foundation has been created as a separate service boundary. What is still missing is a concrete first-batch migration contract that defines which capabilities move first, how they map to the existing TypeScript implementation, and how rollout and rollback are controlled before implementation begins.

## What Changes

- Define the first-batch Python migration boundary for rules service, import service, report generation, PDF export, email delivery, and async job execution.
- Establish per-capability input and output contracts so migration work can start from explicit service boundaries rather than implementation guesswork.
- Document the comparison relationship between each Python target capability and the current TypeScript implementation surface.
- Define migration sequencing, traffic cutover order, and rollback rules for the first migration wave.
- Keep shared DTO governance and current demo-flow coexistence intact while the migration boundary is introduced.

## Capabilities

### New Capabilities
- `first-batch-python-capability-migration-plan`: Defines the first migration-wave capability set, per-capability contracts, dependency ordering, cutover order, and rollback expectations.
- `ts-python-capability-parity-boundary`: Defines how first-batch Python capabilities map to current TypeScript implementation surfaces and how parity is evaluated before traffic moves.

### Modified Capabilities
- `python-backend-coexistence-boundary`: Extends the coexistence rules with explicit first-batch migration ownership and staged cutover expectations.

## Impact

- Affected planning artifacts: migration backlog, rollout sequencing, and implementation entry criteria for Python-backed services.
- Affected systems: current TypeScript backend, `python_backend/`, shared DTO usage, async execution, report/PDF delivery, and migration verification flows.
- Affected code areas for later implementation: `backend/src/`, `python_backend/`, contract surfaces, report and import pipelines, async workers, and delivery adapters.
