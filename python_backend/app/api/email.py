from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.email import EmailService
from app.email.audit import create_send_record, update_send_record_status, get_send_history
from app.email.tasks import send_email_task
from app.email.validation import validate_email
from app.tasks.celery_app import celery_app
from app.db.postgres import get_db_connection

router = APIRouter(prefix="/api/email", tags=["email"])


class SendEmailRequest(BaseModel):
    to: str | list[str]
    subject: str
    body: str
    report_id: Optional[int] = None
    operator_id: Optional[int] = None


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[dict] = None


class SendHistoryQuery(BaseModel):
    report_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    recipient: Optional[str] = None


@router.post("/send")
async def send_email(request: SendEmailRequest):
    """Send email manually."""
    recipients = [request.to] if isinstance(request.to, str) else request.to

    for email in recipients:
        if not validate_email(email):
            raise HTTPException(status_code=400, detail=f"Invalid email: {email}")

    record_id = await create_send_record(
        recipients=', '.join(recipients),
        subject=request.subject,
        status="queued",
        operator_id=request.operator_id,
        report_id=request.report_id
    )

    task = send_email_task.apply_async(
        args=[request.to, request.subject, request.body]
    )

    await update_send_record_status(record_id, "sending")

    return {"task_id": task.id, "record_id": record_id, "status": "queued"}


@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """Query task status."""
    result = celery_app.AsyncResult(task_id)

    return TaskStatusResponse(
        task_id=task_id,
        status=result.status,
        result=result.result if result.ready() else None
    )


@router.post("/history")
async def query_send_history(query: SendHistoryQuery):
    """Query send history with filters."""
    records = await get_send_history(
        report_id=query.report_id,
        start_date=query.start_date,
        end_date=query.end_date,
        recipient=query.recipient
    )
    return {"records": records}


@router.post("/retry/{record_id}")
async def retry_failed_send(record_id: int):
    """Retry failed send."""
    async with get_db_connection() as conn:
        record = await conn.fetchrow(
            "SELECT * FROM email_send_records WHERE id = $1",
            record_id
        )

        if not record:
            raise HTTPException(status_code=404, detail="Send record not found")

        if record['status'] != 'failed':
            raise HTTPException(status_code=400, detail="Only failed sends can be retried")

        new_record_id = await create_send_record(
            recipients=record['recipients'],
            subject=record['subject'],
            status="queued",
            operator_id=record['operator_id'],
            report_id=record['report_id']
        )

        task = send_email_task.apply_async(
            args=[record['recipients'], record['subject'], "Retry"]
        )

        return {"task_id": task.id, "record_id": new_record_id, "original_record_id": record_id}
