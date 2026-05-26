"""Storage abstraction for unified data access.

This module provides a protocol-based storage abstraction that supports
both in-memory (development) and PostgreSQL (production) backends.
"""

from typing import Protocol, Optional, Any
from datetime import datetime

from app.tasks.models import AITaskRecord, AITaskStatus, ListTasksQuery
from app.approvals.models import AIApprovalRecord
from app.settings.models import AISettings


class AIStorage(Protocol):
    """Protocol for AI data storage backends.

    This protocol defines the interface that all storage backends must implement,
    allowing seamless switching between in-memory and PostgreSQL storage.
    """

    # Task operations
    async def list_tasks(self, query: ListTasksQuery) -> list[AITaskRecord]:
        """List tasks with optional filters."""
        ...

    async def get_task(self, task_id: str) -> Optional[AITaskRecord]:
        """Get task by ID."""
        ...

    async def create_task(self, task: AITaskRecord) -> AITaskRecord:
        """Create a new task."""
        ...

    async def update_task(self, task_id: str, updates: dict[str, Any]) -> Optional[AITaskRecord]:
        """Update task fields."""
        ...

    async def update_task_status(
        self, task_id: str, status: AITaskStatus, closed_at: Optional[datetime] = None
    ) -> bool:
        """Update task status."""
        ...

    # Approval operations
    async def list_approvals(self, task_id: Optional[str] = None) -> list[AIApprovalRecord]:
        """List approvals, optionally filtered by task."""
        ...

    async def get_approval(self, approval_id: str) -> Optional[AIApprovalRecord]:
        """Get approval by ID."""
        ...

    async def create_approval(self, approval: AIApprovalRecord) -> AIApprovalRecord:
        """Create a new approval."""
        ...

    async def update_approval(
        self, approval_id: str, updates: dict[str, Any]
    ) -> Optional[AIApprovalRecord]:
        """Update approval fields."""
        ...

    # Settings operations
    async def get_settings(self, setting_key: str = "default") -> Optional[AISettings]:
        """Get settings by key."""
        ...

    async def save_settings(self, setting_key: str, settings: AISettings) -> None:
        """Save settings."""
        ...

    # Utility operations
    async def clear_all(self) -> None:
        """Clear all data (for testing)."""
        ...
