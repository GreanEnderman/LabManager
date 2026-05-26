"""Pydantic models for rules engine."""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class AuditContext(BaseModel):
    """Audit context for event tracking."""
    run_id: str = Field(..., alias="runId")
    operator: str
    timestamp: datetime


class TaskEventData(BaseModel):
    """Task creation event data."""
    task_id: str = Field(..., alias="taskId")
    title: str
    description: str | None = None
    assignee: str | None = None


class ApprovalEventData(BaseModel):
    """Approval request event data."""
    approval_id: str = Field(..., alias="approvalId")
    task_id: str = Field(..., alias="taskId")
    approver: str
    status: Literal["pending", "approved", "rejected"]


class ActivityEventData(BaseModel):
    """Activity log event data."""
    activity_id: str = Field(..., alias="activityId")
    entity_type: str = Field(..., alias="entityType")
    entity_id: str = Field(..., alias="entityId")
    action: str
    details: dict | None = None


class EventInput(BaseModel):
    """Input event with audit context."""
    event_type: Literal["task", "approval", "activity"] = Field(..., alias="eventType")
    data: TaskEventData | ApprovalEventData | ActivityEventData
    audit: AuditContext

    class Config:
        populate_by_name = True


class EventOutput(BaseModel):
    """Output event with classification and audit."""
    event_type: str = Field(..., alias="eventType")
    metadata: dict
    audit: AuditContext
    deduplicated: bool = False

    class Config:
        populate_by_name = True
