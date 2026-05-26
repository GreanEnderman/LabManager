## 1. Framework Setup

- [x] 1.1 Create tests/regression/ directory structure
- [x] 1.2 Implement comparison proxy in tests/regression/proxy.py
- [x] 1.3 Add HTTP client utilities for dual backend invocation
- [x] 1.4 Implement response comparison logic with JSON diff
- [x] 1.5 Create diff logging system (tests/regression/diffs/)
- [x] 1.6 Add allowlist configuration file (tests/regression/allowlist.json)
- [x] 1.7 Implement allowlist matching logic

## 2. Fixture Management

- [x] 2.1 Create tests/regression/fixtures/ directory
- [x] 2.2 Implement database seeding utilities
- [x] 2.3 Implement database cleanup/reset utilities
- [x] 2.4 Add fixture loader for request payloads
- [x] 2.5 Create initial fixture files for critical endpoints

## 3. Endpoint Coverage - Tasks

- [x] 3.1 Add comparison test for POST /api/tasks
- [x] 3.2 Create task creation fixtures
- [x] 3.3 Identify and document task endpoint differences
- [x] 3.4 Add task-specific allowlist entries

## 4. Endpoint Coverage - Approvals

- [x] 4.1 Add comparison test for POST /api/approvals
- [x] 4.2 Create approval workflow fixtures
- [x] 4.3 Identify and document approval endpoint differences
- [x] 4.4 Add approval-specific allowlist entries

## 5. Endpoint Coverage - Imports

- [x] 5.1 Add comparison test for POST /api/imports
- [x] 5.2 Create import data fixtures
- [x] 5.3 Identify and document import endpoint differences
- [x] 5.4 Add import-specific allowlist entries

## 6. Endpoint Coverage - Reports

- [x] 6.1 Add comparison test for GET /api/reports/:id
- [x] 6.2 Create report generation fixtures
- [x] 6.3 Identify and document report endpoint differences
- [x] 6.4 Add report-specific allowlist entries

## 7. Endpoint Coverage - PDF

- [x] 7.1 Add comparison test for POST /api/pdf/generate
- [x] 7.2 Create PDF generation fixtures
- [x] 7.3 Identify and document PDF endpoint differences
- [x] 7.4 Add PDF-specific allowlist entries

## 8. Endpoint Coverage - Email

- [x] 8.1 Add comparison test for POST /api/email/send
- [x] 8.2 Create email dispatch fixtures
- [x] 8.3 Identify and document email endpoint differences
- [x] 8.4 Add email-specific allowlist entries

## 9. Adjudication System

- [x] 9.1 Create adjudication data model (category, reviewer, timestamp, justification)
- [x] 9.2 Implement adjudication CLI tool for reviewing diffs
- [x] 9.3 Add adjudication status tracking (unadjudicated/acceptable/python-correct/ts-correct/needs-discussion)
- [x] 9.4 Implement two-reviewer approval workflow for "acceptable" category
- [x] 9.5 Create adjudication audit trail storage

## 10. Adjudication Dashboard

- [x] 10.1 Create web dashboard UI for adjudication
- [x] 10.2 Implement pending differences view
- [x] 10.3 Implement adjudication history view with filters
- [x] 10.4 Add blocking status indicator
- [x] 10.5 Implement category distribution metrics

## 11. CI Integration

- [x] 11.1 Create GitHub Actions workflow for regression tests
- [x] 11.2 Add pre-merge regression check job
- [x] 11.3 Implement CI failure on unadjudicated differences
- [x] 11.4 Add CI success on all-adjudicated differences
- [x] 11.5 Configure parallel endpoint test execution

## 12. Traffic Switch Gate

- [x] 12.1 Implement traffic switch readiness check command
- [x] 12.2 Add blocking difference verification
- [x] 12.3 Create readiness report generator
- [x] 12.4 Implement regression results archival system
- [x] 12.5 Add audit trail export for compliance

## 13. Documentation

- [x] 13.1 Document adjudication process in tests/regression/README.md
- [x] 13.2 Create runbook for local regression testing
- [x] 13.3 Document allowlist management guidelines
- [x] 13.4 Add traffic switch gate usage guide
- [x] 13.5 Document fixture creation and maintenance process
