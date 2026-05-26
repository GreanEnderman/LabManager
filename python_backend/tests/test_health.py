from fastapi.testclient import TestClient

from app.main import create_app


def test_live_health_endpoint() -> None:
    app = create_app()
    client = TestClient(app)

    response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "alive"}


def test_ready_health_endpoint_reports_missing_config_in_non_strict_mode() -> None:
    app = create_app()
    client = TestClient(app)

    response = client.get("/health/ready")

    assert response.status_code == 200
    body = response.json()
    assert body["ready"] is True
    assert "LABMANAGER_PY_DATABASE_URL is not set" in body["configErrors"]
    assert "LABMANAGER_PY_REDIS_URL is not set" in body["configErrors"]
    assert any(check["name"] == "postgres_schema" for check in body["checks"])
