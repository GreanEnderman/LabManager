import logging
from typing import Any, Callable

from psycopg import AsyncConnection

logger = logging.getLogger(__name__)


async def safe_query(
    conn: AsyncConnection,
    query_func: Callable,
    *args: Any,
    default: Any = None,
    source_name: str = "data source"
) -> Any:
    """Execute query with error handling."""
    try:
        return await query_func(conn, *args)
    except Exception as e:
        logger.error(f"Error querying {source_name}: {e}")
        try:
            await conn.rollback()
        except Exception:
            pass
        return default


async def aggregate_with_fallback(
    conn: AsyncConnection,
    queries: list[tuple[Callable, tuple, Any, str]]
) -> dict[str, Any]:
    """Aggregate data from multiple sources with fallback."""
    results = {}
    for query_func, args, default, key in queries:
        try:
            results[key] = await query_func(conn, *args)
        except Exception as e:
            logger.error(f"Error querying {key}: {e}")
            try:
                await conn.rollback()
            except Exception:
                pass
            results[key] = default
    return results
