## Context

The repository already contains the right raw material for accurate planning, but those documents sit at different truth layers. `docs/ai-executable-backlog.md` and `docs/project-sync-status.md` describe what is currently implemented or currently planned, while `docs/final-production-architecture.md` and `docs/stack-migration-roadmap.md` describe the intended production destination and migration path. The current failure mode is not missing information; it is weak boundary labeling and an unstable default reading order that lets target-state documents be mistaken for current implementation facts.

This is a cross-cutting documentation governance change because it affects backlog interpretation, architecture review, and implementation kickoff across frontend, TS prototype backend, and Python target-stack planning.

## Goals / Non-Goals

**Goals:**
- Establish one documentation contract that separates current implementation truth, TS prototype boundary, Python target-stack target, and migration-window guidance.
- Fix the default reading order so engineers start from current-state documents before consulting directional architecture documents.
- Make historical and target-state documents self-identifying so they cannot be mistaken for current runtime status during planning.
- Keep the change parallel-safe with other P0 work by limiting scope to documentation and planning governance.

**Non-Goals:**
- No runtime code changes or data model changes.
- No attempt to rewrite the long-term Python target architecture itself.
- No removal of historical architecture documents that still carry useful direction.
- No change to existing OpenSpec governance for TS/Python implementation boundaries beyond clarifying how those rules are surfaced in docs.

## Decisions

### Decision: Introduce a dedicated documentation governance capability
Use a new capability instead of overloading existing TS/Python boundary specs.

Rationale:
- Existing specs such as `ts-prototype-capability-boundary` and `python-heavy-capability-intake` govern implementation scope, not how documents present truth layers.
- The core problem is documentation interpretation and precedence, so a dedicated governance spec keeps the rule set focused and reusable.

Alternative considered:
- Modify the existing TS/Python boundary specs to carry documentation rules.
- Rejected because it would couple implementation-lane policy with documentation-shape rules and make future archive history harder to read.

### Decision: Treat `ai-executable-backlog` and `project-sync-status` as current-state sources of truth
Current-state and near-term planning docs should be the first references for implementation kickoff.

Rationale:
- These documents already summarize landed work, remaining backlog, and known sync gaps.
- They are closer to execution truth than target architecture and migration planning documents.

Alternative considered:
- Keep all architecture and planning documents as equal references.
- Rejected because equal precedence is exactly what allows stale or directional docs to override current reality in practice.

### Decision: Require target-state and migration docs to self-label their boundary
Target-state and migration documents should explicitly announce that they describe the production destination or migration window, not the current implemented stack.

Rationale:
- A clear header-level boundary reduces misreads even when a contributor opens a directional doc first.
- This preserves useful historical context without letting it masquerade as current truth.

Alternative considered:
- Rely on team habit and tribal knowledge.
- Rejected because the current confusion shows that implicit knowledge is not durable enough.

### Decision: Prefer additive clarification over document deletion
Update and annotate existing docs rather than removing them.

Rationale:
- The repository still needs target-state and migration artifacts for planning Python work.
- Additive edits are lower risk and easier to review than removing long-lived documents.

Alternative considered:
- Delete or archive older direction documents from active references.
- Rejected because the direction is still valid; the problem is labeling and precedence, not the existence of those docs.

## Risks / Trade-offs

- [Risk] Contributors may continue opening old architecture docs first out of habit. -> Mitigation: put the canonical reference order in the backlog and sync documents, and add explicit scope disclaimers to target-state docs.
- [Risk] Documentation duplication could increase if every file repeats too much context. -> Mitigation: standardize a short boundary section and reference the canonical current-state docs instead of duplicating status details everywhere.
- [Risk] Existing implementation-lane governance could still be misread if not cross-linked. -> Mitigation: cross-reference TS prototype boundary and Python intake governance from the synced docs where planning decisions are made.

## Migration Plan

1. Update the current-state planning documents to declare the canonical reference order and summarize the four truth layers.
2. Add boundary labels to target-state and migration documents so they declare their purpose and non-purpose at the top.
3. Cross-link the synced documentation set to the existing TS prototype and Python target-stack governance specs.
4. Verify the updated doc set can answer four questions unambiguously: what is implemented now, what TS can still own, what belongs to Python, and which doc to read first.

Rollback strategy:
- Revert the document edits if wording proves misleading; no data or runtime rollback is needed.

## Open Questions

- Whether `AGENTS.md` should also receive a short pointer that its phase narrative is subordinate to `docs/ai-executable-backlog.md` and `docs/project-sync-status.md` for current implementation truth.
- Whether a dedicated "documentation boundary" checklist should be added to future architecture docs, or whether the governance language in the synced docs is sufficient.
