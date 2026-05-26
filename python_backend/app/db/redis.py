from collections.abc import Callable

from redis import Redis

from app.core.config import Settings


def get_redis_client_factory(settings: Settings) -> Callable[[], Redis]:
    if not settings.redis_url:
        raise ValueError("LABMANAGER_PY_REDIS_URL is required to create a Redis client")
    return lambda: Redis.from_url(settings.redis_url)


def get_redis_health(settings: Settings) -> dict[str, object]:
    if not settings.redis_url:
        return {
            "name": "redis",
            "ok": False,
            "required": settings.readiness_strict,
            "detail": "redis URL is not configured",
        }

    return {
        "name": "redis",
        "ok": True,
        "required": settings.readiness_strict,
        "detail": "redis connector configured",
    }

