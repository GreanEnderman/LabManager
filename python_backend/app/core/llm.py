from app.core.config import Settings


class LLMConfig:
    """LLM service configuration."""

    def __init__(self, settings: Settings):
        self.api_key = settings.llm_api_key
        self.endpoint = settings.llm_endpoint
        self.model = settings.llm_model

    def validate(self, is_development: bool = False) -> None:
        """
        Validate required LLM configuration.

        Args:
            is_development: If True, skip validation in development mode

        Raises:
            RuntimeError: If required configuration is missing in production
        """
        missing = []
        if not self.api_key:
            missing.append("LLM_API_KEY")
        if not self.endpoint:
            missing.append("LLM_ENDPOINT")
        if not self.model:
            missing.append("LLM_MODEL")

        if missing and not is_development:
            raise RuntimeError(
                f"Missing required LLM configuration: {', '.join(missing)}. "
                "Set these environment variables with LABMANAGER_PY_ prefix."
            )
