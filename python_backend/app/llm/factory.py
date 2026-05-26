"""LLM service factory for creating LLM service instances.

This module provides a factory function for creating LLM service instances
based on application configuration.
"""

from app.core.config import get_settings
from app.llm.service import DisabledLLMService, LLMService, OpenAICompatibleLLMService


def create_llm_service() -> LLMService:
    """Create an LLM service instance based on configuration.

    Returns:
        LLMService instance (either OpenAICompatibleLLMService or DisabledLLMService)
    """
    settings = get_settings()

    # Check if LLM is configured (API key is required)
    llm_api_key = settings.llm_api_key

    if not llm_api_key:
        return DisabledLLMService()

    # Get LLM configuration
    llm_endpoint = settings.llm_endpoint or "https://api.openai.com/v1"
    llm_model = settings.llm_model or "gpt-4o-mini"
    llm_timeout_ms = getattr(settings, "llm_timeout_ms", 20000)

    # Convert timeout from milliseconds to seconds
    timeout_seconds = llm_timeout_ms // 1000

    return OpenAICompatibleLLMService(
        api_key=llm_api_key,
        base_url=llm_endpoint,
        model=llm_model,
        timeout=timeout_seconds,
    )


__all__ = ["create_llm_service"]
