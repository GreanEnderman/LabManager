from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_batch_history_pagination():
    response = client.get("/import/batches?page=1&page_size=20")
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 1
    assert data["page_size"] == 20


def test_batch_history_filter_by_operator():
    response = client.get("/import/batches?operator=test_user")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


def test_batch_detail_structure():
    response = client.get("/import/batches/test-batch-id")
    assert response.status_code == 404
