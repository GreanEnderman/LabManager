from fastapi.testclient import TestClient

from app.main import create_app


def test_development_cors_allows_localhost_random_port_preflight():
    client = TestClient(create_app())

    response = client.options(
        "/api/ai/settings",
        headers={
            "Origin": "http://127.0.0.1:11072",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:11072"


def test_development_cors_rejects_non_localhost_preflight():
    client = TestClient(create_app())

    response = client.options(
        "/api/ai/settings",
        headers={
            "Origin": "http://example.com:11072",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 400
