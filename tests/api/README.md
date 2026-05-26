# API Testing Suite

This directory contains comprehensive API-level regression and permission testing for the LabManager system.

## Test Structure

```
tests/api/
├── contract/           # Contract tests for API endpoints
│   ├── snapshots/      # Baseline snapshots for comparison
│   ├── test_tasks.py
│   ├── test_approvals.py
│   ├── test_imports.py
│   ├── test_reports.py
│   ├── test_deliveries.py
│   ├── test_errors.py
│   └── snapshot_manager.py
├── permissions/        # Permission boundary tests
│   ├── test_rbac.py
│   ├── test_tasks.py
│   ├── test_approvals.py
│   ├── test_imports.py
│   ├── test_reports.py
│   └── test_deliveries.py
└── PERMISSION_MATRIX.md
```

## Setup

Install test dependencies:
```bash
cd python_backend
pip install -e ".[dev]"
```

## Running Tests

### Run all API tests
```bash
pytest tests/api/
```

### Run contract tests only
```bash
pytest tests/api/contract/
```

### Run permission tests only
```bash
pytest tests/api/permissions/
```

### Run specific test file
```bash
pytest tests/api/contract/test_tasks.py
pytest tests/api/permissions/test_rbac.py
```

### Run with verbose output
```bash
pytest tests/api/ -v
```

## Test Categories

### Contract Tests
Validate API response schemas and status codes for:
- Task endpoints (CRUD operations)
- Approval endpoints (create, read)
- Import endpoints (create, read)
- Report endpoints (create, read)
- Delivery endpoints (create, read)
- Error responses (400, 404, 401)

### Permission Tests
Validate role-based access control for:
- Admin access to all endpoints
- User access to permitted endpoints
- Guest blocked from protected endpoints
- Resource ownership boundaries
- Operation-specific permissions

## Baseline Management

### Generate baseline snapshots
```bash
python tests/api/contract/generate_baselines.py
```

### Compare against baseline
Run contract tests to validate current API behavior matches baseline snapshots.

## Migration Validation

This test suite serves as a baseline for dual-stack migration:

1. **Pre-migration**: Run tests to establish baseline
2. **Post-migration**: Run tests to detect regressions
3. **Compare**: Any failures indicate breaking changes

## Permission Matrix

See [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md) for complete role-endpoint coverage documentation.
