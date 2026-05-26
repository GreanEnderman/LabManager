import pytest


def test_users_can_only_view_deliveries_within_scope(api_client, api_base_url, user_auth):
    response = api_client.get(f"{api_base_url}/api/deliveries/999", headers=user_auth)
    assert response.status_code in [403, 404]


def test_delivery_modification_restricted_by_role(api_client, api_base_url, user_auth):
    response = api_client.put(f"{api_base_url}/api/deliveries/1", json={"status": "delivered"}, headers=user_auth)
    assert response.status_code == 403
