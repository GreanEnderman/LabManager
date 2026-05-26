"""Task management domain models and DTOs."""

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# Type aliases matching TS backend
AITaskType = Literal[
    "chemical_purchase",
    "equipment_maintenance",
    "equipment_repair",
    "restock",
    "maintenance",
    "inspection",
    "calibration",
    "disposal",
    "procurement",
    "training",
    "audit",
    "other",
]

AITaskStatus = Literal[
    "open",
    "in_progress",
    "blocked",
    "completed",
    "cancelled",
]

AIPriority = Literal["low", "medium", "high", "urgent"]
AIRiskLevel = Literal["low", "medium", "high", "critical"]
AISourceType = Literal["chemical", "equipment", "manual", "system"]


# Domain models
class AuditActor(BaseModel):
    """Actor information for audit trail."""

    id: str
    name: str
    type: Literal["user", "system", "agent"]


class AIEvidenceItem(BaseModel):
    """Evidence item for task."""

    type: str
    value: Any
    label: Optional[str] = None


class AITaskRecord(BaseModel):
    """Task database record."""

    id: str
    event_id: Optional[str] = None
    task_type: AITaskType = Field(alias="type")
    title: str
    summary: str
    recommendation: str
    status: AITaskStatus
    priority: AIPriority
    risk_level: AIRiskLevel
    source_type: AISourceType
    source_id: str
    source_name: str
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    assignee_role: Optional[str] = None
    requires_approval: bool = False
    due_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True


# API Request/Response DTOs
class ListTasksQuery(BaseModel):
    """Query parameters for listing tasks."""

    status: Optional[AITaskStatus] = None
    type: Optional[AITaskType] = None
    priority: Optional[AIPriority] = None
    source_type: Optional[AISourceType] = None
    assignee_id: Optional[str] = None


class AITaskDTO(BaseModel):
    """Task data transfer object."""

    id: str
    event_id: Optional[str] = None
    type: AITaskType
    title: str
    summary: str
    recommendation: str
    status: AITaskStatus
    priority: AIPriority
    risk_level: AIRiskLevel
    source_type: AISourceType
    source_id: str
    source_name: str
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    assignee_role: Optional[str] = None
    requires_approval: bool
    due_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    metadata: dict[str, Any]


class UpdateTaskStatusRequest(BaseModel):
    """Request to update task status."""

    transition: Literal[
        "start",
        "block",
        "unblock",
        "complete",
        "cancel",
        "reopen",
    ]
    reason: Optional[str] = None
    comment: Optional[str] = None


class AssignTaskRequest(BaseModel):
    """Request to assign task to user."""

    assignee_id: str
    assignee_name: str
    assignee_role: Optional[str] = None
    reason: Optional[str] = None


class ConfirmTaskCompletionReportRequest(BaseModel):
    """Report payload required to complete maintenance/repair tasks."""

    report_title: str
    report_file_name: Optional[str] = None
    report_content_type: Optional[str] = None
    report_storage_url: Optional[str] = None
    engineer_name: Optional[str] = None
    description: Optional[str] = None
    result: Optional[str] = None
    next_maintenance_at: Optional[datetime] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class CreateTaskRequest(BaseModel):
    """Request to create a new task."""

    event_id: Optional[str] = None
    type: AITaskType
    title: str
    summary: str
    recommendation: str
    priority: AIPriority
    risk_level: AIRiskLevel
    source_type: AISourceType
    source_id: str
    source_name: str
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    assignee_role: Optional[str] = None
    requires_approval: bool = False
    due_at: Optional[datetime] = None
    evidence: list[AIEvidenceItem] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TaskActionDTO(BaseModel):
    """Task action log DTO."""

    id: str
    task_id: str
    approval_id: Optional[str] = None
    action_type: str
    from_status: Optional[AITaskStatus] = None
    to_status: Optional[AITaskStatus] = None
    actor: AuditActor
    reason_codes: list[str]
    detail: str
    tool_name: Optional[str] = None
    snapshot: dict[str, Any]
    created_at: datetime


class TaskDetailDTO(BaseModel):
    """Detailed task information with actions."""

    task: AITaskDTO
    actions: list[TaskActionDTO]
    approval: Optional[Any] = None  # Will be typed when approval module is implemented
