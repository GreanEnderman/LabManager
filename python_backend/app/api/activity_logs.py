"""Activity log API endpoints."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query, Depends
from pydantic import BaseModel

from app.db import get_connection
from app.activity_logs.service import ActivityLogService
from app.tasks.models import TaskActionDTO

router = APIRouter(prefix="/activity-logs", tags=["activity-logs"])


class ActivityLogListResponse(BaseModel):
    """Response for activity log list."""

    data: list[TaskActionDTO]
    total: int
    limit: int
    offset: int


@router.get("/tasks/{task_id}")
async def get_task_activity_logs(
    task_id: str,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> ActivityLogListResponse:
    """Get activity logs for a specific task.

    Args:
        task_id: Task ID
        limit: Maximum number of logs to return
        offset: Number of logs to skip

    Returns:
        List of activity logs
    """
    async with get_connection() as conn:
        service = ActivityLogService(conn)
        actions = await service.list_task_actions(task_id, limit, offset)

        return ActivityLogListResponse(
            data=actions,
            total=len(actions),
            limit=limit,
            offset=offset,
        )


@router.get("/approvals/{approval_id}")
async def get_approval_activity_logs(
    approval_id: str,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> ActivityLogListResponse:
    """Get activity logs for a specific approval.

    Args:
        approval_id: Approval ID
        limit: Maximum number of logs to return
        offset: Number of logs to skip

    Returns:
        List of activity logs
    """
    async with get_connection() as conn:
        service = ActivityLogService(conn)
        actions = await service.list_actions_by_approval(approval_id, limit, offset)

        return ActivityLogListResponse(
            data=actions,
            total=len(actions),
            limit=limit,
            offset=offset,
        )


@router.get("/actors/{actor_id}")
async def get_actor_activity_logs(
    actor_id: str,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> ActivityLogListResponse:
    """Get activity logs for a specific actor.

    Args:
        actor_id: Actor ID
        start_date: Start of date range (optional)
        end_date: End of date range (optional)
        limit: Maximum number of logs to return
        offset: Number of logs to skip

    Returns:
        List of activity logs
    """
    async with get_connection() as conn:
        service = ActivityLogService(conn)
        actions = await service.list_actions_by_actor(
            actor_id, start_date, end_date, limit, offset
        )

        return ActivityLogListResponse(
            data=actions,
            total=len(actions),
            limit=limit,
            offset=offset,
        )


@router.get("")
async def get_activity_logs(
    action_type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> ActivityLogListResponse:
    """Get activity logs with optional filters.

    Args:
        action_type: Filter by action type (optional)
        start_date: Start of date range (optional)
        end_date: End of date range (optional)
        limit: Maximum number of logs to return
        offset: Number of logs to skip

    Returns:
        List of activity logs
    """
    async with get_connection() as conn:
        service = ActivityLogService(conn)

        if action_type:
            actions = await service.list_actions_by_type(
                action_type, start_date, end_date, limit, offset
            )
        elif start_date and end_date:
            actions = await service.get_cross_task_activity(
                start_date, end_date, None, limit, offset
            )
        else:
            # Return empty list if no filters provided
            actions = []

        return ActivityLogListResponse(
            data=actions,
            total=len(actions),
            limit=limit,
            offset=offset,
        )
