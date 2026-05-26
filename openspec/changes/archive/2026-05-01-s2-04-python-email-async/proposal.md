## Why

TS prototype backend currently handles report email delivery, failure handling, and background task orchestration. As part of the migration strategy (M-02, M-04), heavy capabilities like email delivery and async task processing should move to Python backend to position TS as reference-only and enable Python to handle production workloads.

## What Changes

- Python backend gains email delivery capability (manual send, scheduled send)
- Send record tracking and failure retry mechanism
- Background task chain orchestration (report generation → email delivery)
- Frontend switches to Python email API endpoints
- TS prototype email delivery becomes fallback only

## Capabilities

### New Capabilities
- `email-delivery`: Email sending service with SMTP integration, template rendering, attachment support
- `async-task-orchestration`: Background task queue and chain execution for report generation and delivery workflows
- `delivery-audit`: Send record tracking, status monitoring, failure retry logic

### Modified Capabilities
<!-- No existing spec requirements are changing - this is net-new capability migration -->

## Impact

- Python backend: New email service, task queue, delivery audit modules
- Frontend: Email send UI switches from TS endpoints to Python endpoints
- TS backend: Email delivery marked as deprecated, kept as fallback during migration
- Dependencies: Requires S2-03 (report generation) and S1-07 (audit logging) to be complete
- Infrastructure: May need email service configuration (SMTP credentials, queue backend)
