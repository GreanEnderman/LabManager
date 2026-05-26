import pytest


@pytest.fixture
def permission_matrix():
    return {
        "admin": {
            "tasks": ["create", "read", "update", "delete"],
            "approvals": ["create", "read", "approve"],
            "imports": ["create", "read"],
            "reports": ["create", "read"],
            "deliveries": ["create", "read", "update"],
        },
        "user": {
            "tasks": ["create", "read", "update_own"],
            "approvals": ["create", "read_own"],
            "imports": ["read_own"],
            "reports": ["create", "read_own"],
            "deliveries": ["read_own"],
        },
        "guest": {
            "tasks": [],
            "approvals": [],
            "imports": [],
            "reports": [],
            "deliveries": [],
        },
    }


@pytest.fixture
def test_endpoints():
    return {
        "tasks": [
            ("POST", "/api/tasks", "create"),
            ("GET", "/api/tasks/1", "read"),
            ("PUT", "/api/tasks/1", "update"),
            ("DELETE", "/api/tasks/1", "delete"),
        ],
        "approvals": [
            ("POST", "/api/approvals", "create"),
            ("GET", "/api/approvals/1", "read"),
        ],
        "imports": [
            ("POST", "/api/imports", "create"),
            ("GET", "/api/imports/1", "read"),
        ],
        "reports": [
            ("POST", "/api/reports", "create"),
            ("GET", "/api/reports/1", "read"),
        ],
        "deliveries": [
            ("POST", "/api/deliveries", "create"),
            ("GET", "/api/deliveries/1", "read"),
        ],
    }
