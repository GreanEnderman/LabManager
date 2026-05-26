import pytest
from tests.api.contract.snapshot_manager import SnapshotManager


@pytest.fixture
def snapshot_manager():
    return SnapshotManager()


def test_create_delivery_contract(api_client, api_base_url, admin_auth, snapshot_manager):
    payload = {"destination": "lab_a", "items": []}
    response = api_client.post(f"{api_base_url}/api/deliveries", json=payload, headers=admin_auth)

    assert response.status_code == 201
    data = response.json()

    required_fields = ["id", "status", "tracking_number"]
    assert snapshot_manager.validate_schema(data, required_fields)


def test_get_delivery_contract(api_client, api_base_url, admin_auth, snapshot_manager):
    response = api_client.get(f"{api_base_url}/api/deliveries/1", headers=admin_auth)

    assert response.status_code == 200
    data = response.json()

    required_fields = ["id", "status", "tracking_history"]
    assert snapshot_manager.validate_schema(data, required_fields)
