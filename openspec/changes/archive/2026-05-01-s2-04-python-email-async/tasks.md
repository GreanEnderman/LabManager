## 1. Infrastructure Setup

- [x] 1.1 Add Celery and Redis dependencies to Python backend requirements
- [x] 1.2 Configure Celery app with Redis broker and result backend
- [x] 1.3 Add SMTP configuration to environment variables (server, port, credentials, TLS)
- [x] 1.4 Create Celery worker startup script

## 2. Database Schema

- [x] 2.1 Create email_send_records table (id, report_id, recipients, status, error, operator_id, task_run_id, created_at, updated_at)
- [x] 2.2 Add indexes on status, created_at, and report_id columns
- [x] 2.3 Create database migration script

## 3. Email Service Core

- [x] 3.1 Implement SMTP connection manager with connection pooling
- [x] 3.2 Create email template renderer with variable substitution
- [x] 3.3 Implement email send function with attachment support
- [x] 3.4 Add email address validation utility
- [x] 3.5 Create email service error handling and logging

## 4. Async Task Implementation

- [x] 4.1 Create Celery task for email sending with retry logic (3 attempts, exponential backoff)
- [x] 4.2 Create Celery task for report generation
- [x] 4.3 Implement task chain: report generation → email delivery
- [x] 4.4 Add task status query endpoint
- [x] 4.5 Implement task result storage and retrieval

## 5. Delivery Audit

- [x] 5.1 Create send record creation function (captures operator, timestamp, runId)
- [x] 5.2 Implement status update function for send records
- [x] 5.3 Create send history query endpoint (by report, date range, recipient)
- [x] 5.4 Implement manual retry endpoint for failed sends
- [x] 5.5 Add retry chain tracking (link retries to original send)

## 6. API Endpoints

- [x] 6.1 Create POST /api/email/send endpoint (manual send)
- [x] 6.2 Create GET /api/email/status/:taskId endpoint (task status query)
- [x] 6.3 Create GET /api/email/history endpoint (send history with filters)
- [x] 6.4 Create POST /api/email/retry/:recordId endpoint (retry failed send)
- [x] 6.5 Add API authentication and authorization checks

## 7. Frontend Integration

- [x] 7.1 Add feature flag for Python email delivery
- [x] 7.2 Update email send UI to call Python endpoints when flag enabled
- [x] 7.3 Add send status polling UI
- [x] 7.4 Update send history display to show Python send records
- [x] 7.5 Add retry button for failed sends

## 8. Migration and Fallback

- [x] 8.1 Mark TS email endpoints as deprecated in code comments
- [x] 8.2 Add fallback logic: if Python send fails, log and optionally call TS endpoint
- [x] 8.3 Create migration documentation for switching feature flag
- [x] 8.4 Add monitoring alerts for email delivery failures

## 9. Testing

- [x] 9.1 Test email send with attachments (success case)
- [x] 9.2 Test email send failure and retry mechanism
- [x] 9.3 Test task chain execution (report → email)
- [x] 9.4 Test send record creation and audit trail
- [x] 9.5 Test manual retry of failed sends
- [x] 9.6 Test feature flag switching between Python and TS endpoints
