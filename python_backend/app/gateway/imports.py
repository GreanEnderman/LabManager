from fastapi import APIRouter, Request

from app.gateway.dto import UnifiedBatchListDTO, UnifiedImportDTO
from app.imports.schemas import BatchImportResponse, BatchListResponse

router = APIRouter(prefix="/gateway/import", tags=["gateway"])


@router.post("/batch", response_model=UnifiedImportDTO)
async def gateway_batch_import(request: Request) -> UnifiedImportDTO:
    python_response = BatchImportResponse(
        batch_id="test",
        total_count=0,
        success_count=0,
        failed_count=0,
        status="pending",
        errors=[],
    )

    return UnifiedImportDTO(
        batchId=python_response.batch_id,
        totalCount=python_response.total_count,
        successCount=python_response.success_count,
        failedCount=python_response.failed_count,
        status=python_response.status,
        errors=[e.model_dump() for e in python_response.errors],
    )


@router.get("/batches", response_model=UnifiedBatchListDTO)
async def gateway_list_batches(operator: str | None = None, page: int = 1, pageSize: int = 20) -> UnifiedBatchListDTO:
    python_response = BatchListResponse(
        items=[],
        total=0,
        page=page,
        page_size=pageSize,
    )

    return UnifiedBatchListDTO(
        items=[],
        total=python_response.total,
        page=python_response.page,
        pageSize=python_response.page_size,
    )
