from __future__ import annotations

from contextlib import asynccontextmanager
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers

pytest.importorskip("asyncpg")

from app.api import ai_compat
from app.auth import hash_password


class FakeRequest:
    def __init__(self, payload: dict[str, Any] | None = None, headers: dict[str, str] | None = None) -> None:
        self._payload = payload or {}
        self.headers = Headers(headers or {})

    async def json(self) -> dict[str, Any]:
        return self._payload


class FakeCursor:
    def __init__(self, rows: dict[str, dict[str, Any]]) -> None:
        self.rows = rows
        self.row: dict[str, Any] | None = None

    async def __aenter__(self) -> "FakeCursor":
        return self

    async def __aexit__(self, *args: object) -> None:
        return None

    async def execute(self, sql: str, params: tuple[Any, ...]) -> None:
        normalized = " ".join(sql.split()).lower()
        if "where lower(username)" in normalized:
            self.row = next((row for row in self.rows.values() if row["username"].lower() == params[0]), None)
        elif "where id" in normalized:
            self.row = self.rows.get(str(params[0]))
        else:
            self.row = None

    async def fetchone(self) -> dict[str, Any] | None:
        return self.row


class FakeConnection:
    def __init__(self, rows: dict[str, dict[str, Any]]) -> None:
        self.rows = rows

    def cursor(self, **_: Any) -> FakeCursor:
        return FakeCursor(self.rows)


def make_rows() -> dict[str, dict[str, Any]]:
    return {
        "default-admin": {
            "id": "default-admin",
            "username": "admin",
            "display_name": "Default Admin",
            "role": "admin",
            "password_hash": hash_password("LabAdmin#2026", salt="unit-test-admin", iterations=1_000),
        }
    }


@pytest.fixture
def auth_db(monkeypatch: pytest.MonkeyPatch) -> dict[str, dict[str, Any]]:
    rows = make_rows()
    monkeypatch.setattr(
        ai_compat,
        "get_settings",
        lambda: SimpleNamespace(database_url="postgresql://example", auth_token_secret="test-secret"),
    )

    @asynccontextmanager
    async def fake_db_connection():
        yield FakeConnection(rows)

    monkeypatch.setattr(ai_compat, "get_db_connection", fake_db_connection)
    return rows


@pytest.mark.asyncio
async def test_login_uses_database_user(auth_db: dict[str, dict[str, Any]]) -> None:
    response = await ai_compat.login(FakeRequest({"username": "admin", "password": "LabAdmin#2026"}))

    assert response["error"] is None
    assert response["data"]["user"]["id"] == "default-admin"
    assert response["data"]["user"]["role"] == "admin"
    assert "settings:update" in response["data"]["user"]["capabilities"]
    assert response["data"]["token"]


@pytest.mark.asyncio
async def test_login_rejects_bad_password(auth_db: dict[str, dict[str, Any]]) -> None:
    with pytest.raises(HTTPException) as exc:
        await ai_compat.login(FakeRequest({"username": "admin", "password": "wrong"}))

    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_me_resolves_bearer_token_user(auth_db: dict[str, dict[str, Any]]) -> None:
    login_response = await ai_compat.login(FakeRequest({"username": "admin", "password": "LabAdmin#2026"}))
    token = login_response["data"]["token"]

    response = await ai_compat.me(FakeRequest(headers={"Authorization": f"Bearer {token}"}))

    assert response["data"]["username"] == "admin"
    assert response["data"]["name"] == "Default Admin"
