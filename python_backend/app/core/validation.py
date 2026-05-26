import logging

from app.core.config import Settings
from app.core.fonts import find_font_path
from app.core.llm import LLMConfig
from app.core.smtp import SMTPConfig

logger = logging.getLogger(__name__)


class ConfigValidator:
    """Validates external dependency configuration at startup."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.errors: list[str] = []

    def validate_all(self) -> None:
        """
        Validate all external dependencies.

        Raises:
            RuntimeError: If any critical validation fails
        """
        self._validate_pdf_fonts()
        self._validate_llm()
        self._validate_smtp()

        if self.errors:
            error_msg = "Configuration validation failed:\n" + "\n".join(
                f"  - {err}" for err in self.errors
            )
            raise RuntimeError(error_msg)

        logger.info("All external dependency configuration validated successfully")

    def _validate_pdf_fonts(self) -> None:
        """Validate PDF font configuration."""
        try:
            font_path = find_font_path(self.settings.pdf_font_path)
            logger.info(f"PDF fonts available at: {font_path}")
        except RuntimeError as e:
            self.errors.append(f"PDF fonts: {e}")

    def _validate_llm(self) -> None:
        """Validate LLM configuration."""
        try:
            llm_config = LLMConfig(self.settings)
            llm_config.validate(is_development=self.settings.is_development)
            if self.settings.is_development and not all([
                self.settings.llm_api_key,
                self.settings.llm_endpoint,
                self.settings.llm_model
            ]):
                logger.warning("LLM configuration incomplete in development mode. LLM features will be unavailable.")
            else:
                logger.info("LLM configuration validated")
        except RuntimeError as e:
            self.errors.append(f"LLM: {e}")

    def _validate_smtp(self) -> None:
        """Validate SMTP configuration."""
        try:
            smtp_config = SMTPConfig(self.settings)
            smtp_config.validate()
            logger.info("SMTP configuration validated")
        except RuntimeError as e:
            self.errors.append(f"SMTP: {e}")


def validate_startup_config(settings: Settings) -> None:
    """
    Validate configuration at application startup.

    Args:
        settings: Application settings

    Raises:
        RuntimeError: If validation fails
    """
    validator = ConfigValidator(settings)
    validator.validate_all()
