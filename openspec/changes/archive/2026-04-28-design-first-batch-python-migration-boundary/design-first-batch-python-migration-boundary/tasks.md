## 1. Freeze first-batch migration contracts

- [x] 1.1 Inventory the canonical shared DTOs already covering rules, import, reports, PDF export, report delivery, and async-related execution inputs/outputs.
- [x] 1.2 Document the first-batch capability list and per-capability contract ownership in Python-facing migration notes under `python_backend/` or adjacent docs.
- [x] 1.3 Record the TypeScript reference surface for each first-batch capability, including rules, import, report generation, PDF export, and email delivery services.

## 2. Define staged cutover and rollback boundaries

- [x] 2.1 Design capability-level routing or feature-toggle boundaries so one capability can move to Python without forcing a full backend switch.
- [x] 2.2 Define the dependency-aware migration order: async execution foundation, rules, import, report generation, PDF export, then email delivery.
- [x] 2.3 Write per-capability rollback expectations that restore the TypeScript runtime path without introducing DTO drift.

## 3. Prepare implementation entry criteria

- [x] 3.1 Define parity verification criteria for each first-batch capability against its mapped TypeScript reference implementation.
- [x] 3.2 Capture runtime-specific parity concerns for PDF rendering, email delivery side effects, audit logging, and background execution behavior.
- [x] 3.3 Translate the migration boundary into implementation-ready backlog items for the first Python service slices.
