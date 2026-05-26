## 1. Setup and Dependencies

- [x] 1.1 Add WeasyPrint and async task queue dependencies to Python backend requirements
- [x] 1.2 Download and bundle Noto Sans CJK fonts in Python backend assets
- [x] 1.3 Create report generation module structure in Python backend
- [x] 1.4 Create PDF export module structure in Python backend
- [x] 1.5 Configure WeasyPrint font paths to use bundled fonts

## 2. Data Access Layer

- [x] 2.1 Implement data access functions for task completions query
- [x] 2.2 Implement data access functions for approval records query
- [x] 2.3 Implement data access functions for activity log metrics query
- [x] 2.4 Add error handling for missing or unavailable data sources

## 3. Report Generation Core

- [x] 3.1 Implement daily report data aggregation logic
- [x] 3.2 Implement weekly report data aggregation logic
- [x] 3.3 Create HTML/CSS templates for daily reports
- [x] 3.4 Create HTML/CSS templates for weekly reports
- [x] 3.5 Add audit metadata (operator, timestamp, runId) to report generation

## 4. Async Task Queue

- [x] 4.1 Set up async task queue (simple in-process queue or Celery)
- [x] 4.2 Implement async report generation task handler
- [x] 4.3 Implement task status tracking (pending, processing, completed, failed)
- [x] 4.4 Implement task result retrieval endpoint

## 5. PDF Export Implementation

- [x] 5.1 Implement WeasyPrint PDF rendering from HTML templates
- [x] 5.2 Configure PDF layout (margins, headers, footers, page breaks)
- [x] 5.3 Add Chinese font rendering with bundled Noto Sans CJK
- [x] 5.4 Include audit metadata in PDF headers/footers
- [x] 5.5 Add error handling for PDF generation failures

## 6. API Endpoints

- [x] 6.1 Create POST /api/reports/daily endpoint for daily report generation
- [x] 6.2 Create POST /api/reports/weekly endpoint for weekly report generation
- [x] 6.3 Create GET /api/reports/tasks/:taskId endpoint for async task status
- [x] 6.4 Create POST /api/pdf/export endpoint for PDF export
- [x] 6.5 Ensure API responses match TS endpoint DTO structure (M-01)

## 7. Testing and Validation

- [x] 7.1 Test daily report generation with valid data
- [x] 7.2 Test weekly report generation with partial data
- [x] 7.3 Test PDF export with Chinese characters
- [x] 7.4 Test async task queue flow (submit, check status, retrieve)
- [x] 7.5 Visual regression test PDF output vs TS implementation
- [x] 7.6 Test PDF generation in Docker container environment

## 8. Deployment Configuration

- [x] 8.1 Update Dockerfile to include bundled fonts
- [x] 8.2 Add WeasyPrint system dependencies to Docker image
- [x] 8.3 Configure font paths in deployment environment variables
- [x] 8.4 Verify PDF generation works without system fonts

## 9. Audit Continuity

- [x] 9.1 Implement dual-write audit logs during migration phase
- [x] 9.2 Verify audit metadata consistency across TS and Python implementations
- [x] 9.3 Add audit log reconciliation script for migration validation

## 10. Integration and Migration

- [x] 10.1 Update gateway/facade layer to route report requests to Python
- [x] 10.2 Implement phased traffic switching (M-04)
- [x] 10.3 Add rollback mechanism to TS endpoints if needed
- [x] 10.4 Document API contract and migration guide
