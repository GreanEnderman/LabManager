"""Test data generator for comparison framework."""

from datetime import datetime
from typing import Any


class TestDataGenerator:
    """Generates test events for comparison."""

    def generate_task_event(self, task_id: str = "task-001") -> dict[str, Any]:
        """Generate task creation event."""
        return {
            "eventType": "task",
            "data": {
                "taskId": task_id,
                "title": "Test Task",
                "description": "Test description",
                "assignee": "user@example.com",
            },
            "audit": {
                "runId": "run-001",
                "operator": "system",
                "timestamp": datetime.now().isoformat(),
            },
        }

    def generate_approval_event(self, approval_id: str = "approval-001") -> dict[str, Any]:
        """Generate approval request event."""
        return {
            "eventType": "approval",
            "data": {
                "approvalId": approval_id,
                "taskId": "task-001",
                "approver": "manager@example.com",
                "status": "pending",
            },
            "audit": {
                "runId": "run-002",
                "operator": "system",
                "timestamp": datetime.now().isoformat(),
            },
        }

    def generate_activity_event(self, activity_id: str = "activity-001") -> dict[str, Any]:
        """Generate activity log event."""
        return {
            "eventType": "activity",
            "data": {
                "activityId": activity_id,
                "entityType": "task",
                "entityId": "task-001",
                "action": "created",
                "details": {"source": "api"},
            },
            "audit": {
                "runId": "run-003",
                "operator": "user@example.com",
                "timestamp": datetime.now().isoformat(),
            },
        }

    def generate_duplicate_sequence(self) -> list[dict[str, Any]]:
        """Generate sequence with duplicates for testing."""
        return [
            self.generate_task_event("task-dup"),
            self.generate_task_event("task-dup"),  # Duplicate
            self.generate_approval_event("approval-dup"),
            self.generate_approval_event("approval-dup"),  # Duplicate
        ]
