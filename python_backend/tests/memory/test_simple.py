"""Simple test to verify memory integration."""

import pytest


def test_memory_module_imports():
    """Test that memory module can be imported."""
    from app.memory.models import AIMemoryDTO, CreateMemoryRequest
    from app.memory.service import MemoryService
    from app.graphs.memory_tools import InMemoryMemoryTool
    
    assert AIMemoryDTO is not None
    assert CreateMemoryRequest is not None
    assert MemoryService is not None
    assert InMemoryMemoryTool is not None


@pytest.mark.asyncio
async def test_in_memory_tool_basic():
    """Test InMemoryMemoryTool basic operations."""
    from app.graphs.memory_tools import InMemoryMemoryTool
    
    tool = InMemoryMemoryTool()
    
    # Create a memory
    memory_data = {
        "contextKey": "test_context",
        "category": "task_execution",
        "title": "Test Memory",
        "summary": "Test summary",
        "insight": "Test insight",
        "confidenceScore": 0.8,
    }
    
    created = await tool.create_memory(memory_data)
    assert created["id"].startswith("memory_")
    assert created["contextKey"] == "test_context"
    
    # Query the memory
    results = await tool.query_memories("test_context", "task_execution")
    assert len(results) == 1
    assert results[0]["id"] == created["id"]
