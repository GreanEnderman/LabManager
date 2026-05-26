"""Inventory API endpoints for chemicals and equipment."""
from fastapi import APIRouter

from app.db.postgres import get_db_connection
from app.inventory.service import InventoryService

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("/chemicals")
async def list_chemicals() -> dict:
    """List all chemicals in inventory."""
    async with get_db_connection() as conn:
        service = InventoryService(conn)
        chemicals = await service.list_chemicals()
        return {"data": chemicals}


@router.get("/equipment")
async def list_equipment() -> dict:
    """List all equipment assets."""
    async with get_db_connection() as conn:
        service = InventoryService(conn)
        equipment = await service.list_equipment()
        return {"data": equipment}
