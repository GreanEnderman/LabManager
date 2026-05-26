# Report Generation and PDF Export API

## Overview

Python backend implementation for report generation and PDF export capabilities, migrated from TS prototype backend.

## API Endpoints

### POST /api/reports/daily

Generate daily activity report asynchronously.

**Request:**
```json
{
  "date": "2026-05-01",
  "operator": "user@example.com"
}
```

**Response:**
```json
{
  "task_id": "uuid",
  "status": "pending"
}
```

### POST /api/reports/weekly

Generate weekly summary report asynchronously.

**Request:**
```json
{
  "start_date": "2026-04-24",
  "end_date": "2026-05-01",
  "operator": "user@example.com"
}
```

**Response:**
```json
{
  "task_id": "uuid",
  "status": "pending"
}
```

### GET /api/reports/tasks/{task_id}

Get status and result of async report generation task.

**Response:**
```json
{
  "task_id": "uuid",
  "status": "completed",
  "state": "SUCCESS",
  "ready": true,
  "successful": true,
  "result": {
    "date": "2026-05-01",
    "task_completions": 10,
    "approvals": 5,
    "metrics": {"activities": 25},
    "metadata": {
      "operator": "user@example.com",
      "timestamp": "2026-05-01T10:00:00",
      "run_id": "uuid"
    }
  }
}
```

### POST /api/pdf/export

Export HTML content or template to PDF.

**Request:**
```json
{
  "template_name": "daily_report.html",
  "context": {
    "date": "2026-05-01",
    "task_completions": 10,
    "approvals": 5,
    "activities": 25,
    "operator": "user@example.com",
    "timestamp": "2026-05-01T10:00:00",
    "run_id": "uuid"
  },
  "metadata": {
    "operator": "user@example.com",
    "run_id": "uuid"
  }
}
```

**Response:** PDF file (application/pdf)

## Migration Guide

### Phase 1: Deployment

1. Deploy Python backend with report and PDF capabilities
2. Verify endpoints are accessible
3. Keep feature flags disabled initially

### Phase 2: Testing

1. Run integration tests against Python endpoints
2. Compare PDF output with TS implementation
3. Verify audit log consistency

### Phase 3: Traffic Switching

1. Enable `ENABLE_PYTHON_REPORTS` flag in gateway
2. Monitor error rates and performance
3. Enable `ENABLE_PYTHON_PDF` flag
4. Gradually increase traffic percentage

### Phase 4: Validation

1. Run audit log reconciliation script
2. Verify all reports generate correctly
3. Check PDF rendering quality

### Phase 5: Decommission

1. After stable operation, disable TS report endpoints
2. Remove TS report generation code
3. Update documentation

## Rollback Procedure

If issues occur:

1. Set feature flags to `False` in `app/gateway/routing.py`
2. Restart gateway service
3. Traffic reverts to TS backend
4. Investigate and fix issues
5. Re-enable when ready

## Audit Continuity

All report generation operations include:
- `operator`: User who requested the report
- `timestamp`: Generation time (ISO 8601)
- `run_id`: Unique identifier for traceability

These fields are consistent with TS implementation (M-03).
