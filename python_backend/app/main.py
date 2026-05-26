import sys
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Fix for Windows + Python 3.13 + psycopg compatibility (must be first)
if sys.platform == 'win32':
    import asyncio
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Fix GTK3 DLL loading on Windows (must be before any WeasyPrint imports)
try:
    from app.core.gtk_fix import *  # noqa: F401, F403
except ImportError:
    pass  # GTK fix not available, PDF functionality may not work

from app.api.middleware import AuditMiddleware
from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.validation import validate_startup_config

logger = logging.getLogger(__name__)


async def backfill_reports_on_startup() -> None:
    try:
        from app.reports.backfill import backfill_missing_reports

        generated = await backfill_missing_reports()
        if generated:
            logger.info("Backfilled %s missing scheduled reports on startup", len(generated))
    except Exception as exc:
        logger.warning("Skipped scheduled report backfill on startup: %s", exc)


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    validate_startup_config(settings)

    app = FastAPI(
        title=settings.app_name,
        description="""
LabManager backend API with dual-layer architecture:

- **/api/ai/*** - Frontend compatibility layer (PRODUCTION USE)
  - Maintains TypeScript backend contract
  - Supports gradual capability migration
  - Used by React frontend

- **/api/*** - Native Python endpoints (INTERNAL/FUTURE USE)
  - Direct access to Python services
  - Reference implementation
  - Development and testing

See /api/ai/health for capability routing status.
        """,
        version="0.1.0",
        docs_url="/docs" if settings.enable_docs else None,
        redoc_url="/redoc" if settings.enable_docs else None,
    )
    app.state.settings = settings

    # CORS middleware - allow frontend to access API
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://localhost:3002",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$" if settings.is_development else None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(AuditMiddleware)
    app.include_router(api_router)
    app.router.add_event_handler("startup", backfill_reports_on_startup)
    return app


app = create_app()
