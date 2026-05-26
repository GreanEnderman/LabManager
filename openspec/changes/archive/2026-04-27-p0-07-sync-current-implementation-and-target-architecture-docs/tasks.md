## 1. Sync current-state source documents

- [x] 1.1 Update `docs/ai-executable-backlog.md` to distinguish current implementation state, TS prototype boundary, Python target-stack planning, and migration-window guidance.
- [x] 1.2 Update `docs/project-sync-status.md` to restate the canonical documentation reference order and reinforce which files are the current-state source of truth.
- [x] 1.3 Cross-link current-state documents to the existing TS prototype boundary and Python intake governance docs where planning decisions are discussed.

## 2. Label directional architecture documents

- [x] 2.1 Update `docs/final-production-architecture.md` with an explicit top-level boundary note that it describes the intended production architecture rather than current implementation status.
- [x] 2.2 Update `docs/stack-migration-roadmap.md` with an explicit migration-window boundary note and clarify that it is not the source of truth for what is already landed.
- [x] 2.3 Review adjacent architecture/reference docs for mixed statements and add short boundary cues where they still blur current state and target state.

## 3. Verify planning clarity

- [x] 3.1 Check that a contributor can identify the default reading order from the updated documentation without consulting tribal knowledge.
- [x] 3.2 Check that each updated document clearly answers whether it describes current implementation, TS prototype limits, Python target state, or migration guidance.
- [x] 3.3 Record the documentation sync outcome in the change summary or linked notes so future implementation kickoff can verify the governance rule quickly.
