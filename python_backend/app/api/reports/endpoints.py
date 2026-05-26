"""Report generation API endpoints.

NOTE: These endpoints are not directly used by the frontend.
Frontend accesses reports through the compatibility layer at /api/ai/reports/*.

These endpoints serve as:
1. Internal API for future direct integration
2. Async report generation via Celery
3. Testing and development interface

See: docs/api-connection-analysis.md for connection mapping.
"""

from datetime import date
from uuid import uuid4

from fastapi import APIRouter
from pydantic import BaseModel

from app.reports.dispatcher import submit_daily_report, submit_weekly_report
from app.reports.status import get_task_result, get_task_status

router = APIRouter(prefix="/api/reports", tags=["reports"])


class DailyReportRequest(BaseModel):
    date: date
    operator: str


class WeeklyReportRequest(BaseModel):
    start_date: date
    end_date: date
    operator: str


class ReportTaskResponse(BaseModel):
    task_id: str
    status: str
    mode: str | None = None
    fallback_reason: str | None = None
    result: dict | None = None


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    state: str
    ready: bool
    successful: bool | None
    result: dict | None = None


@router.post("/daily", response_model=ReportTaskResponse)
async def create_daily_report(request: DailyReportRequest):
    """Generate daily report, falling back to sync mode when Celery is unavailable."""
    run_id = str(uuid4())
    response = await submit_daily_report(
        request.date.isoformat(),
        request.operator,
        run_id,
    )
    return ReportTaskResponse(**response)


@router.post("/weekly", response_model=ReportTaskResponse)
async def create_weekly_report(request: WeeklyReportRequest):
    """Generate weekly report, falling back to sync mode when Celery is unavailable."""
    run_id = str(uuid4())
    response = await submit_weekly_report(
        request.start_date.isoformat(),
        request.end_date.isoformat(),
        request.operator,
        run_id,
    )
    return ReportTaskResponse(**response)


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_report_task_status(task_id: str):
    """Get status of async report generation task."""
    status = get_task_status(task_id)
    result = None
    if status["ready"] and status["successful"]:
        try:
            result = get_task_result(task_id)
        except Exception:
            pass
    return TaskStatusResponse(**status, result=result)
