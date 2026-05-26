from app.core.config import Settings
from app.db.migration_runner import connection_factory_from_settings
from app.db.postgres import get_postgres_health
from app.db.redis import get_redis_health
from app.db.schema_verifier import verify_schema


def get_schema_health(settings: Settings) -> dict[str, object]:
    if not settings.database_url:
        return {
            "name": "postgres_schema",
            "ok": False,
            "required": settings.readiness_strict,
            "detail": "database URL is not configured",
        }

    if not settings.schema_check_on_readiness:
        return {
            "name": "postgres_schema",
            "ok": False,
            "required": False,
            "detail": "schema verification is disabled for readiness; run python -m app.db.manage verify",
        }

    try:
        result = verify_schema(connection_factory_from_settings(settings))
    except Exception as exc:
        return {
            "name": "postgres_schema",
            "ok": False,
            "required": settings.readiness_strict,
            "detail": f"schema verification failed: {exc}",
        }

    return {
        "name": "postgres_schema",
        "ok": result.ok,
        "required": settings.readiness_strict,
        "detail": "formal schema verified" if result.ok else "formal schema incomplete",
        "errors": result.errors,
    }


def get_dependency_health(settings: Settings) -> dict[str, object]:
    config_errors: list[str] = []
    if not settings.database_url:
        config_errors.append("LABMANAGER_PY_DATABASE_URL is not set")
    if not settings.redis_url:
        config_errors.append("LABMANAGER_PY_REDIS_URL is not set")

    postgres = get_postgres_health(settings)
    schema = get_schema_health(settings)
    redis = get_redis_health(settings)
    failed_checks = [item["name"] for item in (postgres, schema, redis) if item["required"] and not item["ok"]]
    ready = not failed_checks and (not settings.readiness_strict or not config_errors)

    return {
        "status": "ready" if ready else "not_ready",
        "ready": ready,
        "environment": settings.app_env,
        "checks": [postgres, schema, redis],
        "configErrors": config_errors,
    }
