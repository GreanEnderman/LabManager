# Permission Matrix Documentation

## Role-Endpoint Coverage

This document provides a comprehensive overview of permission boundaries across all API endpoints.

### Role Definitions

- **Admin**: Full access to all endpoints and operations
- **User**: Limited access to own resources and permitted operations
- **Guest**: No access to protected endpoints (unauthenticated)

### Permission Matrix

| Endpoint | Method | Admin | User | Guest | Notes |
|----------|--------|-------|------|-------|-------|
| `/api/tasks` | POST | ✓ | ✓ | ✗ | Users can create tasks |
| `/api/tasks/{id}` | GET | ✓ | ✓ (own) | ✗ | Users can only view own tasks |
| `/api/tasks/{id}` | PUT | ✓ | ✓ (own) | ✗ | Users can only update own tasks |
| `/api/tasks/{id}` | DELETE | ✓ | ✗ | ✗ | Admin only |
| `/api/approvals` | POST | ✓ | ✓ | ✗ | Users can request approvals |
| `/api/approvals/{id}` | GET | ✓ | ✓ (own) | ✗ | Users can view own approval requests |
| `/api/approvals/{id}/approve` | POST | ✓ | ✗ | ✗ | Only designated approvers |
| `/api/imports` | POST | ✓ | ✗ | ✗ | Admin only |
| `/api/imports/{id}` | GET | ✓ | ✓ (own) | ✗ | Users can view own import jobs |
| `/api/reports` | POST | ✓ | ✓ (limited) | ✗ | Users can generate reports within scope |
| `/api/reports/{id}` | GET | ✓ | ✓ (own) | ✗ | Users can view own reports |
| `/api/deliveries` | POST | ✓ | ✗ | ✗ | Admin only |
| `/api/deliveries/{id}` | GET | ✓ | ✓ (own) | ✗ | Users can view deliveries within scope |
| `/api/deliveries/{id}` | PUT | ✓ | ✗ | ✗ | Admin only |

### Test Coverage

#### Contract Tests
- ✓ Task endpoints (create, read, update, delete)
- ✓ Approval endpoints (create, read)
- ✓ Import endpoints (create, read)
- ✓ Report endpoints (create, read)
- ✓ Delivery endpoints (create, read)
- ✓ Error responses (400, 404, 401)

#### Permission Tests
- ✓ Role-based access control (admin, user, guest)
- ✓ Task operation boundaries
- ✓ Approval operation boundaries
- ✓ Import operation boundaries
- ✓ Report operation boundaries
- ✓ Delivery operation boundaries

### Running Tests

```bash
# Run all contract tests
pytest tests/api/contract/

# Run all permission tests
pytest tests/api/permissions/

# Run specific test suite
pytest tests/api/contract/test_tasks.py
pytest tests/api/permissions/test_rbac.py
```

### Baseline Comparison

Baseline snapshots are stored in `tests/api/contract/snapshots/` and can be used to detect unintended API changes during migration.

To regenerate baselines:
```bash
python tests/api/contract/generate_baselines.py
```
