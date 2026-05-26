# Capability Routing Configuration Guide

## Overview

The LabManager Python backend uses capability-level routing to gradually migrate traffic from the TypeScript backend to Python backend.

## Environment Variables

Each capability can be enabled independently:

| Capability | Environment Variable | Default | Dependencies |
|---|---|---|---|
| SETTINGS | `PY_BACKEND_SETTINGS_ENABLED` | false | None |
| INVENTORY | `PY_BACKEND_INVENTORY_ENABLED` | false | None |
| IMPORT | `PY_BACKEND_IMPORT_ENABLED` | false | None |
| RULES | `PY_BACKEND_RULES_ENABLED` | false | TASKS |
| TASKS | `PY_BACKEND_TASKS_ENABLED` | false | Database |
| APPROVALS | `PY_BACKEND_APPROVALS_ENABLED` | false | TASKS, Database |
| REPORT | `PY_BACKEND_REPORT_ENABLED` | false | TASKS |
| REPORT_PDF | `PY_BACKEND_REPORT_PDF_ENABLED` | false | None |
| REPORT_DELIVERY | `PY_BACKEND_REPORT_DELIVERY_ENABLED` | false | None |
| ASYNC | `PY_BACKEND_ASYNC_ENABLED` | false | Celery |

## Migration Phases

### Phase 1: Stateless Capabilities (Current)
Enable capabilities that don't require database:
```bash
export PY_BACKEND_SETTINGS_ENABLED=1
export PY_BACKEND_INVENTORY_ENABLED=1
export PY_BACKEND_IMPORT_ENABLED=1
```

### Phase 2: Rules Engine
Enable rules after verifying inventory data:
```bash
export PY_BACKEND_RULES_ENABLED=1
```

### Phase 3: Task Management (Requires Database)
Enable tasks and approvals together:
```bash
export DATABASE_URL=postgresql://...
export PY_BACKEND_TASKS_ENABLED=1
export PY_BACKEND_APPROVALS_ENABLED=1
```

### Phase 4: Reporting
Enable after task data is stable:
```bash
export PY_BACKEND_REPORT_ENABLED=1
export PY_BACKEND_REPORT_PDF_ENABLED=1
export PY_BACKEND_REPORT_DELIVERY_ENABLED=1
```

## Validation

Check routing status:
```bash
curl http://localhost:8787/api/ai/health | jq '.data.capabilities'
```

Validate routing consistency:
```bash
curl http://localhost:8787/api/ai/routing/validate | jq
```

## Troubleshooting

### Warning: "TASKS → PYTHON but APPROVALS → compat_fallback"
**Cause**: Tasks and approvals must use the same backend for data consistency.

**Fix**: Enable both together:
```bash
export PY_BACKEND_TASKS_ENABLED=1
export PY_BACKEND_APPROVALS_ENABLED=1
```

### Warning: "RULES → PYTHON but TASKS → compat_fallback"
**Cause**: Rules engine creates tasks, so both must use the same backend.

**Fix**: Enable TASKS before RULES:
```bash
export PY_BACKEND_TASKS_ENABLED=1
export PY_BACKEND_RULES_ENABLED=1
```

### Warning: "REPORT → PYTHON but TASKS → compat_fallback"
**Cause**: Reports aggregate task data, so both must use the same backend.

**Fix**: Enable TASKS before REPORT:
```bash
export PY_BACKEND_TASKS_ENABLED=1
export PY_BACKEND_REPORT_ENABLED=1
```

## Monitoring

### Health Check Endpoint
The `/api/ai/health` endpoint provides detailed routing information:

```json
{
  "data": {
    "status": "healthy",
    "capabilities": {
      "settings": "compat_fallback",
      "inventory": "compat_fallback",
      ...
    },
    "capabilities_detail": {
      "settings": {
        "target": "compat_fallback",
        "enabled": false,
        "env_var": "PY_BACKEND_SETTINGS_ENABLED"
      },
      ...
    },
    "routing_warnings": [],
    "routing_dependencies": {
      "tasks": ["approvals"],
      "rules": ["tasks"],
      "report": ["tasks"]
    }
  }
}
```

### Routing Validation Endpoint
The `/api/ai/routing/validate` endpoint checks consistency:

```json
{
  "data": {
    "valid": true,
    "warnings": [],
    "snapshot": { ... },
    "dependencies": { ... },
    "database_status": {},
    "recommendations": []
  }
}
```

## Best Practices

1. **Always validate before switching**: Run `/api/ai/routing/validate` before enabling new capabilities
2. **Enable dependencies first**: Check the dependencies table and enable required capabilities first
3. **Monitor after switching**: Watch application logs and error rates after enabling a capability
4. **Have a rollback plan**: Know how to quickly disable a capability if issues arise
5. **Test in staging first**: Always test capability switches in a staging environment before production

## Rollback Procedure

If you need to rollback a capability:

1. Unset the environment variable:
   ```bash
   unset PY_BACKEND_<CAPABILITY>_ENABLED
   ```

2. Restart the application

3. Verify the rollback:
   ```bash
   curl http://localhost:8787/api/ai/health | jq '.data.capabilities.<capability>'
   ```

## Advanced Configuration

### Alternative Environment Variable Prefix
You can also use the `LABMANAGER_PY_` prefix:
```bash
export LABMANAGER_PY_PY_BACKEND_RULES_ENABLED=1
```

This is useful for consistency with other LabManager environment variables.

### Runtime Overrides (Testing Only)
For testing purposes, you can override routing programmatically:
```python
from app.gateway.routing import set_capability_target_override, Capability, ServiceTarget

# Override for testing
set_capability_target_override(Capability.RULES, ServiceTarget.PYTHON_BACKEND)

# Clear override
set_capability_target_override(Capability.RULES, None)
```

**Warning**: Runtime overrides are not persisted and will be lost on restart. Use environment variables for production configuration.
