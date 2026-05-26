"""Database and cache runtime hooks."""

import asyncio
from contextlib import asynccontextmanager
import sys
from typing import AsyncGenerator

import psycopg
from psycopg import AsyncConnection

from app.core.config import get_settings

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


@asynccontextmanager
async def get_connection() -> AsyncGenerator[AsyncConnection, None]:
    """Get database connection as async context manager.

    Usage:
        async with get_connection() as conn:
            # Use conn here
            pass

    Yields:
        AsyncConnection: Database connection
    """
    settings = get_settings()

    if not settings.database_url:
        raise RuntimeError("DATABASE_URL not configured")

    async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
        yield conn
