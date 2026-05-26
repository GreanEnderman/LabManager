"""Tests for Memory service."""

import pytest
from datetime import datetime, timezone

from app.memory.models import (
    CreateMemoryRequest,
    QueryMemoriesRequest,
    RelatedEntity,
)
from app.memory.service import MemoryService
from app.tasks.models import AuditActor


@pytest.mark.asyncio
async def test_create_memory(mock_db_connection):
    """Test creating a memory."""
    service = MemoryService(mock_db_connection)

    request = CreateMemoryRequest(
        memory_type="pattern",
        category="task_execution",
        context_key="restock_chemical_123",
        title="Successful restock pattern",
        summary="Chemical 123 restocking completed efficiently",
        insight="Restock requests for this chemical are typically approved within 2 hours",
        confidence_score=0.7,
        source_task_ids=["task-abc123"],
        source_event_ids=["event-xyz789"],
        related_entities=[
            RelatedEntity(
                source_type="chemical",
                source_id="123",
                source_name="Hydrochloric Acid"
            )
        ],
    )

    actor = AuditActor(id="test-user", name="Test User", type="user")

    memory = await service.create_memory(request, actor)

    assert memory.id.startswith("memory_")
    assert memory.memory_type == "pattern"
    assert memory.category == "task_execution"
    assert memory.context_key == "restock_chemical_123"
    assert memory.title == "Successful restock pattern"
    assert memory.confidence_score == 0.7
    assert memory.applied_count == 0
    assert memory.success_count == 0
    assert memory.failure_count == 0
    assert memory.created_by.id == "test-user"


@pytest.mark.asyncio
async def test_query_memories(mock_db_connection):
    """Test querying memories."""
    service = MemoryService(mock_db_connection)
    actor = AuditActor(id="system", name="System", type="system")

    # Create test memories
    for i in range(3):
        request = CreateMemoryRequest(
            memory_type="pattern",
            category="task_execution",
            context_key=f"restock_chemical_{i}",
            title=f"Pattern {i}",
            summary=f"Summary {i}",
            insight=f"Insight {i}",
            confidence_score=0.5 + (i * 0.1),
        )
        await service.create_memory(request, actor)

    # Query all memories
    query = QueryMemoriesRequest(
        category="task_execution",
        min_confidence=0.3,
        limit=10,
    )

    memories = await service.query_relevant_memories(query)

    assert len(memories) == 3
    # Should be sorted by confidence descending
    assert memories[0].confidence_score >= memories[1].confidence_score


@pytest.mark.asyncio
async def test_query_memories_by_context_key(mock_db_connection):
    """Test querying memories by context key."""
    service = MemoryService(mock_db_connection)
    actor = AuditActor(id="system", name="System", type="system")

    # Create memories with different context keys
    request1 = CreateMemoryRequest(
        memory_type="pattern",
        category="task_execution",
        context_key="restock_chemical_123",
        title="Pattern 1",
        summary="Summary 1",
        insight="Insight 1",
    )
    await service.create_memory(request1, actor)

    request2 = CreateMemoryRequest(
        memory_type="pattern",
        category="task_execution",
        context_key="restock_chemical_456",
        title="Pattern 2",
        summary="Summary 2",
        insight="Insight 2",
    )
    await service.create_memory(request2, actor)

    # Query by specific context key
    query = QueryMemoriesRequest(
        context_key="restock_chemical_123",
        category="task_execution",
    )

    memories = await service.query_relevant_memories(query)

    assert len(memories) == 1
    assert memories[0].context_key == "restock_chemical_123"
