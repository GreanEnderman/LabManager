"""SLA domain models and DTOs."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.tasks.models import AITaskDTO, AuditActor, TaskActionDTO


class SLAConfig(BaseModel):
    """SLA configuration thresholds."""

    open_minutes: int
    in_progress_minutes: int
    pending_approval_minutes: int
    reminder_interval_minutes: int
    max_reminder_count_before_escalation: int


class TaskSLAInspectionItem(BaseModel):
    """Single task SLA inspection result."""

    task: AITaskDTO
    overdue_minutes: int
    threshold_minutes: int
    reminder_count: int
    should_remind: bool
    should_escalate: bool


class InspectTaskSLARequest(BaseModel):
    """Request to inspect tasks for SLA violations."""

    now: datetime
    config: SLAConfig


class InspectTaskSLAResponse(BaseModel):
    """Response from SLA inspection."""

    items: list[TaskSLAInspectionItem]


class ExecuteTaskSLARequest(BaseModel):
    """Request to execute SLA actions (reminders/escalations)."""

    now: datetime
    config: SLAConfig
    actor: AuditActor


class ExecuteTaskSLAResponse(BaseModel):
    """Response from SLA execution."""

    reminders: list[TaskActionDTO]
    escalations: list[TaskActionDTO]
