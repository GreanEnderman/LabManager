"""Celery workflow monitoring API endpoints."""

import asyncio
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.tasks.celery_app import celery_app

router = APIRouter(prefix="/api/workflow", tags=["workflow"])

WORKFLOW_INSPECT_TIMEOUT_SECONDS = 0.5


class WorkerStatus(BaseModel):
    name: str
    status: str
    active_tasks: int
    processed: int
    pool: str


class ScheduledTask(BaseModel):
    name: str
    task: str
    schedule: str
    last_run: str | None
    next_run: str | None
    enabled: bool


class TaskExecution(BaseModel):
    task_id: str
    task_name: str
    state: str
    received: str | None
    started: str | None
    succeeded: str | None
    failed: str | None
    result: Any | None
    exception: str | None


class WorkflowStatus(BaseModel):
    workers: list[WorkerStatus]
    scheduled_tasks: list[ScheduledTask]
    recent_executions: list[TaskExecution]
    stats: dict[str, Any]


def _read_worker_statuses() -> list[WorkerStatus]:
    try:
        inspect = celery_app.control.inspect(timeout=WORKFLOW_INSPECT_TIMEOUT_SECONDS)
    except Exception:
        return []

    try:
        stats = inspect.stats() or {}
    except Exception:
        stats = {}

    try:
        active = inspect.active() or {}
    except Exception:
        active = {}

    workers: list[WorkerStatus] = []
    for worker_name in sorted(set(stats) | set(active)):
        worker_stats = stats.get(worker_name, {})
        total_by_task = worker_stats.get("total", {})
        processed = sum(total_by_task.values()) if isinstance(total_by_task, dict) else 0
        workers.append(
            WorkerStatus(
                name=worker_name,
                status="online",
                active_tasks=len(active.get(worker_name, [])),
                processed=processed,
                pool=worker_stats.get("pool", {}).get("implementation", "unknown"),
            )
        )
    return workers


def _read_scheduled_tasks() -> list[ScheduledTask]:
    scheduled_tasks: list[ScheduledTask] = []
    if not hasattr(celery_app.conf, "beat_schedule"):
        return scheduled_tasks

    for name, config in celery_app.conf.beat_schedule.items():
        schedule = config["schedule"]
        schedule_str = f"every {int(schedule)} seconds" if isinstance(schedule, (int, float)) else str(schedule)
        scheduled_tasks.append(
            ScheduledTask(
                name=name,
                task=config["task"],
                schedule=schedule_str,
                last_run=None,
                next_run=None,
                enabled=True,
            )
        )
    return scheduled_tasks


@router.get("/status", response_model=WorkflowStatus)
async def get_workflow_status():
    """Get automation workflow status without blocking the page on Celery inspect."""
    backfilled_reports: list[dict[str, Any]] = []
    try:
        from app.reports.backfill import backfill_missing_reports

        backfilled_reports = await backfill_missing_reports()
    except Exception:
        backfilled_reports = []

    workers = _read_worker_statuses()
    scheduled_tasks = _read_scheduled_tasks()
    recent_executions: list[TaskExecution] = []
    stats_data = {
        "total_workers": len(workers),
        "active_workers": len([worker for worker in workers if worker.status == "online"]),
        "total_scheduled_tasks": len(scheduled_tasks),
        "total_processed": sum(worker.processed for worker in workers),
        "backfilled_reports": len(backfilled_reports),
    }

    return WorkflowStatus(
        workers=workers,
        scheduled_tasks=scheduled_tasks,
        recent_executions=recent_executions,
        stats=stats_data,
    )


@router.post("/tasks/{task_name}/trigger")
async def trigger_task(task_name: str):
    """Manually trigger a scheduled workflow task."""
    try:
        if task_name == "reports.generate_daily":
            from app.reports.scheduled_tasks import generate_daily_report_scheduled

            result = await asyncio.to_thread(generate_daily_report_scheduled)
            return {
                "success": True,
                "task_id": result.get("report", {}).get("id"),
                "task_name": task_name,
                "state": "completed",
                "mode": "sync",
                "message": "Daily report task triggered successfully",
            }

        if task_name == "reports.generate_weekly":
            from app.reports.scheduled_tasks import generate_weekly_report_scheduled

            result = await asyncio.to_thread(generate_weekly_report_scheduled)
            return {
                "success": True,
                "task_id": result.get("report", {}).get("id"),
                "task_name": task_name,
                "state": "completed",
                "mode": "sync",
                "message": "Weekly report task triggered successfully",
            }

        task = celery_app.tasks.get(task_name)
        if not task:
            return {"success": False, "error": f"Task {task_name} not found"}

        if task_name == "rules.scan_and_execute":
            result = await asyncio.to_thread(task.apply, throw=False)
            return {
                "success": result.successful(),
                "task_id": result.id,
                "task_name": task_name,
                "state": result.state,
                "result": result.result if result.successful() else None,
                "error": str(result.result) if result.failed() else None,
                "message": "Rules scan executed successfully" if result.successful() else "Rules scan failed",
            }

        result = task.apply_async()
        return {
            "success": True,
            "task_id": result.id,
            "task_name": task_name,
            "message": "Task triggered successfully",
        }
    except Exception as exc:
        return {"success": False, "error": str(exc)}


@router.get("/tasks/{task_id}/result")
async def get_task_result(task_id: str):
    """Get a Celery task result."""
    try:
        result = celery_app.AsyncResult(task_id)
        return {
            "task_id": task_id,
            "state": result.state,
            "ready": result.ready(),
            "successful": result.successful() if result.ready() else None,
            "result": result.result if result.ready() and result.successful() else None,
            "traceback": result.traceback if result.failed() else None,
        }
    except Exception as exc:
        return {"error": str(exc)}
