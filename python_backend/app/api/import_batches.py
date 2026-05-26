"""Import batches API endpoint (frontend-compatible path)."""
from fastapi import APIRouter

router = APIRouter(tags=["import"])

# Mock data for import batches
_mock_batches = [
    {
        "id": "batch-001",
        "entityType": "chemical",
        "source": "manual",
        "fileName": None,
        "status": "completed",
        "totalCount": 3,
        "successCount": 3,
        "failureCount": 0,
        "createdAt": "2026-04-28T10:00:00Z",
        "importedBy": "张三",
        "importedRecordIds": ["chem-001", "chem-002", "chem-003"],
        "generatedEventCount": 1,
        "errors": [],
    },
    {
        "id": "batch-002",
        "entityType": "equipment",
        "source": "excel",
        "fileName": "equipment_import_20260428.xlsx",
        "status": "completed",
        "totalCount": 3,
        "successCount": 3,
        "failureCount": 0,
        "createdAt": "2026-04-28T11:30:00Z",
        "importedBy": "李四",
        "importedRecordIds": ["equip-001", "equip-002", "equip-003"],
        "generatedEventCount": 1,
        "errors": [],
    },
]


@router.get("/import-batches")
async def list_import_batches() -> dict:
    """List import batches (frontend-compatible endpoint)."""
    return {"data": _mock_batches}
