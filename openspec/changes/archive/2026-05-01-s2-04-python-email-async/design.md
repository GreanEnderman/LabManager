## Context

TS prototype currently handles email delivery for reports. Per M-02 and M-04 migration rules, heavy capabilities (email, async tasks) should move to Python backend. S2-03 provides report generation, S1-07 provides audit logging foundation. This change completes the delivery pipeline.

## Goals / Non-Goals

**Goals:**
- Python backend can send emails with attachments (reports)
- Track send records, failures, retry attempts
- Background task orchestration for report→email workflow
- Frontend switches to Python email endpoints
- TS email delivery becomes fallback only

**Non-Goals:**
- Email template designer UI (use simple templates)
- Advanced scheduling (cron-based recurring sends)
- Email analytics/open tracking
- Replacing all TS async tasks (only report delivery chain)

## Decisions

**D1: Task Queue - Celery with Redis backend**
- Rationale: Standard Python async task solution, integrates with FastAPI, supports retries and chains
- Alternatives: RQ (simpler but less features), direct threading (no persistence)
- Trade-off: Adds Redis dependency but gains production-grade task management

**D2: Email Service - SMTP with python email library**
- Rationale: Direct SMTP control, no third-party service dependency, works with any SMTP provider
- Alternatives: SendGrid/AWS SES SDK (vendor lock-in), smtplib only (no template support)
- Trade-off: Need to manage SMTP credentials and connection pooling

**D3: Send Record Storage - PostgreSQL table**
- Rationale: Reuse existing DB, audit continuity (M-03), queryable history
- Alternatives: Separate log store (complexity), task result backend only (no long-term audit)
- Trade-off: DB writes on every send, but necessary for audit compliance

**D4: Migration Strategy - Dual-stack with feature flag**
- Rationale: Gradual rollout per M-04, can rollback to TS if issues
- Implementation: Frontend checks feature flag, routes to Python or TS endpoint
- Rollback: Flip flag back to TS

## Risks / Trade-offs

**[Risk: Email delivery failure impacts user experience]**
→ Mitigation: Retry mechanism (3 attempts with exponential backoff), fallback to TS endpoint if Python fails, alert on repeated failures

**[Risk: Task queue downtime blocks all async operations]**
→ Mitigation: Redis persistence, task result expiry, manual retry endpoint for stuck tasks

**[Risk: SMTP credential exposure]**
→ Mitigation: Store in environment variables, never log credentials, use app passwords not primary credentials

**[Trade-off: Celery adds operational complexity]**
→ Accepted: Production async tasks require robust queue, complexity is justified by reliability needs
