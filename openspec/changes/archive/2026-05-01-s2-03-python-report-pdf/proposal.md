## Why

The TS prototype backend cannot efficiently handle heavy capabilities like report generation and PDF export. Python's ecosystem provides better libraries for PDF rendering, async task processing, and resource-intensive operations. This migration moves report generation and PDF export to the Python target stack to improve performance, maintainability, and deployment stability.

## What Changes

- Migrate daily report, weekly report, and other report generation logic from TS to Python
- Implement PDF export API in Python backend with proper font and layout support
- Resolve deployment environment constraints (fonts, dependencies, resource limits)
- Establish stable API contract between frontend/gateway and Python report service
- Maintain audit continuity for report generation operations (operator, timestamp, runId)

## Capabilities

### New Capabilities
- `report-generation`: Generate daily, weekly, and custom reports with configurable templates and data aggregation
- `pdf-export`: Export reports and documents to PDF with proper Chinese font support, layout control, and deployment environment compatibility

### Modified Capabilities
<!-- No existing capabilities are being modified at the spec level -->

## Impact

- **Backend**: New Python endpoints for report generation and PDF export
- **Frontend/Gateway**: API integration changes to call Python services instead of TS endpoints
- **Dependencies**: Python PDF libraries (e.g., ReportLab, WeasyPrint), font files, async task queue
- **Deployment**: Environment setup for fonts, PDF rendering dependencies
- **Audit**: Report generation audit logs must maintain continuity across migration
- **Migration**: Follows M-01 (single DTO), M-03 (audit continuity), M-04 (phased traffic switching)
