# Allowlist Management Guidelines

## Purpose

The allowlist filters out expected, acceptable differences between TS and Python backends to reduce noise in regression testing.

## When to Add to Allowlist

✓ **Add when:**
- Timestamp format differences (ISO8601 vs Unix)
- ID generation differences (UUID vs sequential)
- Floating-point precision differences
- Non-deterministic field ordering in JSON
- Framework-specific metadata fields

✗ **Do NOT add when:**
- Business logic produces different results
- Data validation differs
- Error handling differs
- Audit fields have different semantics

## Adding Entries

### Global Patterns

For differences that apply across all endpoints:

```json
{
  "global": [
    "timestamp",
    "createdAt",
    "updatedAt",
    "id",
    "uuid"
  ]
}
```

### Endpoint-Specific Patterns

For differences specific to one endpoint:

```json
{
  "endpoints": {
    "/api/tasks": [
      {
        "pattern": "taskId",
        "justification": "TS uses sequential IDs, Python uses UUIDs"
      }
    ]
  }
}
```

## Review Process

1. **Propose**: Add entry with justification
2. **Review**: Two reviewers must approve
3. **Document**: Update this file with rationale
4. **Monitor**: Track allowlist growth metrics

## Quarterly Review

Every quarter, review allowlist entries:
- Remove obsolete patterns
- Consolidate similar patterns
- Verify justifications still valid
- Check for overuse (>20 entries = red flag)

## Red Flags

⚠️ **Warning signs:**
- Allowlist growing rapidly (>5 new entries/week)
- Broad wildcards (`*`, `.*`)
- Vague justifications ("differences expected")
- Same pattern repeated across endpoints

If you see these, investigate root cause rather than adding more allowlist entries.
