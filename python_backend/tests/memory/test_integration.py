"""Integration tests for Memory system with Supervisor Graph."""

import pytest

from app.graphs.supervisor import run_supervisor_graph_async
from app.graphs.tools import InMemorySupervisorTools
from app.graphs.memory_tools import InMemoryMemoryTool


@pytest.mark.asyncio
async def test_memory_retrieval_in_supervisor_graph():
    """Test that memories are retrieved during graph execution."""
    # Setup tools with pre-existing memory
    tools = InMemorySupervisorTools()

    # Add a memory
    memory = {
        "id": "memory-test-123",
        "memoryType": "pattern",
        "category": "task_execution",
        "contextKey": "low_stock_chem-123",
        "title": "Successful restock pattern",
        "summary": "This chemical is typically restocked within 2 hours",
        "insight": "Approval is usually quick for this chemical",
        "confidenceScore": 0.8,
        "sourceTaskIds": ["task-old-123"],
        "sourceEventIds": ["event-old-456"],
        "relatedEntities": [
            {
                "sourceType": "chemical",
                "sourceId": "chem-123",
                "sourceName": "Test Chemical"
            }
        ],
        "appliedCount": 5,
        "successCount": 4,
        "failureCount": 1,
        "lastAppliedAt": None,
        "createdBy": {"id": "system", "name": "System", "type": "system"},
        "createdAt": "2026-05-01T00:00:00Z",
        "updatedAt": "2026-05-01T00:00:00Z",
        "expiresAt": None,
        "metadata": {},
    }
    tools.memories.append(memory)

    # Create event
    event = {
        "id": "event-123",
        "type": "low_stock",
        "sourceType": "chemical",
        "sourceId": "chem-123",
        "sourceName": "Test Chemical",
        "title": "Low stock alert",
        "summary": "Chemical stock below threshold",
        "priority": "medium",
        "riskLevel": "medium",
    }

    # Run graph
    result = await run_supervisor_graph_async(
        event=event,
        actor={"id": "test-user", "name": "Test User", "type": "user"},
        tools=tools,
    )

    # Verify memory was retrieved
    assert "retrievedMemories" in result
    assert len(result["retrievedMemories"]) == 1
    assert result["retrievedMemories"][0]["id"] == "memory-test-123"

    # Verify task was created
    assert result["output"]["taskId"] is not None


@pytest.mark.asyncio
async def test_memory_not_retrieved_for_different_context():
    """Test that memories are not retrieved for unrelated events."""
    tools = InMemorySupervisorTools()

    # Add a memory for a different chemical
    memory = {
        "id": "memory-test-456",
        "memoryType": "pattern",
        "category": "task_execution",
        "contextKey": "low_stock_chem-456",
        "title": "Different chemical pattern",
        "summary": "Different chemical",
        "insight": "Different insight",
        "confidenceScore": 0.8,
        "sourceTaskIds": [],
        "sourceEventIds": [],
        "relatedEntities": [],
        "appliedCount": 0,
        "successCount": 0,
        "failureCount": 0,
        "lastAppliedAt": None,
        "createdBy": {"id": "system", "name": "System", "type": "system"},
        "createdAt": "2026-05-01T00:00:00Z",
        "updatedAt": "2026-05-01T00:00:00Z",
        "expiresAt": None,
        "metadata": {},
    }
    tools.memories.append(memory)

    # Create event for different chemical
    event = {
        "id": "event-789",
        "type": "low_stock",
        "sourceType": "chemical",
        "sourceId": "chem-123",  # Different from memory
        "sourceName": "Test Chemical",
        "title": "Low stock alert",
        "summary": "Chemical stock below threshold",
        "priority": "medium",
        "riskLevel": "medium",
    }

    # Run graph
    result = await run_supervisor_graph_async(
        event=event,
        actor={"id": "test-user", "name": "Test User", "type": "user"},
        tools=tools,
    )

    # Verify no memories were retrieved
    assert "retrievedMemories" in result
    assert len(result["retrievedMemories"]) == 0


@pytest.mark.asyncio
async def test_memory_retrieval_filters_by_confidence():
    """Test that low-confidence memories are filtered out."""
    tools = InMemorySupervisorTools()

    # Add memories with different confidence scores
    high_confidence = {
        "id": "memory-high",
        "memoryType": "pattern",
        "category": "task_execution",
        "contextKey": "low_stock_chem-123",
        "title": "High confidence pattern",
        "summary": "High confidence",
        "insight": "High confidence insight",
        "confidenceScore": 0.9,
        "sourceTaskIds": [],
        "sourceEventIds": [],
        "relatedEntities": [],
        "appliedCount": 0,
        "successCount": 0,
        "failureCount": 0,
        "lastAppliedAt": None,
        "createdBy": {"id": "system", "name": "System", "type": "system"},
        "createdAt": "2026-05-01T00:00:00Z",
        "updatedAt": "2026-05-01T00:00:00Z",
        "expiresAt": None,
        "metadata": {},
    }

    low_confidence = {
        "id": "memory-low",
        "memoryType": "pattern",
        "category": "task_execution",
        "contextKey": "low_stock_chem-123",
        "title": "Low confidence pattern",
        "summary": "Low confidence",
        "insight": "Low confidence insight",
        "confidenceScore": 0.2,  # Below default threshold of 0.3
        "sourceTaskIds": [],
        "sourceEventIds": [],
        "relatedEntities": [],
        "appliedCount": 0,
        "successCount": 0,
        "failureCount": 0,
        "lastAppliedAt": None,
        "createdBy": {"id": "system", "name": "System", "type": "system"},
        "createdAt": "2026-05-01T00:00:00Z",
        "updatedAt": "2026-05-01T00:00:00Z",
        "expiresAt": None,
        "metadata": {},
    }

    tools.memories.extend([high_confidence, low_confidence])

    # Create event
    event = {
        "id": "event-123",
        "type": "low_stock",
        "sourceType": "chemical",
        "sourceId": "chem-123",
        "sourceName": "Test Chemical",
        "title": "Low stock alert",
        "summary": "Chemical stock below threshold",
        "priority": "medium",
        "riskLevel": "medium",
    }

    # Run graph
    result = await run_supervisor_graph_async(
        event=event,
        actor={"id": "test-user", "name": "Test User", "type": "user"},
        tools=tools,
    )

    # Verify only high-confidence memory was retrieved
    assert "retrievedMemories" in result
    assert len(result["retrievedMemories"]) == 1
    assert result["retrievedMemories"][0]["id"] == "memory-high"
