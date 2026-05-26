# Traffic Switch Gate Usage Guide

## Overview

The traffic switch gate ensures safe phased migration from TS to Python backend by verifying behavioral equivalence before production cutover.

## Pre-Switch Checklist

Before switching traffic for any capability (per M-04):

1. ✓ All regression tests passing
2. ✓ All differences adjudicated
3. ✓ No blocking differences
4. ✓ "Acceptable" differences have 2 reviewers
5. ✓ Audit trail archived

## Running Readiness Check

```bash
python -m tests.regression.traffic_switch check
```

**Output:**
- `✓ Traffic switch READY` - Safe to proceed
- `✗ Traffic switch BLOCKED` - Do not proceed, resolve issues first

## Generating Readiness Report

```bash
python -m tests.regression.traffic_switch report --output switch_report.json
```

Share this report with stakeholders before traffic switch.

## Phased Switch Order (per M-04)

### Phase 1: Heavy Capabilities
- Rules engine
- Data imports
- Report generation
- PDF generation
- Email dispatch
- Async tasks

**Command:**
```bash
# Run regression for Phase 1 endpoints
pytest tests/regression/test_imports.py tests/regression/test_reports.py tests/regression/test_pdf.py tests/regression/test_email.py -v

# Check readiness
python -m tests.regression.traffic_switch check
```

### Phase 2: Core APIs
- Task API
- Approval API
- Activity log API

**Command:**
```bash
# Run regression for Phase 2 endpoints
pytest tests/regression/test_tasks.py tests/regression/test_approvals.py -v

# Check readiness
python -m tests.regression.traffic_switch check
```

## Post-Switch Verification

After switching traffic:

1. Archive results:
```bash
python -m tests.regression.traffic_switch archive
```

2. Export audit trail:
```bash
python -m tests.regression.traffic_switch export-audit --output phase1_audit.json
```

3. Monitor production metrics for 24 hours
4. Keep TS backend running as fallback (per M-05)

## Rollback Procedure

If issues detected post-switch:

1. Revert traffic routing to TS backend
2. Document issue in `tests/regression/docs/rollback_log.md`
3. Create new regression test for the issue
4. Fix Python backend
5. Re-run readiness check before retry

## Blocking Difference Resolution

If readiness check fails:

1. Identify blocking differences:
```bash
python -m tests.regression.adjudication.cli list-pending
```

2. For each blocking difference:
   - If `ts-correct`: Fix Python backend, re-test
   - If `needs-discussion`: Schedule team review, decide on correct behavior

3. Re-run readiness check after fixes

## Audit Requirements (per M-03)

Before final TS decommission (per M-05):
- Archive all regression results
- Export complete audit trail
- Verify cross-stack traceability
- Document all adjudication decisions
