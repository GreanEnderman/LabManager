from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.auth import AuthenticatedUser, decode_auth_token, encode_auth_token, hash_password, verify_password


def test_password_hash_verifies_only_matching_password() -> None:
    password_hash = hash_password("LabAdmin#2026", salt="unit-test-salt", iterations=1_000)

    assert verify_password("LabAdmin#2026", password_hash) is True
    assert verify_password("wrong-password", password_hash) is False


def test_auth_token_round_trips_and_rejects_tampering() -> None:
    user = AuthenticatedUser(
        id="default-admin",
        username="admin",
        name="Default Admin",
        role="admin",
        capabilities=["tasks:read"],
    )

    token = encode_auth_token(user, "test-secret")
    payload = decode_auth_token(token, "test-secret")

    assert payload is not None
    assert payload["sub"] == "default-admin"
    assert payload["username"] == "admin"
    assert decode_auth_token(f"{token}tampered", "test-secret") is None


def test_auth_token_rejects_expired_payload() -> None:
    user = AuthenticatedUser(
        id="default-viewer",
        username="viewer",
        name="Default Viewer",
        role="viewer",
        capabilities=["tasks:read"],
    )
    issued_at = datetime(2026, 5, 1, tzinfo=timezone.utc)
    token = encode_auth_token(user, "test-secret", now=issued_at)

    payload = decode_auth_token(token, "test-secret", now=issued_at + timedelta(days=1))

    assert payload is None
