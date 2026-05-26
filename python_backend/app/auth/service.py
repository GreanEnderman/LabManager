from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import psycopg.rows

from app.authz import get_capabilities_for_role


PASSWORD_HASH_ALGORITHM = "pbkdf2_sha256"
PASSWORD_HASH_ITERATIONS = 120_000
DEFAULT_AUTH_TOKEN_TTL_SECONDS = 8 * 60 * 60


class LoginError(Exception):
    """Raised when credentials cannot be authenticated."""


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    username: str
    name: str
    role: str
    capabilities: list[str]


def hash_password(password: str, *, salt: str | None = None, iterations: int = PASSWORD_HASH_ITERATIONS) -> str:
    resolved_salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), resolved_salt.encode("utf-8"), iterations)
    return f"{PASSWORD_HASH_ALGORITHM}${iterations}${resolved_salt}${base64.urlsafe_b64encode(digest).decode('ascii')}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt, stored_digest = password_hash.split("$", 3)
        iterations = int(iterations_text)
    except ValueError:
        return False

    if algorithm != PASSWORD_HASH_ALGORITHM:
        return False

    candidate = hash_password(password, salt=salt, iterations=iterations).split("$", 3)[3]
    return hmac.compare_digest(candidate, stored_digest)


def encode_auth_token(user: AuthenticatedUser, secret: str, *, now: datetime | None = None) -> str:
    issued_at = now or datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(seconds=DEFAULT_AUTH_TOKEN_TTL_SECONDS)
    payload = {
        "sub": user.id,
        "username": user.username,
        "role": user.role,
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    payload_segment = _base64url_json(payload)
    signature = _sign(payload_segment, secret)
    return f"{payload_segment}.{signature}"


def decode_auth_token(token: str, secret: str, *, now: datetime | None = None) -> dict[str, Any] | None:
    try:
        payload_segment, signature = token.split(".", 1)
    except ValueError:
        return None

    expected_signature = _sign(payload_segment, secret)
    if not hmac.compare_digest(signature, expected_signature):
        return None

    try:
        payload = json.loads(_base64url_decode(payload_segment).decode("utf-8"))
    except (json.JSONDecodeError, ValueError):
        return None

    expires_at = payload.get("exp")
    if not isinstance(expires_at, int):
        return None

    current_time = now or datetime.now(timezone.utc)
    if expires_at <= int(current_time.timestamp()):
        return None

    return payload


async def authenticate_user(conn: Any, username: str, password: str) -> AuthenticatedUser:
    normalized_username = username.strip().lower()
    if not normalized_username or not password:
        raise LoginError("Username and password are required.")

    async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        await cur.execute(
            """
            SELECT id, username, display_name, role, password_hash
            FROM app_users
            WHERE lower(username) = %s AND is_active = true
            """,
            (normalized_username,),
        )
        row = await cur.fetchone()

    if not row or not verify_password(password, row["password_hash"]):
        raise LoginError("Invalid username or password.")

    capabilities = [capability.value for capability in get_capabilities_for_role(row["role"])]
    return AuthenticatedUser(
        id=str(row["id"]),
        username=str(row["username"]),
        name=str(row["display_name"]),
        role=str(row["role"]),
        capabilities=capabilities,
    )


async def find_user_by_id(conn: Any, user_id: str) -> AuthenticatedUser | None:
    async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        await cur.execute(
            """
            SELECT id, username, display_name, role
            FROM app_users
            WHERE id = %s AND is_active = true
            """,
            (user_id,),
        )
        row = await cur.fetchone()

    if not row:
        return None

    capabilities = [capability.value for capability in get_capabilities_for_role(row["role"])]
    return AuthenticatedUser(
        id=str(row["id"]),
        username=str(row["username"]),
        name=str(row["display_name"]),
        role=str(row["role"]),
        capabilities=capabilities,
    )


async def list_users(conn: Any) -> list[AuthenticatedUser]:
    async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        await cur.execute(
            """
            SELECT id, username, display_name, role
            FROM app_users
            WHERE is_active = true
            ORDER BY
              CASE role
                WHEN 'admin' THEN 1
                WHEN 'manager' THEN 2
                WHEN 'operator' THEN 3
                WHEN 'viewer' THEN 4
                ELSE 5
              END,
              username ASC
            """,
        )
        rows = await cur.fetchall()

    users: list[AuthenticatedUser] = []
    for row in rows:
        capabilities = [capability.value for capability in get_capabilities_for_role(row["role"])]
        users.append(
            AuthenticatedUser(
                id=str(row["id"]),
                username=str(row["username"]),
                name=str(row["display_name"]),
                role=str(row["role"]),
                capabilities=capabilities,
            )
        )
    return users


def user_to_response(user: AuthenticatedUser) -> dict[str, Any]:
    return {
        "id": user.id,
        "username": user.username,
        "name": user.name,
        "role": user.role,
        "capabilities": user.capabilities,
    }


def _base64url_json(payload: dict[str, Any]) -> str:
    return base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")).decode("ascii").rstrip("=")


def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _sign(payload_segment: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), payload_segment.encode("ascii"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
