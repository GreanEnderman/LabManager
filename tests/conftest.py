import pytest
import requests
from typing import Dict


@pytest.fixture
def api_base_url():
    return "http://localhost:8000"


@pytest.fixture
def api_client(api_base_url):
    session = requests.Session()
    session.base_url = api_base_url
    return session


@pytest.fixture
def admin_auth():
    return {"Authorization": "Bearer admin_token"}


@pytest.fixture
def user_auth():
    return {"Authorization": "Bearer user_token"}


@pytest.fixture
def guest_auth():
    return {}


@pytest.fixture
def admin_client(api_client, admin_auth):
    api_client.headers.update(admin_auth)
    return api_client


@pytest.fixture
def user_client(api_client, user_auth):
    api_client.headers.update(user_auth)
    return api_client


@pytest.fixture
def guest_client(api_client, guest_auth):
    return api_client
