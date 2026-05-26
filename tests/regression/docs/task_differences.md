# Task Endpoint Differences

## POST /api/tasks

### Known Differences

*To be populated after running initial comparison tests*

### Investigation Notes

- Run comparison test: `pytest tests/regression/test_tasks.py`
- Review diff logs in: `tests/regression/diffs/`
- Common expected differences:
  - `id` field format (UUID vs sequential)
  - `createdAt` timestamp precision
  - `updatedAt` timestamp precision

### Adjudication Status

*Pending initial test run*
