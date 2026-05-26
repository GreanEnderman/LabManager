import pytest


@pytest.mark.parametrize("resource,method,endpoint,action", [
    ("tasks", "POST", "/api/tasks", "create"),
    ("tasks", "GET", "/api/tasks/1", "read"),
    ("tasks", "PUT", "/api/tasks/1", "update"),
    ("tasks", "DELETE", "/api/tasks/1", "delete"),
    ("approvals", "POST", "/api/approvals", "create"),
    ("approvals", "GET", "/api/approvals/1", "read"),
    ("imports", "POST", "/api/imports", "create"),
    ("imports", "GET", "/api/imports/1", "read"),
    ("reports", "POST", "/api/reports", "create"),
    ("reports", "GET", "/api/reports/1", "read"),
    ("deliveries", "POST", "/api/deliveries", "create"),
    ("deliveries", "GET", "/api/deliveries/1", "read"),
])
def test_admin_access_all_endpoints(api_client, api_base_url, admin_auth, resource, method, endpoint, action):
    response = api_client.request(method, f"{api_base_url}{endpoint}", headers=admin_auth, json={})
    assert response.status_code not in [401, 403], f"Admin should have access to {method} {endpoint}"


def test_user_access_permitted_endpoints(api_client, api_base_url, user_auth):
    permitted = [
        ("POST", "/api/tasks"),
        ("GET", "/api/tasks/1"),
    ]
    for method, endpoint in permitted:
        response = api_client.request(method, f"{api_base_url}{endpoint}", headers=user_auth, json={})
        assert response.status_code not in [403], f"User should have access to {method} {endpoint}"


def test_user_blocked_from_admin_endpoints(api_client, api_base_url, user_auth):
    admin_only = [
        ("DELETE", "/api/tasks/999"),
        ("PUT", "/api/deliveries/1"),
    ]
    for method, endpoint in admin_only:
        response = api_client.request(method, f"{api_base_url}{endpoint}", headers=user_auth, json={})
        assert response.status_code == 403, f"User should be blocked from {method} {endpoint}"


def test_guest_blocked_from_protected_endpoints(api_client, api_base_url):
    protected = [
        ("GET", "/api/tasks/1"),
        ("POST", "/api/tasks"),
        ("GET", "/api/approvals/1"),
    ]
    for method, endpoint in protected:
        response = api_client.request(method, f"{api_base_url}{endpoint}", json={})
        assert response.status_code == 401, f"Guest should be blocked from {method} {endpoint}"
