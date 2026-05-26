import logging
import smtplib
from dataclasses import dataclass
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path
from typing import Optional

import psycopg

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ResolvedEmailSettings:
    smtp_host: str | None
    smtp_port: int | None
    smtp_user: str | None
    smtp_password: str | None
    smtp_from: str | None
    smtp_use_ssl: bool


def _runtime_email_settings() -> ResolvedEmailSettings:
    settings = get_settings()
    return ResolvedEmailSettings(
        smtp_host=settings.smtp_host,
        smtp_port=settings.smtp_port,
        smtp_user=settings.smtp_user,
        smtp_password=settings.smtp_password,
        smtp_from=settings.smtp_from,
        smtp_use_ssl=settings.smtp_use_ssl,
    )


def _resolve_email_settings() -> ResolvedEmailSettings:
    runtime_settings = get_settings()
    resolved = _runtime_email_settings()
    if not getattr(runtime_settings, "database_url", None):
        return resolved

    try:
        with psycopg.connect(runtime_settings.database_url) as conn:
            row = conn.execute(
                "SELECT smtp FROM system_settings WHERE setting_key = %s LIMIT 1",
                ("default",),
            ).fetchone()
    except Exception as exc:
        logger.warning("Failed to load SMTP settings from system settings: %s", exc)
        return resolved

    if not row or not row[0]:
        return resolved

    smtp = row[0]
    return ResolvedEmailSettings(
        smtp_host=smtp.get("smtpHost") or resolved.smtp_host,
        smtp_port=smtp.get("smtpPort") or resolved.smtp_port,
        smtp_user=smtp.get("smtpUser") or resolved.smtp_user,
        smtp_password=smtp.get("smtpPassword") or resolved.smtp_password,
        smtp_from=smtp.get("smtpFrom") or resolved.smtp_from,
        smtp_use_ssl=bool(smtp.get("smtpUseSsl", resolved.smtp_use_ssl)),
    )


class EmailService:
    def __init__(self):
        self.settings = _resolve_email_settings()

    def send_email(
        self,
        to: str | list[str],
        subject: str,
        body: str,
        attachments: Optional[list[Path]] = None
    ) -> bool:
        if not self.settings.smtp_host:
            logger.warning(f"SMTP not configured, logging email: {subject}")
            self._log_to_file(to, subject, body)
            return False

        msg = MIMEMultipart()
        msg['From'] = self.settings.smtp_from or self.settings.smtp_user
        msg['To'] = to if isinstance(to, str) else ', '.join(to)
        msg['Subject'] = subject

        msg.attach(MIMEText(body, 'html'))

        if attachments:
            for file_path in attachments:
                with open(file_path, 'rb') as f:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(f.read())
                encoders.encode_base64(part)
                part.add_header('Content-Disposition', f'attachment; filename={file_path.name}')
                msg.attach(part)

        port = self.settings.smtp_port or (465 if self.settings.smtp_use_ssl else 587)
        smtp_cls = smtplib.SMTP_SSL if self.settings.smtp_use_ssl or port == 465 else smtplib.SMTP
        with smtp_cls(self.settings.smtp_host, port, timeout=20) as server:
            if smtp_cls is smtplib.SMTP:
                server.starttls()
            if self.settings.smtp_user and self.settings.smtp_password:
                server.login(self.settings.smtp_user, self.settings.smtp_password)
            server.send_message(msg)

        logger.info(f"Email sent to {to}: {subject}")
        return True

    def _log_to_file(self, to: str | list[str], subject: str, body: str) -> None:
        log_dir = Path("logs/emails")
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / "emails.log"

        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"\n{'='*60}\n")
            f.write(f"To: {to}\n")
            f.write(f"Subject: {subject}\n")
            f.write(f"{'='*60}\n")
            f.write(f"{body}\n")
