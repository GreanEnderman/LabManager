import pytest


def test_users_can_only_generate_reports_within_scope(api_client, api_base_url, user_auth):
    payload = {"report_type": "admin_summary"}
    response = api_client.post(f"{api_base_url}/api/reports", json=payload, headers=user_auth)
    assert response.status_code == 403


def test_report_access_restricted_to_authorized_users(api_client, api_base_url, user_auth):
    response = api_client.get(f"{api_base_url}/api/reports/999", headers=user_auth)
    assert response.status_code in [403, 404]
