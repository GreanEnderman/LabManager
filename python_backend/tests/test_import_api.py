import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_manual_import_success():
    response = client.post(
        "/import/manual",
        json={
            "operator": "test_user",
            "reason": "test import",
            "run_id": "test-run-123",
            "data": {"field1": "value1"},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "batch_id" in data
    assert data["status"] == "success"


def test_batch_import_endpoint():
    response = client.post("/import/batch")
    assert response.status_code == 200
    data = response.json()
    assert "batch_id" in data


def test_list_batches():
    response = client.get("/import/batches")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data


def test_list_batches_with_filter():
    response = client.get("/import/batches?operator=test_user&page=1&page_size=10")
    assert response.status_code == 200


def test_get_batch_detail_not_found():
    response = client.get("/import/batches/nonexistent")
    assert response.status_code == 404
