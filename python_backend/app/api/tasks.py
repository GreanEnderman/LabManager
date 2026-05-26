"""Task management API endpoints.

NOTE: These endpoints are not directly used by the frontend.
Frontend accesses tasks through the compatibility layer at /api/ai/tasks/*.

These endpoints serve as:
1. Internal API for future direct integration
2. Reference implementation for the compatibility layer
3. Testing and development interface

See: docs/api-connection-analysis.md for connection mapping.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.errors import not_found_error, invalid_transition_error
from app.db.postgres import get_db_connection
from app.tasks.models import (
    AITaskDTO,
    AuditActor,
    CreateTaskRequest,
    ConfirmTaskCompletionReportRequest,
    UpdateTaskStatusRequest,
    AssignTaskRequest,
    ListTasksQuery,
    TaskDetailDTO,
    AITaskStatus,
    AITaskType,
    AIPriority,
    AISourceType,
)
from app.tasks.service import TaskService, TaskNotFoundError


router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def get_audit_actor(request: Request) -> AuditActor:
    """Extract audit actor from request."""
    # TODO: Implement proper authentication and extract from JWT token
    # For now, use audit middleware data
    audit = getattr(request.state, "audit", {})
    operator_id = audit.get("operator", "system")

    return AuditActor(
        id=operator_id,
        name=operator_id,
        type="user" if operator_id != "system" else "system",
    )


@router.get("", response_model=list[AITaskDTO])
async def list_tasks(
    status: Optional[AITaskStatus] = Query(None),
    type: Optional[AITaskType] = Query(None),
    priority: Optional[AIPriority] = Query(None),
    source_type: Optional[AISourceType] = Query(None),
    assignee_id: Optional[str] = Query(None),
):
    """List tasks with optional filters."""
    query = ListTasksQuery(
        status=status,
        type=type,
        priority=priority,
        source_type=source_type,
        assignee_id=assignee_id,
    )

    async with get_db_connection() as conn:
        service = TaskService(conn)
        return await service.list_tasks(query)


@router.get("/{task_id}", response_model=TaskDetailDTO)
async def get_task_detail(task_id: str):
    """Get detailed task information including actions."""
    async with get_db_connection() as conn:
        service = TaskService(conn)
        try:
            return await service.get_task_detail(task_id)
        except TaskNotFoundError as e:
            raise not_found_error("Task", task_id)


@router.post("", response_model=AITaskDTO, status_code=201)
async def create_task(
    request_body: CreateTaskRequest,
    request: Request,
):
    """Create a new task."""
    actor = get_audit_actor(request)

    async with get_db_connection() as conn:
        service = TaskService(conn)
        return await service.create_task(request_body, actor)


@router.patch("/{task_id}/status", response_model=AITaskDTO)
async def update_task_status(
    task_id: str,
    request_body: UpdateTaskStatusRequest,
    request: Request,
):
    """Update task status via state machine transition."""
    actor = get_audit_actor(request)

    async with get_db_connection() as conn:
        service = TaskService(conn)
        try:
            return await service.update_task_status(task_id, request_body, actor)
        except TaskNotFoundError as e:
            raise not_found_error("Task", task_id)
        except ValueError as e:
            raise invalid_transition_error(
                request_body.transition,
                "unknown"
            )


@router.patch("/{task_id}/assignee", response_model=AITaskDTO)
async def assign_task(
    task_id: str,
    request_body: AssignTaskRequest,
    request: Request,
):
    """Assign task to a user."""
    actor = get_audit_actor(request)

    async with get_db_connection() as conn:
        service = TaskService(conn)
        try:
            return await service.assign_task(task_id, request_body, actor)
        except TaskNotFoundError as e:
            raise not_found_error("Task", task_id)


@router.post("/{task_id}/completion-report", response_model=AITaskDTO)
async def confirm_completion_report(
    task_id: str,
    request_body: ConfirmTaskCompletionReportRequest,
    request: Request,
):
    """Upload a maintenance/repair report and complete the equipment task."""
    actor = get_audit_actor(request)

    async with get_db_connection() as conn:
        service = TaskService(conn)
        try:
            return await service.confirm_completion_report(task_id, request_body, actor)
        except TaskNotFoundError as e:
            raise not_found_error("Task", task_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
