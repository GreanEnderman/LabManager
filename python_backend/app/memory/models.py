"""Memory domain models and DTOs.

This module defines the data models for the AI Memory system, which allows
the AI employee to learn from historical experiences and optimize decisions.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from app.tasks.models import AuditActor


# Type definitions
MemoryType = Literal["pattern", "lesson", "optimization", "feedback"]
MemoryCategory = Literal[
    "task_execution", "approval_decision", "sla_handling", "resource_allocation"
]
ApplicationType = Literal["suggestion", "auto_applied", "rejected"]
ApplicationOutcome = Literal["success", "failure", "pending"]


class RelatedEntity(BaseModel):
    """Related entity reference in a memory."""

    source_type: str
    source_id: str
    source_name: str


class AIMemoryRecord(BaseModel):
    """Memory database record.

    Represents a learned experience or pattern that the AI employee
    can recall and apply to future situations.
    """

    id: str
    memory_type: MemoryType
    category: MemoryCategory
    context_key: str

    title: str
    summary: str
    insight: str
    confidence_score: float

    source_task_ids: list[str]
    source_event_ids: list[str]
    related_entities: list[RelatedEntity]

    applied_count: int
    success_count: int
    failure_count: int
    last_applied_at: Optional[datetime]

    created_by: AuditActor
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime]
    metadata: dict[str, Any]


class AIMemoryDTO(BaseModel):
    """Memory data transfer object for API responses."""

    id: str
    memory_type: MemoryType
    category: MemoryCategory
    context_key: str

    title: str
    summary: str
    insight: str
    confidence_score: float

    source_task_ids: list[str]
    source_event_ids: list[str]
    related_entities: list[RelatedEntity]

    applied_count: int
    success_count: int
    failure_count: int
    last_applied_at: Optional[datetime]

    created_by: AuditActor
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime]
    metadata: dict[str, Any]


class CreateMemoryRequest(BaseModel):
    """Request to create a new memory."""

    memory_type: MemoryType
    category: MemoryCategory
    context_key: str

    title: str
    summary: str
    insight: str
    confidence_score: float = 0.5

    source_task_ids: list[str] = Field(default_factory=list)
    source_event_ids: list[str] = Field(default_factory=list)
    related_entities: list[RelatedEntity] = Field(default_factory=list)

    expires_at: Optional[datetime] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class QueryMemoriesRequest(BaseModel):
    """Request to query memories with filters."""

    context_key: Optional[str] = None
    memory_type: Optional[MemoryType] = None
    category: Optional[MemoryCategory] = None
    min_confidence: float = 0.3
    limit: int = 10
    offset: int = 0


class UpdateMemoryStatsRequest(BaseModel):
    """Request to update memory application statistics."""

    applied: bool
    success: bool


class MemoryApplicationRecord(BaseModel):
    """Memory application log record.

    Tracks when and how a memory was applied, and the outcome.
    """

    id: str
    memory_id: str
    task_id: Optional[str]
    event_id: Optional[str]

    application_type: ApplicationType
    outcome: Optional[ApplicationOutcome]
    impact_score: Optional[float]

    actor: AuditActor
    detail: str
    created_at: datetime
    metadata: dict[str, Any]


class RecordMemoryApplicationRequest(BaseModel):
    """Request to record a memory application."""

    memory_id: str
    task_id: Optional[str] = None
    event_id: Optional[str] = None

    application_type: ApplicationType
    outcome: Optional[ApplicationOutcome] = None
    impact_score: Optional[float] = None

    detail: str
    metadata: dict[str, Any] = Field(default_factory=dict)


__all__ = [
    "MemoryType",
    "MemoryCategory",
    "ApplicationType",
    "ApplicationOutcome",
    "RelatedEntity",
    "AIMemoryRecord",
    "AIMemoryDTO",
    "CreateMemoryRequest",
    "QueryMemoriesRequest",
    "UpdateMemoryStatsRequest",
    "MemoryApplicationRecord",
    "RecordMemoryApplicationRequest",
]
