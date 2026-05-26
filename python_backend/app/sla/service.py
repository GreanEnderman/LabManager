"""SLA service for monitoring and enforcing service level agreements."""

from datetime import datetime
from typing import Optional

from psycopg import AsyncConnection

from app.sla.models import (
    SLAConfig,
    TaskSLAInspectionItem,
    InspectTaskSLARequest,
    InspectTaskSLAResponse,
    ExecuteTaskSLARequest,
    ExecuteTaskSLAResponse,
)
from app.sla.repository import (
    list_tasks_for_sla_inspection,
    update_task_sla_metadata,
)
from app.tasks.models import (
    AITaskRecord,
    AITaskStatus,
    AITaskDTO,
    AuditActor,
    TaskActionDTO,
)
from app.tasks.repository import create_task_action


def _to_minutes(start_at: datetime, end_at: datetime) -> int:
    """Calculate minutes between two timestamps."""
    diff = (end_at - start_at).total_seconds()
    return max(0, int(diff / 60))


def _get_threshold_minutes(status: AITaskStatus, config: SLAConfig) -> Optional[int]:
    """Get SLA threshold for a given task status."""
    if status == "open":
        return config.open_minutes
    elif status == "in_progress":
        return config.in_progress_minutes
    elif status == "pending_approval":
        return config.pending_approval_minutes
    else:
        return None


def _get_reminder_count(task: AITaskRecord) -> int:
    """Extract reminder count from task metadata."""
    raw = task.metadata.get("slaReminderCount")
    return int(raw) if isinstance(raw, (int, float)) else 0


def _get_escalated(task: AITaskRecord) -> bool:
    """Check if task has been escalated."""
    return task.metadata.get("slaEscalated") == True


def _should_inspect_status(status: AITaskStatus) -> bool:
    """Check if status should be inspected for SLA."""
    return status in ("open", "in_progress", "pending_approval")


def _task_to_dto(task: AITaskRecord) -> AITaskDTO:
    """Convert task record to DTO."""
    return AITaskDTO(
        id=task.id,
        event_id=task.event_id,
        type=task.task_type,
        title=task.title,
        summary=task.summary,
        recommendation=task.recommendation,
        status=task.status,
        priority=task.priority,
        risk_level=task.risk_level,
        source_type=task.source_type,
        source_id=task.source_id,
        source_name=task.source_name,
        assignee_id=task.assignee_id,
        assignee_name=task.assignee_name,
        assignee_role=task.assignee_role,
        requires_approval=task.requires_approval,
        due_at=task.due_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
        closed_at=task.closed_at,
        metadata=task.metadata,
    )


def _inspect_task(
    task: AITaskRecord,
    request: InspectTaskSLARequest,
) -> Optional[TaskSLAInspectionItem]:
    """Inspect a single task for SLA violations."""
    if not _should_inspect_status(task.status):
        return None

    threshold_minutes = _get_threshold_minutes(task.status, request.config)
    if threshold_minutes is None:
        return None

    # Use updated_at if available, otherwise created_at
    started_at = task.updated_at or task.created_at
    overdue_minutes = _to_minutes(started_at, request.now)
    reminder_count = _get_reminder_count(task)
    escalated = _get_escalated(task)
    reached_threshold = overdue_minutes >= threshold_minutes

    should_remind = (
        reached_threshold
        and not escalated
        and reminder_count < request.config.max_reminder_count_before_escalation
    )

    should_escalate = (
        reached_threshold
        and not escalated
        and reminder_count >= request.config.max_reminder_count_before_escalation
    )

    if not reached_threshold:
        return None

    return TaskSLAInspectionItem(
        task=_task_to_dto(task),
        overdue_minutes=overdue_minutes,
        threshold_minutes=threshold_minutes,
        reminder_count=reminder_count,
        should_remind=should_remind,
        should_escalate=should_escalate,
    )


def _build_reminder_detail(task: AITaskRecord, overdue_minutes: int) -> str:
    """Build detail message for reminder action."""
    return f"Task {task.id} exceeded SLA by {overdue_minutes} minutes and requires reminder."


def _build_escalation_detail(task: AITaskRecord, overdue_minutes: int) -> str:
    """Build detail message for escalation action."""
    return f"Task {task.id} exceeded SLA by {overdue_minutes} minutes and has been escalated."


class SLAService:
    """Service for SLA monitoring and enforcement."""

    def __init__(self, conn: AsyncConnection):
        """Initialize SLA service.

        Args:
            conn: Database connection
        """
        self.conn = conn

    async def inspect(self, request: InspectTaskSLARequest) -> InspectTaskSLAResponse:
        """Inspect tasks for SLA violations.

        Args:
            request: Inspection request with current time and config

        Returns:
            Inspection response with list of tasks requiring action
        """
        # Fetch tasks that should be inspected
        statuses: list[AITaskStatus] = ["open", "in_progress"]
        tasks = await list_tasks_for_sla_inspection(self.conn, statuses)

        # Inspect each task
        items = []
        for task in tasks:
            item = _inspect_task(task, request)
            if item:
                items.append(item)

        # Sort by overdue minutes (most overdue first)
        items.sort(key=lambda x: x.overdue_minutes, reverse=True)

        return InspectTaskSLAResponse(items=items)

    async def execute(self, request: ExecuteTaskSLARequest) -> ExecuteTaskSLAResponse:
        """Execute SLA actions (send reminders, escalate tasks).

        Args:
            request: Execution request with current time, config, and actor

        Returns:
            Execution response with created reminders and escalations
        """
        # First inspect to find tasks requiring action
        inspection = await self.inspect(
            InspectTaskSLARequest(
                now=request.now,
                config=request.config,
            )
        )

        reminders: list[TaskActionDTO] = []
        escalations: list[TaskActionDTO] = []

        for item in inspection.items:
            if item.should_remind:
                # Increment reminder count
                new_reminder_count = item.reminder_count + 1
                metadata_patch = {
                    "slaReminderCount": new_reminder_count,
                    "slaLastReminderAt": request.now.isoformat(),
                    "lastSLAActorId": request.actor.id,
                    "lastSLAActorName": request.actor.name,
                    "lastSLAAt": request.now.isoformat(),
                }

                # Update task metadata
                await update_task_sla_metadata(
                    self.conn,
                    item.task.id,
                    metadata_patch,
                    request.now.isoformat(),
                )

                # Create activity log
                action_id = f"action_{item.task.id}_{int(request.now.timestamp())}_reminder"
                await create_task_action(
                    self.conn,
                    action_id=action_id,
                    task_id=item.task.id,
                    approval_id=None,
                    action_type="sla_reminder_sent",
                    from_status=item.task.status,
                    to_status=item.task.status,
                    actor=request.actor,
                    reason_codes=["sla_timeout", "sla_reminder_due"],
                    detail=_build_reminder_detail(
                        AITaskRecord(**item.task.model_dump()), item.overdue_minutes
                    ),
                    tool_name=None,
                    snapshot={
                        "overdueMinutes": item.overdue_minutes,
                        "thresholdMinutes": item.threshold_minutes,
                        "reminderCount": new_reminder_count,
                    },
                    created_at=request.now,
                )

                # Build action DTO for response
                action = TaskActionDTO(
                    id=action_id,
                    task_id=item.task.id,
                    approval_id=None,
                    action_type="sla_reminder_sent",
                    from_status=item.task.status,
                    to_status=item.task.status,
                    actor=request.actor,
                    reason_codes=["sla_timeout", "sla_reminder_due"],
                    detail=_build_reminder_detail(
                        AITaskRecord(**item.task.model_dump()), item.overdue_minutes
                    ),
                    tool_name=None,
                    snapshot={
                        "overdueMinutes": item.overdue_minutes,
                        "thresholdMinutes": item.threshold_minutes,
                        "reminderCount": new_reminder_count,
                    },
                    created_at=request.now,
                )
                reminders.append(action)

            elif item.should_escalate:
                # Mark as escalated
                metadata_patch = {
                    "slaEscalated": True,
                    "slaEscalatedAt": request.now.isoformat(),
                    "lastSLAActorId": request.actor.id,
                    "lastSLAActorName": request.actor.name,
                    "lastSLAAt": request.now.isoformat(),
                }

                # Update task metadata
                await update_task_sla_metadata(
                    self.conn,
                    item.task.id,
                    metadata_patch,
                    request.now.isoformat(),
                )

                # Create activity log
                action_id = f"action_{item.task.id}_{int(request.now.timestamp())}_escalate"
                await create_task_action(
                    self.conn,
                    action_id=action_id,
                    task_id=item.task.id,
                    approval_id=None,
                    action_type="task_escalated",
                    from_status=item.task.status,
                    to_status=item.task.status,
                    actor=request.actor,
                    reason_codes=["sla_timeout", "sla_escalated"],
                    detail=_build_escalation_detail(
                        AITaskRecord(**item.task.model_dump()), item.overdue_minutes
                    ),
                    tool_name=None,
                    snapshot={
                        "overdueMinutes": item.overdue_minutes,
                        "thresholdMinutes": item.threshold_minutes,
                        "reminderCount": item.reminder_count,
                    },
                    created_at=request.now,
                )

                # Build action DTO for response
                action = TaskActionDTO(
                    id=action_id,
                    task_id=item.task.id,
                    approval_id=None,
                    action_type="task_escalated",
                    from_status=item.task.status,
                    to_status=item.task.status,
                    actor=request.actor,
                    reason_codes=["sla_timeout", "sla_escalated"],
                    detail=_build_escalation_detail(
                        AITaskRecord(**item.task.model_dump()), item.overdue_minutes
                    ),
                    tool_name=None,
                    snapshot={
                        "overdueMinutes": item.overdue_minutes,
                        "thresholdMinutes": item.threshold_minutes,
                        "reminderCount": item.reminder_count,
                    },
                    created_at=request.now,
                )
                escalations.append(action)

        if reminders or escalations:
            await self.conn.commit()

        return ExecuteTaskSLAResponse(
            reminders=reminders,
            escalations=escalations,
        )
