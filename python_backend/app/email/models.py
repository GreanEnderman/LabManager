from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class EmailSendRecord(BaseModel):
    id: Optional[int] = None
    report_id: Optional[int] = None
    recipients: str
    subject: Optional[str] = None
    status: str
    error: Optional[str] = None
    operator_id: Optional[int] = None
    task_run_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
