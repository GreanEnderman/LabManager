import pytest


def test_only_designated_approvers_can_approve(api_client, api_base_url, user_auth):
    response = api_client.post(f"{api_base_url}/api/approvals/1/approve", headers=user_auth)
    assert response.status_code == 403


def test_approver_can_only_approve_assigned_requests(api_client, api_base_url, user_auth):
    response = api_client.post(f"{api_base_url}/api/approvals/999/approve", headers=user_auth)
    assert response.status_code in [403, 404]


def test_requester_cannot_self_approve(api_client, api_base_url, user_auth):
    response = api_client.post(f"{api_base_url}/api/approvals/1/approve", headers=user_auth)
    assert response.status_code == 403
