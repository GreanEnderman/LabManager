from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class ImportRecordBase(BaseModel):
    operator: str = Field(..., min_length=1, max_length=255)
    reason: str | None = None
    run_id: str = Field(..., min_length=1, max_length=64)


class ManualImportRequest(ImportRecordBase):
    data: dict = Field(..., description="Record data to import")


class BatchImportRequest(BaseModel):
    operator: str = Field(..., min_length=1, max_length=255)
    reason: str | None = None
    run_id: str = Field(..., min_length=1, max_length=64)


class ValidationError(BaseModel):
    field_path: str
    error_code: str
    message: str


class ImportRecordResponse(BaseModel):
    record_id: int
    batch_id: str
    status: str


class BatchImportResponse(BaseModel):
    batch_id: str
    total_count: int
    success_count: int
    failed_count: int
    status: str
    errors: list[ValidationError] = []


class BatchHistoryItem(BaseModel):
    batch_id: str
    timestamp: datetime
    operator: str
    file_name: str
    total_count: int
    success_count: int
    failed_count: int
    status: str


class BatchDetailResponse(BatchHistoryItem):
    errors: list[dict] = []


class BatchListResponse(BaseModel):
    items: list[BatchHistoryItem]
    total: int
    page: int
    page_size: int
