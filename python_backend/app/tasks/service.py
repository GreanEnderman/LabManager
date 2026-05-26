"""Task service layer for business logic."""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from psycopg import AsyncConnection
from psycopg.types.json import Json

from app.tasks.models import (
    AITaskRecord,
    AITaskDTO,
    AuditActor,
    CreateTaskRequest,
    ConfirmTaskCompletionReportRequest,
    UpdateTaskStatusRequest,
    AssignTaskRequest,
    ListTasksQuery,
    TaskDetailDTO,
)
from app.tasks.repository import (
    list_tasks,
    get_task_by_id,
    create_task,
    update_task_status,
    update_task_assignee,
    list_task_actions,
    create_task_action,
    update_task_metadata,
)
from app.tasks.state_machine import apply_transition, TaskTransitionError


class TaskNotFoundError(Exception):
    """Raised when a task is not found."""

    pass


class TaskService:
    """Service for managing tasks."""

    def __init__(self, conn: AsyncConnection):
        self.conn = conn

    async def list_tasks(self, query: ListTasksQuery) -> list[AITaskDTO]:
        """List tasks with optional filters."""
        tasks = await list_tasks(self.conn, query)
        return [self._to_dto(task) for task in tasks]

    async def get_task_detail(self, task_id: str) -> TaskDetailDTO:
        """Get detailed task information including actions."""
        task = await get_task_by_id(self.conn, task_id)
        if not task:
            raise TaskNotFoundError(f"Task {task_id} not found")

        actions = await list_task_actions(self.conn, task_id)

        return TaskDetailDTO(
            task=self._to_dto(task),
            actions=actions,
            approval=None,  # TODO: Implement when approval module is ready
        )

    async def create_task(
        self,
        request: CreateTaskRequest,
        actor: AuditActor,
    ) -> AITaskDTO:
        """Create a new task."""
        now = datetime.utcnow()
        task_id = f"task_{uuid4().hex[:12]}"

        # Build metadata with evidence
        metadata = request.metadata.copy()
        metadata["evidence"] = [item.model_dump() for item in request.evidence]

        task_record = AITaskRecord(
            id=task_id,
            event_id=request.event_id,
            type=request.type,
            title=request.title,
            summary=request.summary,
            recommendation=request.recommendation,
            status="open",
            priority=request.priority,
            risk_level=request.risk_level,
            source_type=request.source_type,
            source_id=request.source_id,
            source_name=request.source_name,
            assignee_id=request.assignee_id,
            assignee_name=request.assignee_name,
            assignee_role=request.assignee_role,
            requires_approval=request.requires_approval,
            due_at=request.due_at,
            created_at=now,
            updated_at=now,
            closed_at=None,
            metadata=metadata,
        )

        created_task = await create_task(self.conn, task_record)

        # Create action log for task creation
        action_id = f"action_{uuid4().hex[:12]}"
        await create_task_action(
            self.conn,
            action_id=action_id,
            task_id=created_task.id,
            approval_id=None,
            action_type="task_created",
            from_status=None,
            to_status="open",
            actor=actor,
            reason_codes=["manual_request"],
            detail=request.summary,
            tool_name=None,
            snapshot={"requires_approval": request.requires_approval},
            created_at=now,
        )

        await self.conn.commit()
        return self._to_dto(created_task)

    async def update_task_status(
        self,
        task_id: str,
        request: UpdateTaskStatusRequest,
        actor: AuditActor,
    ) -> AITaskDTO:
        """Update task status via state machine transition."""
        task = await get_task_by_id(self.conn, task_id)
        if not task:
            raise TaskNotFoundError(f"Task {task_id} not found")

        now = datetime.utcnow()
        detail = request.comment or f"Task status transition: {request.transition}"

        try:
            updated_task, action_log = apply_transition(
                task=task,
                transition=request.transition,
                actor=actor,
                at=now,
                detail=detail,
            )
        except TaskTransitionError as e:
            raise ValueError(str(e)) from e

        # Update task in database
        await update_task_status(
            self.conn,
            task_id=task_id,
            status=updated_task.status,
            closed_at=updated_task.closed_at,
        )

        # Create action log
        action_id = f"action_{uuid4().hex[:12]}"
        await create_task_action(
            self.conn,
            action_id=action_id,
            task_id=action_log["task_id"],
            approval_id=None,
            action_type=action_log["action_type"],
            from_status=action_log["from_status"],
            to_status=action_log["to_status"],
            actor=action_log["actor"],
            reason_codes=action_log["reason_codes"],
            detail=action_log["detail"],
            tool_name=None,
            snapshot=action_log["snapshot"],
            created_at=action_log["created_at"],
        )

        return self._to_dto(updated_task)

    async def assign_task(
        self,
        task_id: str,
        request: AssignTaskRequest,
        actor: AuditActor,
    ) -> AITaskDTO:
        """Assign task to a user."""
        task = await get_task_by_id(self.conn, task_id)
        if not task:
            raise TaskNotFoundError(f"Task {task_id} not found")

        now = datetime.utcnow()

        # Update assignee
        await update_task_assignee(
            self.conn,
            task_id=task_id,
            assignee_id=request.assignee_id,
            assignee_name=request.assignee_name,
            assignee_role=request.assignee_role,
        )

        # Create action log
        action_id = f"action_{uuid4().hex[:12]}"
        detail = request.reason or f"Task assigned to {request.assignee_name}"
        await create_task_action(
            self.conn,
            action_id=action_id,
            task_id=task_id,
            approval_id=None,
            action_type="task_assigned",
            from_status=None,
            to_status=None,
            actor=actor,
            reason_codes=["manual_assignment"],
            detail=detail,
            tool_name=None,
            snapshot={
                "assignee_id": request.assignee_id,
                "assignee_name": request.assignee_name,
                "assignee_role": request.assignee_role,
            },
            created_at=now,
        )

        # Fetch updated task
        updated_task = await get_task_by_id(self.conn, task_id)
        return self._to_dto(updated_task)

    async def confirm_completion_report(
        self,
        task_id: str,
        request: ConfirmTaskCompletionReportRequest,
        actor: AuditActor,
    ) -> AITaskDTO:
        """Attach a maintenance/repair report, update equipment, and complete the task."""
        task = await get_task_by_id(self.conn, task_id)
        if not task:
            raise TaskNotFoundError(f"Task {task_id} not found")
        if task.task_type not in {"equipment_maintenance", "equipment_repair", "maintenance"}:
            raise ValueError("Completion reports are only supported for equipment tasks.")
        if task.source_type != "equipment":
            raise ValueError("Completion reports require an equipment source.")

        now = datetime.utcnow()
        maintenance_type = "repair" if task.task_type == "equipment_repair" else "routine"
        report_id = f"maintenance_report_{uuid4().hex[:12]}"
        next_maintenance_date = request.next_maintenance_at.date() if request.next_maintenance_at else None

        await self.conn.execute(
            """
            INSERT INTO equipment_maintenance_records (
                id, equipment_id, maintenance_type, maintenance_date, engineer_name,
                description, result, next_maintenance_date, task_id, report_title,
                report_file_name, report_content_type, report_storage_url,
                confirmed_by, confirmed_at, metadata
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                report_id,
                task.source_id,
                maintenance_type,
                now.date(),
                request.engineer_name or actor.name,
                request.description,
                request.result,
                next_maintenance_date,
                task.id,
                request.report_title,
                request.report_file_name,
                request.report_content_type,
                request.report_storage_url,
                Json(actor.model_dump()),
                now,
                Json(request.metadata),
            ),
        )

        equipment_status = "正常" if maintenance_type == "repair" else "正常"
        await self.conn.execute(
            """
            UPDATE equipment
            SET status = %s,
                last_maintenance_at = %s,
                next_maintenance_at = COALESCE(%s, next_maintenance_at),
                updated_at = now()
            WHERE id = %s
            """,
            (equipment_status, now.date(), next_maintenance_date, task.source_id),
        )

        metadata = dict(task.metadata or {})
        metadata["completionReport"] = {
            "id": report_id,
            "title": request.report_title,
            "fileName": request.report_file_name,
            "storageUrl": request.report_storage_url,
            "confirmedAt": now.isoformat(),
            "confirmedBy": actor.model_dump(),
        }
        await update_task_metadata(self.conn, task.id, metadata)
        await update_task_status(self.conn, task_id=task.id, status="completed", closed_at=now)

        await create_task_action(
            self.conn,
            action_id=f"action_{uuid4().hex[:12]}",
            task_id=task.id,
            approval_id=None,
            action_type="completion_report_uploaded",
            from_status=task.status,
            to_status="completed",
            actor=actor,
            reason_codes=["completion_report_uploaded", f"{maintenance_type}_completed"],
            detail=f"Completion report {report_id} uploaded for {task.source_name}.",
            tool_name="task_service",
            snapshot={"report_id": report_id, "equipment_id": task.source_id},
            created_at=now,
        )

        updated_task = await get_task_by_id(self.conn, task_id)
        return self._to_dto(updated_task)

    def _to_dto(self, task: AITaskRecord) -> AITaskDTO:
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
