# Fixture Creation and Maintenance

## Fixture Structure

Each fixture is a JSON file in `tests/regression/fixtures/` with this structure:

```json
{
  "name": "fixture_name",
  "description": "What this fixture tests",
  "seed_data": {
    "table_name": [
      {"field": "value"}
    ]
  },
  "request": {
    "method": "POST",
    "path": "/api/endpoint",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "field": "value"
    }
  }
}
```

## Creating New Fixtures

### 1. Identify Test Scenario

What behavior are you testing?
- Happy path
- Edge case
- Error condition
- Complex data structure

### 2. Create Fixture File

```bash
# Name format: <endpoint>_<scenario>.json
touch tests/regression/fixtures/task_create_with_attachments.json
```

### 3. Define Seed Data

Include minimal data needed for the test:

```json
{
  "seed_data": {
    "users": [
      {"id": "user-1", "name": "Test User"}
    ],
    "projects": [
      {"id": "proj-1", "name": "Test Project"}
    ]
  }
}
```

### 4. Define Request

```json
{
  "request": {
    "method": "POST",
    "path": "/api/tasks",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token"
    },
    "body": {
      "title": "Task with attachments",
      "project_id": "proj-1",
      "attachments": [
        {"name": "doc.pdf", "size": 1024}
      ]
    }
  }
}
```

## Fixture Maintenance

### Quarterly Review

Every quarter, review fixtures for:
- Obsolete scenarios (feature removed)
- Missing coverage (new features)
- Data staleness (schema changes)

### Updating Fixtures

When API schema changes:

1. Update affected fixtures
2. Run regression tests
3. Adjudicate new differences
4. Update allowlist if needed

### Fixture Naming Conventions

- `<endpoint>_basic.json` - Happy path
- `<endpoint>_edge_<case>.json` - Edge cases
- `<endpoint>_error_<type>.json` - Error conditions
- `<endpoint>_complex_<scenario>.json` - Complex scenarios

## Seeding from Production

To create realistic fixtures from production data:

1. Export anonymized production logs
2. Extract request/response pairs
3. Anonymize PII (names, emails, IDs)
4. Create fixture files
5. Verify both backends handle them

**Script:**
```bash
python scripts/create_fixtures_from_logs.py \
  --input prod_logs.json \
  --output tests/regression/fixtures/ \
  --anonymize
```

## Best Practices

✓ **Do:**
- Keep fixtures minimal (only necessary data)
- Use descriptive names
- Document edge cases in description
- Version control fixtures
- Test fixtures work on both backends

✗ **Don't:**
- Include real PII
- Create overly complex fixtures
- Duplicate similar scenarios
- Hard-code timestamps
- Use production IDs
