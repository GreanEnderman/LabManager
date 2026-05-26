"""In-memory storage implementation for development.

This module provides an in-memory storage backend that implements the AIStorage protocol.
It's useful for local development and testing without requiring PostgreSQL.
"""

import asyncio
from typing import Optional, Any
from datetime import datetime
from copy import deepcopy

from app.tasks.models import AITaskRecord, AITaskStatus, ListTasksQuery
from app.approvals.models import AIApprovalRecord
from app.settings.models import AISettings


class InMemoryAIStorage:
    """In-memory storage implementation matching production semantics."""

    def __init__(self):
        """Initialize in-memory storage."""
        self._tasks: dict[str, AITaskRecord] = {}
        self._approvals: dict[str, AIApprovalRecord] = {}
        self._settings: dict[str, AISettings] = {}
        self._lock = asyncio.Lock()

    async def list_tasks(self, query: ListTasksQuery) -> list[AITaskRecord]:
        """List tasks with optional filters."""
        async with self._lock:
            tasks = list(self._tasks.values())

            # Apply filters
            if query.status:
                tasks = [t for t in tasks if t.status == query.status]
            if query.type:
                tasks = [t for t in tasks if t.task_type == query.type]
            if query.priority:
                tasks = [t for t in tasks if t.priority == query.priority]
            if query.source_type:
                tasks = [t for t in tasks if t.source_type == query.source_type]
            if query.assignee_id:
                tasks = [t for t in tasks if t.assignee_id == query.assignee_id]

            # Sort by updated_at descending
            tasks.sort(key=lambda t: t.updated_at, reverse=True)

            return [deepcopy(t) for t in tasks]

    async def get_task(self, task_id: str) -> Optional[AITaskRecord]:
        """Get task by ID."""
        async with self._lock:
            task = self._tasks.get(task_id)
            return deepcopy(task) if task else None

    async def create_task(self, task: AITaskRecord) -> AITaskRecord:
        """Create a new task."""
        async with self._lock:
            self._tasks[task.id] = deepcopy(task)
            return deepcopy(task)

    async def update_task(
        self, task_id: str, updates: dict[str, Any]
    ) -> Optional[AITaskRecord]:
        """Update task fields."""
        async with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return None

            # Apply updates
            task_dict = task.model_dump()
            task_dict.update(updates)
            task_dict["updated_at"] = datetime.utcnow()

            updated_task = AITaskRecord(**task_dict)
            self._tasks[task_id] = updated_task
            return deepcopy(updated_task)

    async def update_task_status(
        self, task_id: str, status: AITaskStatus, closed_at: Optional[datetime] = None
    ) -> bool:
        """Update task status."""
        async with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return False

            task_dict = task.model_dump()
            task_dict["status"] = status
            task_dict["closed_at"] = closed_at
            task_dict["updated_at"] = datetime.utcnow()

            self._tasks[task_id] = AITaskRecord(**task_dict)
            return True

    async def list_approvals(
        self, task_id: Optional[str] = None
    ) -> list[AIApprovalRecord]:
        """List approvals, optionally filtered by task."""
        async with self._lock:
            approvals = list(self._approvals.values())

            if task_id:
                approvals = [a for a in approvals if a.task_id == task_id]

            # Sort by created_at descending
            approvals.sort(key=lambda a: a.created_at, reverse=True)

            return [deepcopy(a) for a in approvals]

    async def get_approval(self, approval_id: str) -> Optional[AIApprovalRecord]:
        """Get approval by ID."""
        async with self._lock:
            approval = self._approvals.get(approval_id)
            return deepcopy(approval) if approval else None

    async def create_approval(self, approval: AIApprovalRecord) -> AIApprovalRecord:
        """Create a new approval."""
        async with self._lock:
            self._approvals[approval.id] = deepcopy(approval)
            return deepcopy(approval)

    async def update_approval(
        self, approval_id: str, updates: dict[str, Any]
    ) -> Optional[AIApprovalRecord]:
        """Update approval fields."""
        async with self._lock:
            approval = self._approvals.get(approval_id)
            if not approval:
                return None

            # Apply updates
            approval_dict = approval.model_dump()
            approval_dict.update(updates)
            approval_dict["updated_at"] = datetime.utcnow()

            updated_approval = AIApprovalRecord(**approval_dict)
            self._approvals[approval_id] = updated_approval
            return deepcopy(updated_approval)

    async def get_settings(self, setting_key: str = "default") -> Optional[AISettings]:
        """Get settings by key."""
        async with self._lock:
            settings = self._settings.get(setting_key)
            return deepcopy(settings) if settings else None

    async def save_settings(self, setting_key: str, settings: AISettings) -> None:
        """Save settings."""
        async with self._lock:
            self._settings[setting_key] = deepcopy(settings)

    async def clear_all(self) -> None:
        """Clear all data (for testing)."""
        async with self._lock:
            self._tasks.clear()
            self._approvals.clear()
            self._settings.clear()
