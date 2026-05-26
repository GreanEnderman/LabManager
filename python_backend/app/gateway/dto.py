"""Unified DTO definitions for frontend API contract.

All DTOs use camelCase to match TypeScript frontend expectations.
These DTOs represent the canonical API contract between frontend and backend.
"""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


# Import DTOs
class UnifiedImportDTO(BaseModel):
    batchId: str
    totalCount: int
    successCount: int
    failedCount: int
    status: str
    errors: list[dict] = []


class UnifiedBatchHistoryDTO(BaseModel):
    batchId: str
    timestamp: datetime
    operator: str
    fileName: str
    totalCount: int
    successCount: int
    failedCount: int
    status: str


class UnifiedBatchListDTO(BaseModel):
    items: list[UnifiedBatchHistoryDTO]
    total: int
    page: int
    pageSize: int


# Task DTOs
class UnifiedTaskDTO(BaseModel):
    """Unified task DTO matching TypeScript AITaskDTO contract."""

    id: str
    eventId: Optional[str] = None
    type: str  # AITaskType
    title: str
    summary: str
    recommendation: str
    status: str  # AITaskStatus
    priority: str  # AIPriority
    riskLevel: str  # AIRiskLevel
    sourceType: str  # AISourceType
    sourceId: str
    sourceName: str
    assigneeId: Optional[str] = None
    assigneeName: Optional[str] = None
    assigneeRole: Optional[str] = None
    requiresApproval: bool
    dueAt: Optional[str] = None
    createdAt: str
    updatedAt: str
    closedAt: Optional[str] = None
    metadata: dict[str, Any]


# Approval DTOs
class UnifiedApprovalDTO(BaseModel):
    """Unified approval DTO matching TypeScript AIApprovalDTO contract."""

    id: str
    taskId: str
    title: str
    reason: str
    status: str  # AIApprovalStatus
    riskLevel: str  # AIRiskLevel
    requestedBy: dict[str, Any]  # AuditActor
    reviewerId: Optional[str] = None
    reviewerName: Optional[str] = None
    comment: Optional[str] = None
    createdAt: str
    updatedAt: str
    decidedAt: Optional[str] = None
    metadata: dict[str, Any]


# Task Action DTOs
class UnifiedTaskActionDTO(BaseModel):
    """Unified task action DTO matching TypeScript AITaskActionDTO contract."""

    id: str
    taskId: Optional[str] = None
    approvalId: Optional[str] = None
    actionType: str  # AIActionType
    fromStatus: Optional[str] = None  # AITaskStatus
    toStatus: Optional[str] = None  # AITaskStatus
    actor: dict[str, Any]  # AuditActor
    reasonCodes: list[str]  # ActionReasonCode[]
    detail: str
    toolName: Optional[str] = None
    snapshot: dict[str, Any]
    createdAt: str


# Settings DTOs
class UnifiedSettingsDTO(BaseModel):
    """Unified settings DTO matching TypeScript SystemSettingsDTO contract."""

    thresholds: dict[str, Any]
    approvalStrategy: dict[str, Any]
    sla: dict[str, Any]
    updatedAt: str


# API Envelope
class ApiErrorDTO(BaseModel):
    """API error response."""

    code: str
    message: str
    details: Optional[dict[str, Any]] = None


class PaginationMeta(BaseModel):
    """Pagination metadata."""

    total: int


class ApiEnvelope(BaseModel):
    """Generic API response envelope."""

    data: Any
    meta: Optional[PaginationMeta] = None
    error: Optional[ApiErrorDTO] = None

