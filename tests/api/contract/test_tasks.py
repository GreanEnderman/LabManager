import pytest
from tests.api.contract.snapshot_manager import SnapshotManager


@pytest.fixture
def snapshot_manager():
    return SnapshotManager()


def test_create_task_contract(api_client, api_base_url, admin_auth, snapshot_manager):
    payload = {"title": "Test Task", "description": "Test description"}
    response = api_client.post(f"{api_base_url}/api/tasks", json=payload, headers=admin_auth)

    assert response.status_code == 201
    data = response.json()

    required_fields = ["id", "title", "status", "created_at"]
    assert snapshot_manager.validate_schema(data, required_fields)

    snapshot_manager.save_snapshot("task_create", {"status_code": 201, "schema": required_fields})


def test_get_task_contract(api_client, api_base_url, admin_auth, snapshot_manager):
    response = api_client.get(f"{api_base_url}/api/tasks/1", headers=admin_auth)

    assert response.status_code == 200
    data = response.json()

    required_fields = ["id", "title", "status", "created_at"]
    assert snapshot_manager.validate_schema(data, required_fields)


def test_update_task_contract(api_client, api_base_url, admin_auth, snapshot_manager):
    payload = {"title": "Updated Task"}
    response = api_client.put(f"{api_base_url}/api/tasks/1", json=payload, headers=admin_auth)

    assert response.status_code == 200
    data = response.json()

    required_fields = ["id", "title", "status"]
    assert snapshot_manager.validate_schema(data, required_fields)


def test_delete_task_contract(api_client, api_base_url, admin_auth):
    response = api_client.delete(f"{api_base_url}/api/tasks/1", headers=admin_auth)

    assert response.status_code in [200, 204]
