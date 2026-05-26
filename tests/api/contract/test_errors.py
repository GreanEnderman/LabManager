import pytest
from tests.api.contract.snapshot_manager import SnapshotManager


@pytest.fixture
def snapshot_manager():
    return SnapshotManager()


def test_malformed_request_error_contract(api_client, api_base_url, admin_auth, snapshot_manager):
    response = api_client.post(f"{api_base_url}/api/tasks", json={"invalid": "data"}, headers=admin_auth)

    assert response.status_code == 400
    data = response.json()

    required_fields = ["error", "message"]
    assert snapshot_manager.validate_schema(data, required_fields)


def test_not_found_error_contract(api_client, api_base_url, admin_auth, snapshot_manager):
    response = api_client.get(f"{api_base_url}/api/tasks/99999", headers=admin_auth)

    assert response.status_code == 404
    data = response.json()

    required_fields = ["error", "message"]
    assert snapshot_manager.validate_schema(data, required_fields)


def test_unauthorized_error_contract(api_client, api_base_url, snapshot_manager):
    response = api_client.get(f"{api_base_url}/api/tasks/1")

    assert response.status_code == 401
    data = response.json()

    required_fields = ["error", "message"]
    assert snapshot_manager.validate_schema(data, required_fields)
