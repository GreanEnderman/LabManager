"""Event classifiers for rules engine."""

from typing import Any
from .models import (
    EventInput,
    TaskEventData,
    ApprovalEventData,
    ActivityEventData,
)


class EventClassifier:
    """Classifies and extracts metadata from events."""

    def classify_task(self, data: TaskEventData) -> dict[str, Any]:
        """Extract metadata from task event."""
        return {
            "taskId": data.task_id,
            "title": data.title,
            "description": data.description,
            "assignee": data.assignee,
        }

    def classify_approval(self, data: ApprovalEventData) -> dict[str, Any]:
        """Extract metadata from approval event."""
        return {
            "approvalId": data.approval_id,
            "taskId": data.task_id,
            "approver": data.approver,
            "status": data.status,
        }

    def classify_activity(self, data: ActivityEventData) -> dict[str, Any]:
        """Extract metadata from activity event."""
        return {
            "activityId": data.activity_id,
            "entityType": data.entity_type,
            "entityId": data.entity_id,
            "action": data.action,
            "details": data.details,
        }

    def route_event(self, event: EventInput) -> dict[str, Any]:
        """Route event to appropriate classifier."""
        if event.event_type == "task":
            return self.classify_task(event.data)
        elif event.event_type == "approval":
            return self.classify_approval(event.data)
        elif event.event_type == "activity":
            return self.classify_activity(event.data)
        else:
            raise ValueError(f"Unknown event type: {event.event_type}")
