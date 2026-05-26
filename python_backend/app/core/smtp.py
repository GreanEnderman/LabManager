import logging
from pathlib import Path

from app.core.config import Settings

logger = logging.getLogger(__name__)


class SMTPConfig:
    """SMTP service configuration."""

    def __init__(self, settings: Settings):
        self.host = settings.smtp_host
        self.port = settings.smtp_port
        self.user = settings.smtp_user
        self.password = settings.smtp_password
        self.from_address = settings.smtp_from
        self.use_ssl = settings.smtp_use_ssl
        self.is_development = settings.is_development

    def validate(self) -> None:
        """
        Validate SMTP configuration based on environment.

        In production: fail if configuration is incomplete.
        In development: allow incomplete configuration (will log to file).

        Raises:
            RuntimeError: If production configuration is incomplete
        """
        missing = []
        if not self.host:
            missing.append("SMTP_HOST")
        if not self.port:
            missing.append("SMTP_PORT")
        if not self.user:
            missing.append("SMTP_USER")
        if not self.password:
            missing.append("SMTP_PASSWORD")
        if not self.from_address:
            missing.append("SMTP_FROM")

        if missing:
            if self.is_development:
                logger.warning(
                    f"SMTP configuration incomplete in development mode: {', '.join(missing)}. "
                    "Emails will be logged to file instead."
                )
            else:
                raise RuntimeError(
                    f"Missing required SMTP configuration in production: {', '.join(missing)}. "
                    "Set these environment variables with LABMANAGER_PY_ prefix."
                )

    def log_email_to_file(self, to: str, subject: str, body: str) -> None:
        """Log email content to file (development fallback)."""
        log_dir = Path("logs/emails")
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / "emails.log"

        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"\n{'='*60}\n")
            f.write(f"To: {to}\n")
            f.write(f"From: {self.from_address or 'not-configured'}\n")
            f.write(f"Subject: {subject}\n")
            f.write(f"{'='*60}\n")
            f.write(f"{body}\n")

        logger.info(f"Email logged to {log_file}: {subject}")
