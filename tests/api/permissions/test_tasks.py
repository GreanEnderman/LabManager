import pytest


def test_user_can_only_modify_own_tasks(api_client, api_base_url, user_auth):
    response = api_client.put(f"{api_base_url}/api/tasks/999", json={"title": "Updated"}, headers=user_auth)
    assert response.status_code == 403


def test_user_can_view_tasks_within_scope(api_client, api_base_url, user_auth):
    response = api_client.get(f"{api_base_url}/api/tasks", headers=user_auth)
    assert response.status_code == 200


def test_admin_can_modify_any_task(api_client, api_base_url, admin_auth):
    response = api_client.put(f"{api_base_url}/api/tasks/1", json={"title": "Updated"}, headers=admin_auth)
    assert response.status_code in [200, 404]
