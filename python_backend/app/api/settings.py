"""Settings API endpoints."""
from fastapi import APIRouter
from pydantic import BaseModel

from app.db import get_connection
from app.settings.service import SettingsService
from app.settings.models import (
    AISettings,
    ThresholdsSettings,
    ApprovalStrategySettings,
    SLASettings,
    SettingsPatch,
    UpdateSettingsRequest,
)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
async def get_settings() -> dict:
    """Get current AI settings."""
    async with get_connection() as conn:
        service = SettingsService(conn)
        settings = await service.get_settings()
        return {"data": settings.model_dump()}


@router.patch("")
async def update_settings(request: UpdateSettingsRequest) -> dict:
    """Update AI settings."""
    async with get_connection() as conn:
        service = SettingsService(conn)
        settings = await service.update_settings(
            patch=request.patch.model_dump(exclude_none=True),
            updated_by=request.updatedBy,
        )
        return {"data": {"settings": settings.model_dump()}}


@router.get("/history")
async def get_settings_history(limit: int = 10) -> dict:
    """Get settings history for audit trail."""
    async with get_connection() as conn:
        service = SettingsService(conn)
        history = await service.get_settings_history(limit=limit)
        return {"data": history}
