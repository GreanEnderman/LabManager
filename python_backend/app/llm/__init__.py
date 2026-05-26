"""LLM integration module for LabManager Python backend."""

from app.llm.factory import create_llm_service
from app.llm.service import (
    DisabledLLMService,
    LLMRecommendation,
    LLMReportNarrative,
    LLMService,
    OpenAICompatibleLLMService,
)

__all__ = [
    "LLMService",
    "LLMRecommendation",
    "LLMReportNarrative",
    "OpenAICompatibleLLMService",
    "DisabledLLMService",
    "create_llm_service",
]
