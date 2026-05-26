import logging
from pathlib import Path
from typing import Optional

from celery import shared_task

from app.email import EmailService

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_email_task(
    self,
    to: str | list[str],
    subject: str,
    body: str,
    attachment_paths: Optional[list[str]] = None
) -> dict:
    try:
        email_service = EmailService()
        attachments = [Path(p) for p in attachment_paths] if attachment_paths else None
        email_service.send_email(to, subject, body, attachments)
        return {"status": "sent", "to": to, "subject": subject}
    except Exception as exc:
        logger.error(f"Email send failed: {exc}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 60)
