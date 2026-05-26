"""Tests for LLM integration in Supervisor Graph and Report Generator."""

import pytest

from app.graphs.supervisor import run_supervisor_graph
from app.graphs.tools import InMemorySupervisorTools
from app.llm.service import DisabledLLMService, LLMRecommendation, LLMReportNarrative


class MockLLMService:
    """Mock LLM service for testing."""

    def __init__(self, should_fail: bool = False):
        self.should_fail = should_fail
        self.generate_recommendation_called = False
        self.generate_report_narrative_called = False

    async def generate_recommendation(self, event, context):
        """Mock recommendation generation."""
        self.generate_recommendation_called = True

        if self.should_fail:
            raise RuntimeError("Mock LLM failure")

        return LLMRecommendation(
            reason="AI-generated reason for the task",
            risk_summary="AI-generated risk assessment",
            action_summary="AI-generated action recommendations",
            meta={
                "llmUsed": True,
                "provider": "mock",
                "model": "mock-model",
            }
        )

    async def generate_report_narrative(self, report_data):
        """Mock report narrative generation."""
        self.generate_report_narrative_called = True

        if self.should_fail:
            raise RuntimeError("Mock LLM failure")

        return LLMReportNarrative(
            summary="AI-generated report summary",
            highlights=[
                "Key highlight 1",
                "Key highlight 2",
                "Key highlight 3",
            ],
            meta={
                "llmUsed": True,
                "provider": "mock",
                "model": "mock-model",
            }
        )

    async def generate_suggestions(self, retrospective_data):
        """Mock suggestions generation."""
        if self.should_fail:
            raise RuntimeError("Mock LLM failure")

        return [
            "Suggestion 1",
            "Suggestion 2",
            "Suggestion 3",
        ]


def test_supervisor_graph_uses_llm_for_recommendations():
    """Test that supervisor graph uses LLM service when provided."""
    tools = InMemorySupervisorTools()
    llm_service = MockLLMService()

    state = run_supervisor_graph(
        {
            "id": "event-llm-test",
            "type": "low_stock",
            "sourceType": "chemical",
            "sourceId": "chem-llm",
            "sourceName": "Test Chemical",
            "title": "Low stock",
            "summary": "Testing LLM integration.",
        },
        tools=tools,
        llm_service=llm_service,
    )

    # Verify LLM was called
    assert llm_service.generate_recommendation_called

    # Verify recommendation contains LLM-generated content
    assert state["recommendation"]["reason"] == "AI-generated reason for the task"
    assert state["recommendation"]["riskSummary"] == "AI-generated risk assessment"
    assert state["recommendation"]["actionSummary"] == "AI-generated action recommendations"

    # Verify LLM metadata is recorded
    task_metadata = state["taskDraft"]["metadata"]
    assert task_metadata["llmUsed"] is True
    assert task_metadata["llmProvider"] == "mock"
    assert task_metadata["llmModel"] == "mock-model"


def test_supervisor_graph_falls_back_on_llm_failure():
    """Test that supervisor graph falls back to templates when LLM fails."""
    tools = InMemorySupervisorTools()
    llm_service = MockLLMService(should_fail=True)

    state = run_supervisor_graph(
        {
            "id": "event-llm-fail-test",
            "type": "low_stock",
            "sourceType": "chemical",
            "sourceId": "chem-fail",
            "sourceName": "Test Chemical",
            "title": "Low stock",
            "summary": "Testing LLM fallback.",
        },
        tools=tools,
        llm_service=llm_service,
    )

    # Verify LLM was attempted
    assert llm_service.generate_recommendation_called

    # Verify fallback to template-based recommendation
    assert "Risk level is" in state["recommendation"]["riskSummary"]

    # Verify fallback metadata is recorded
    task_metadata = state["taskDraft"]["metadata"]
    assert task_metadata["llmUsed"] is False
    assert "llmFallbackReason" in task_metadata
    assert "Mock LLM failure" in task_metadata["llmFallbackReason"]


def test_supervisor_graph_works_without_llm_service():
    """Test that supervisor graph works without LLM service (template mode)."""
    tools = InMemorySupervisorTools()

    state = run_supervisor_graph(
        {
            "id": "event-no-llm-test",
            "type": "maintenance_overdue",
            "sourceType": "equipment",
            "sourceId": "equip-no-llm",
            "sourceName": "Test Equipment",
            "title": "Maintenance overdue",
            "summary": "Testing without LLM.",
        },
        tools=tools,
        llm_service=None,  # No LLM service
    )

    # Verify recommendation was generated (using templates)
    assert "recommendation" in state
    assert len(state["recommendation"]["reason"]) > 0

    # Verify LLM was not used
    task_metadata = state["taskDraft"]["metadata"]
    assert task_metadata["llmUsed"] is False


def test_disabled_llm_service_returns_template_recommendations():
    """Test that DisabledLLMService returns template-based recommendations."""
    llm_service = DisabledLLMService()
    tools = InMemorySupervisorTools()

    state = run_supervisor_graph(
        {
            "id": "event-disabled-llm-test",
            "type": "equipment_fault",
            "sourceType": "equipment",
            "sourceId": "equip-disabled",
            "sourceName": "Critical Equipment",
            "title": "Equipment fault",
            "summary": "Testing disabled LLM service.",
            "riskLevel": "high",
        },
        tools=tools,
        llm_service=llm_service,
    )

    # Verify recommendation was generated
    assert "recommendation" in state

    # Verify LLM metadata indicates it was not used
    # DisabledLLMService returns template content with llmUsed=False in meta
    task_metadata = state["taskDraft"]["metadata"]
    assert task_metadata["llmUsed"] is False
    # DisabledLLMService doesn't throw exceptions, so no fallbackReason is set


def test_llm_metadata_preserved_through_graph_execution():
    """Test that LLM metadata is preserved throughout graph execution."""
    tools = InMemorySupervisorTools()
    llm_service = MockLLMService()

    state = run_supervisor_graph(
        {
            "id": "event-metadata-test",
            "type": "low_stock",
            "sourceType": "chemical",
            "sourceId": "chem-metadata",
            "sourceName": "Test Chemical",
            "title": "Low stock",
            "summary": "Testing metadata preservation.",
        },
        tools=tools,
        llm_service=llm_service,
    )

    # Verify metadata in task draft
    task_draft_metadata = state["taskDraft"]["metadata"]
    assert task_draft_metadata["llmUsed"] is True
    assert task_draft_metadata["llmProvider"] == "mock"

    # Verify metadata in created task
    created_task = state["createdTask"]
    assert created_task["metadata"]["llmUsed"] is True
    assert created_task["metadata"]["llmProvider"] == "mock"


def test_different_event_types_use_llm():
    """Test that all event types can use LLM for recommendations."""
    event_types = [
        ("low_stock", "chemical", "restock"),
        ("maintenance_overdue", "equipment", "maintenance"),
        ("equipment_fault", "equipment", "anomaly_review"),
    ]

    for event_type, source_type, expected_task_type in event_types:
        tools = InMemorySupervisorTools()
        llm_service = MockLLMService()

        state = run_supervisor_graph(
            {
                "id": f"event-{event_type}-test",
                "type": event_type,
                "sourceType": source_type,
                "sourceId": f"source-{event_type}",
                "sourceName": f"Test {source_type}",
                "title": f"{event_type} event",
                "summary": f"Testing {event_type} with LLM.",
            },
            tools=tools,
            llm_service=llm_service,
        )

        # Verify LLM was used
        assert llm_service.generate_recommendation_called
        assert state["taskDraft"]["metadata"]["llmUsed"] is True
        assert state["taskDraft"]["type"] == expected_task_type


@pytest.mark.asyncio
async def test_mock_llm_service_generate_report_narrative():
    """Test MockLLMService report narrative generation."""
    llm_service = MockLLMService()

    narrative = await llm_service.generate_report_narrative({
        "type": "daily",
        "date": "2024-01-01",
        "stats": {"tasks": 10, "approvals": 5},
    })

    assert llm_service.generate_report_narrative_called
    assert narrative.summary == "AI-generated report summary"
    assert len(narrative.highlights) == 3
    assert narrative.meta["llmUsed"] is True


@pytest.mark.asyncio
async def test_disabled_llm_service_generate_report_narrative():
    """Test DisabledLLMService report narrative generation."""
    llm_service = DisabledLLMService()

    narrative = await llm_service.generate_report_narrative({
        "type": "daily",
        "date": "2024-01-01",
        "stats": {"totalTasks": 10, "completedTasks": 8},
    })

    assert narrative.summary.startswith("This daily report")
    assert len(narrative.highlights) > 0
    assert narrative.meta["llmUsed"] is False
    assert narrative.meta["fallbackReason"] == "LLM disabled or unavailable"
