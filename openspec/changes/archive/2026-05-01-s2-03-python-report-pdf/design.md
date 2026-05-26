## Context

Currently, report generation and PDF export are handled by the TS prototype backend. This includes daily reports, weekly reports, and ad-hoc report generation with PDF output. The TS implementation faces limitations in PDF rendering quality, Chinese font support, and resource-intensive operations.

The Python target stack provides mature libraries (ReportLab, WeasyPrint) and better async task handling for these heavy operations. This design migrates report generation and PDF export to Python while maintaining API compatibility and audit continuity.

Dependencies S1-01 (Python 基础架构与数据访问层) and S1-07 (Python 承接规则引擎与业务逻辑) provide the foundation for data access and business logic needed by report generation.

## Goals / Non-Goals

**Goals:**
- Migrate report generation logic (daily, weekly, custom reports) to Python
- Implement stable PDF export API with Chinese font support
- Resolve deployment environment constraints (fonts, dependencies)
- Maintain audit continuity (operator, timestamp, runId) across migration
- Follow M-01 (single DTO), M-03 (audit continuity), M-04 (phased traffic switching)

**Non-Goals:**
- Changing report data schemas or frontend UI
- Migrating other TS capabilities beyond reports and PDF
- Real-time report streaming (async generation is sufficient)

## Decisions

### D1: PDF Library Choice - WeasyPrint

**Decision:** Use WeasyPrint for PDF generation instead of ReportLab.

**Rationale:** WeasyPrint renders HTML/CSS to PDF, allowing template-based report design that's easier to maintain than ReportLab's programmatic approach. It handles Chinese fonts well and supports modern CSS layout.

**Alternatives Considered:**
- ReportLab: More control but requires programmatic layout, harder to maintain
- Playwright PDF: Heavier dependency, overkill for static reports

### D2: Async Task Queue for Report Generation

**Decision:** Use async task queue (Celery or similar) for report generation requests.

**Rationale:** Report generation can be slow (data aggregation, PDF rendering). Async processing prevents request timeouts and allows progress tracking.

**Alternatives Considered:**
- Synchronous generation: Simple but causes timeouts for large reports
- Background threads: Less robust than proper task queue

### D3: Font Bundling Strategy

**Decision:** Bundle required Chinese fonts (e.g., Noto Sans CJK) in Docker image, configure WeasyPrint font paths at startup.

**Rationale:** Ensures consistent rendering across environments. Avoids runtime font discovery issues.

**Alternatives Considered:**
- System fonts: Unreliable across deployment environments
- CDN fonts: Adds external dependency, slower

### D4: API Contract - Unified DTO

**Decision:** Python endpoints return same DTO structure as current TS endpoints. Gateway layer handles any adaptation if needed.

**Rationale:** Follows M-01 (Frontend Single DTO Rule). Frontend sees no breaking changes during migration.

## Risks / Trade-offs

**[Risk]** WeasyPrint rendering differs from TS PDF output → **Mitigation:** Visual regression testing, side-by-side comparison during dual-track phase

**[Risk]** Font licensing for bundled fonts → **Mitigation:** Use open-source fonts (Noto Sans CJK, SIL OFL license)

**[Risk]** Async task queue adds operational complexity → **Mitigation:** Start with simple in-process queue, upgrade to Celery only if needed

**[Risk]** Report generation audit logs may have gaps during migration → **Mitigation:** Dual-write audit logs during transition, reconcile before TS decommission (M-03)

**[Trade-off]** HTML/CSS templates are easier to maintain but less flexible than programmatic layout → **Acceptable:** Current reports don't need complex programmatic layouts
