"""Approval domain models and DTOs."""

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from app.tasks.models import AIRiskLevel, AuditActor


AIApprovalStatus = Literal["pending", "approved", "rejected", "needs_info"]
AIApprovalDecision = Literal["approve", "reject", "request_info"]


class AIApprovalRecord(BaseModel):
    """Approval persistence model."""

    id: str
    task_id: str
    title: str
    reason: str
    status: AIApprovalStatus
    risk_level: AIRiskLevel
    requested_by: AuditActor
    reviewer_id: Optional[str] = None
    reviewer_name: Optional[str] = None
    comment: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    decided_at: Optional[datetime] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AIApprovalDTO(BaseModel):
    """Approval DTO."""

    id: str
    task_id: str
    title: str
    reason: str
    status: AIApprovalStatus
    risk_level: AIRiskLevel
    requested_by: AuditActor
    reviewer_id: Optional[str] = None
    reviewer_name: Optional[str] = None
    comment: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    decided_at: Optional[datetime] = None
    metadata: dict[str, Any]


class CreateApprovalRequest(BaseModel):
    """Request to create an approval."""

    task_id: str
    title: str
    reason: str
    risk_level: AIRiskLevel
    requested_by: AuditActor
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProcessApprovalRequest(BaseModel):
    """Request to process an approval."""

    decision: AIApprovalDecision
    reviewer_id: str
    reviewer_name: str
    comment: Optional[str] = None

