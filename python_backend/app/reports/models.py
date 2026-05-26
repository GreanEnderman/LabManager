"""Report domain models."""

from datetime import date, datetime
from typing import Any, Optional
from pydantic import BaseModel


# Repository record models
class TaskCompletionRecord(BaseModel):
    """Task completion record for reports."""

    task_id: str
    type: str
    status: str
    completed_at: datetime
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    priority: str
    risk_level: str


class ApprovalRecord(BaseModel):
    """Approval record for reports."""

    approval_id: str
    task_id: str
    status: str
    decided_at: datetime
    reviewer_id: Optional[str] = None
    reviewer_name: Optional[str] = None
    risk_level: str


class ActivityMetrics(BaseModel):
    """Activity metrics for reports."""

    total_actions: int
    by_type: dict[str, int]
    by_actor: dict[str, dict[str, Any]]


# Report data models
class ReportMetadata(BaseModel):
    operator: str
    timestamp: str
    run_id: str


class DailyReportData(BaseModel):
    date: date
    task_completions: int
    approvals: int
    metrics: dict[str, Any]
    metadata: ReportMetadata


class WeeklyReportData(BaseModel):
    start_date: date
    end_date: date
    task_completions: int
    approvals: int
    metrics: dict[str, Any]
    daily_breakdown: list[dict[str, Any]]
    metadata: ReportMetadata
