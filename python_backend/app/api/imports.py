"""Import batch management API endpoints.

NOTE: These endpoints are not directly used by the frontend.
Frontend accesses imports through the compatibility layer at /api/ai/imports/*.

These endpoints serve as:
1. Internal API for future direct integration
2. Reference implementation for the compatibility layer
3. Testing and development interface

See: docs/api-connection-analysis.md for connection mapping.
"""

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError as PydanticValidationError

from app.core.errors import not_found_error
from app.imports.schemas import (
    BatchDetailResponse,
    BatchImportResponse,
    BatchListResponse,
    ImportRecordResponse,
    ManualImportRequest,
)

router = APIRouter(prefix="/import", tags=["import"])

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


@router.post("/manual", response_model=ImportRecordResponse)
async def manual_import(request: ManualImportRequest) -> ImportRecordResponse:
    batch_id = str(uuid4())
    record_id = 1

    return ImportRecordResponse(
        record_id=record_id,
        batch_id=batch_id,
        status="success",
    )


@router.post("/batch", response_model=BatchImportResponse)
async def batch_import() -> BatchImportResponse:
    batch_id = str(uuid4())

    return BatchImportResponse(
        batch_id=batch_id,
        total_count=0,
        success_count=0,
        failed_count=0,
        status="pending",
        errors=[],
    )


@router.get("/batches", response_model=BatchListResponse)
async def list_batches(operator: str | None = None, page: int = 1, page_size: int = 20) -> BatchListResponse:
    return BatchListResponse(
        items=[],
        total=0,
        page=page,
        page_size=page_size,
    )


@router.get("/batches/{batch_id}", response_model=BatchDetailResponse)
async def get_batch_detail(batch_id: str) -> BatchDetailResponse:
    raise not_found_error("Batch", batch_id)
