from collections.abc import Callable
from contextlib import asynccontextmanager
import sys

import psycopg

from app.core.config import Settings, get_settings

# Fix for Windows + Python 3.13 + psycopg compatibility
if sys.platform == 'win32':
    import asyncio
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


def get_postgres_connection_factory(settings: Settings) -> Callable[[], psycopg.Connection]:
    if not settings.database_url:
        raise ValueError("LABMANAGER_PY_DATABASE_URL is required to create a PostgreSQL connection")
    return lambda: psycopg.connect(settings.database_url)


@asynccontextmanager
async def get_db_connection():
    """Async context manager for database connections."""
    settings = get_settings()
    if not settings.database_url:
        raise ValueError("LABMANAGER_PY_DATABASE_URL is required to create a PostgreSQL connection")

    conn = await psycopg.AsyncConnection.connect(settings.database_url)
    try:
        yield conn
    finally:
        await conn.close()


def get_postgres_health(settings: Settings) -> dict[str, object]:
    if not settings.database_url:
        return {
            "name": "postgres",
            "ok": False,
            "required": settings.readiness_strict,
            "detail": "database URL is not configured",
        }

    return {
        "name": "postgres",
        "ok": True,
        "required": settings.readiness_strict,
        "detail": "database connector configured",
    }

