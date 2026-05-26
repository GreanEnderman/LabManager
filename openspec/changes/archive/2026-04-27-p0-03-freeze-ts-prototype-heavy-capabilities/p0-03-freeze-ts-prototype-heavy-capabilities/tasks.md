## 1. Freeze TS Prototype Capability Boundary

- [x] 1.1 Audit current remediation, migration, and architecture documents to identify every place where the TypeScript backend is still described as a valid destination for new heavy production capabilities.
- [x] 1.2 Add or update the primary boundary document so it explicitly states that the TypeScript backend only maintains existing capabilities and does not accept new heavy production capabilities.
- [x] 1.3 Define review guidance that distinguishes allowed TS maintenance work from prohibited new heavy production work, using representative examples such as import, report, PDF, email, and async-task expansion.

## 2. Redirect Heavy Capability Intake To Python

- [x] 2.1 Update backlog or planning guidance so every new heavy production capability defaults into Python target-stack design and backlog instead of TypeScript implementation scope.
- [x] 2.2 Add or update the migration-facing documentation that explains why Python is the default target for new heavy capabilities even when TS still hosts existing transitional behavior.
- [x] 2.3 Review any near-term scheduled work items related to heavy backend capability expansion and move or relabel them so they no longer imply primary TS implementation ownership.

## 3. Verify Governance Alignment

- [x] 3.1 Cross-check this change against `P0-02` artifacts to ensure the capability boundary guidance does not conflict with the single-source DTO governance rule.
- [x] 3.2 Validate that the written boundary, Python intake rule, and scheduling guidance all use the same terminology for “new heavy production capability” and “maintenance-only TS backend”.
- [x] 3.3 Run the relevant document/spec verification workflow and confirm the repository now has a single, reviewable rule for TS freeze scope and Python heavy-capability intake.
