import pytest


def test_only_authorized_users_can_initiate_imports(api_client, api_base_url, user_auth):
    response = api_client.post(f"{api_base_url}/api/imports", json={}, headers=user_auth)
    assert response.status_code == 403


def test_users_can_only_view_own_import_jobs(api_client, api_base_url, user_auth):
    response = api_client.get(f"{api_base_url}/api/imports/999", headers=user_auth)
    assert response.status_code in [403, 404]
