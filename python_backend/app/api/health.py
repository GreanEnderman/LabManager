from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

from app.db.health import get_dependency_health

health_router = APIRouter(prefix="/health", tags=["health"])


@health_router.get("/live")
def live() -> dict[str, str]:
    return {"status": "alive"}


@health_router.get("/ready")
def ready(request: Request) -> JSONResponse:
    settings = request.app.state.settings
    report = get_dependency_health(settings)
    http_status = status.HTTP_200_OK if report["ready"] else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(status_code=http_status, content=report)

