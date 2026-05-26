"""Task state machine for managing task status transitions."""

from datetime import datetime
from typing import Literal, Optional

from app.tasks.models import AITaskRecord, AITaskStatus, AuditActor


TaskTransition = Literal[
    "start",
    "block",
    "unblock",
    "complete",
    "cancel",
    "reopen",
]


class TaskTransitionError(Exception):
    """Raised when an invalid task transition is attempted."""

    pass


# Define valid transitions: transition_name -> (allowed_from_statuses, target_status)
TASK_TRANSITIONS: dict[TaskTransition, tuple[list[AITaskStatus], AITaskStatus]] = {
    "start": (["open"], "in_progress"),
    "block": (["in_progress"], "blocked"),
    "unblock": (["blocked"], "in_progress"),
    "complete": (["in_progress"], "completed"),
    "cancel": (["open", "in_progress", "blocked"], "cancelled"),
    "reopen": (["completed", "cancelled"], "open"),
}


def can_transition(status: AITaskStatus, transition: TaskTransition) -> bool:
    """Check if a transition is valid from the current status."""
    allowed_from, _ = TASK_TRANSITIONS[transition]
    return status in allowed_from


def get_next_status(current_status: AITaskStatus, transition: TaskTransition) -> AITaskStatus:
    """Get the next status for a given transition."""
    allowed_from, target_status = TASK_TRANSITIONS[transition]

    if current_status not in allowed_from:
        raise TaskTransitionError(
            f"Cannot transition '{transition}' from status '{current_status}'. "
            f"Allowed from: {allowed_from}"
        )

    return target_status


def apply_transition(
    task: AITaskRecord,
    transition: TaskTransition,
    actor: AuditActor,
    at: datetime,
    detail: str,
) -> tuple[AITaskRecord, dict]:
    """
    Apply a state transition to a task.

    Returns:
        Tuple of (updated_task, action_log_data)
    """
    next_status = get_next_status(task.status, transition)

    # Determine closed_at timestamp
    closed_at = None
    if next_status in ["completed", "cancelled"]:
        closed_at = at
    elif next_status in ["open", "in_progress", "blocked"]:
        # Reopening or unblocking clears closed_at
        closed_at = None
    else:
        closed_at = task.closed_at

    # Create updated task
    updated_task = task.model_copy(
        update={
            "status": next_status,
            "updated_at": at,
            "closed_at": closed_at,
        }
    )

    # Build action log data
    action_type = _get_action_type(transition, next_status)
    action_log = {
        "task_id": task.id,
        "action_type": action_type,
        "from_status": task.status,
        "to_status": next_status,
        "actor": actor,
        "detail": detail,
        "reason_codes": [f"transition_{transition}"],
        "snapshot": {
            "transition": transition,
            "requires_approval": task.requires_approval,
        },
        "created_at": at,
    }

    return updated_task, action_log


def _get_action_type(transition: TaskTransition, next_status: AITaskStatus) -> str:
    """Determine the action type based on transition and resulting status."""
    if next_status in ["completed", "cancelled"]:
        return "task_closed"
    elif transition == "reopen":
        return "task_reopened"
    elif transition in ["start", "unblock"]:
        return "task_started"
    elif transition == "block":
        return "task_blocked"
    else:
        return "task_status_changed"
