# Dual-Track Regression Testing

Automated comparison framework for TS and Python backend behavioral equivalence during migration.

## Overview

This regression testing system ensures that the Python backend reimplementation maintains behavioral equivalence with the TypeScript prototype on critical API endpoints. It supports the phased migration strategy (M-04) by providing go/no-go signals for traffic switching.

## Architecture

- **Comparison Proxy**: Dual-invokes both backends with identical requests
- **Response Comparator**: Deep-diffs JSON responses with allowlist support
- **Adjudication System**: Manual review workflow for differences
- **Traffic Switch Gate**: Readiness verification before production cutover

## Adjudication Process

### 1. Run Regression Tests

```bash
pytest tests/regression/ -v
```

Differences are logged to `tests/regression/diffs/`

### 2. Review Pending Differences

```bash
python -m tests.regression.adjudication.cli list-pending
```

### 3. Adjudicate Each Difference

```bash
python -m tests.regression.adjudication.cli adjudicate <diff-id> \
  --category acceptable \
  --justification "Timestamp precision difference - Python uses microseconds, TS uses milliseconds" \
  --reviewer-name "Your Name" \
  --reviewer-email "you@example.com"
```

**Categories:**
- `acceptable`: Expected difference (requires 2 reviewers)
- `python-correct`: Python is right, TS had bug
- `ts-correct`: TS is right, Python needs fix (BLOCKING)
- `needs-discussion`: Ambiguous, requires team decision (BLOCKING)

### 4. Check Status

```bash
python -m tests.regression.adjudication.cli status
```

### 5. Traffic Switch Readiness

```bash
python -m tests.regression.traffic_switch check
```

## Allowlist Management

Edit `tests/regression/allowlist.json` to add patterns for acceptable differences:

```json
{
  "global": ["timestamp", "createdAt", "id"],
  "endpoints": {
    "/api/tasks": ["taskId"]
  }
}
```

**Guidelines:**
- Add justification comment for each entry
- Review allowlist quarterly
- Prefer specific patterns over broad wildcards

## Dashboard

Start the adjudication dashboard:

```bash
python tests/regression/dashboard/app.py
```

Visit http://localhost:5001 to view:
- Pending differences
- Adjudication history
- Blocking status
- Category metrics

## CI Integration

Regression tests run automatically on PRs. CI fails if:
- Unadjudicated differences exist
- Blocking differences exist
- "Acceptable" differences lack 2 reviewers

## Audit Trail

Export audit trail for compliance:

```bash
python -m tests.regression.traffic_switch export-audit --output audit_trail.json
```

Archive results:

```bash
python -m tests.regression.traffic_switch archive --archive-dir tests/regression/archive
```
