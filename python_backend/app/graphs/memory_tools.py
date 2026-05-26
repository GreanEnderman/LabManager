"""Memory tool interfaces and adapters for LangGraph integration.

This module provides the tool layer for memory operations in the Supervisor Graph,
following the same pattern as TaskTool and ApprovalTool.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol
from uuid import uuid4

from app.memory.models import QueryMemoriesRequest
from app.memory.service import MemoryService
from app.tasks.models import AuditActor


class MemoryTool(Protocol):
    """Protocol for memory tool operations."""

    async def query_memories(
        self, context_key: str, category: str, min_confidence: float = 0.3
    ) -> list[dict[str, Any]]:
        """Query relevant memories.

        Args:
            context_key: Context key for retrieval
            category: Memory category
            min_confidence: Minimum confidence score

        Returns:
            List of memory dictionaries
        """
        ...

    async def create_memory(
        self, memory_data: dict[str, Any], actor: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Create a new memory.

        Args:
            memory_data: Memory data
            actor: Actor creating the memory

        Returns:
            Created memory dictionary
        """
        ...

    async def record_application(
        self,
        memory_id: str,
        task_id: str | None,
        event_id: str | None,
        outcome: str,
        actor: dict[str, Any] | None = None,
    ) -> None:
        """Record a memory application.

        Args:
            memory_id: Memory ID
            task_id: Task ID (if applicable)
            event_id: Event ID (if applicable)
            outcome: Application outcome
            actor: Actor recording the application
        """
        ...


@dataclass
class InMemoryMemoryTool:
    """In-memory memory tool for testing."""

    memories: list[dict[str, Any]] = field(default_factory=list)
    applications: list[dict[str, Any]] = field(default_factory=list)

    async def query_memories(
        self, context_key: str, category: str, min_confidence: float = 0.3
    ) -> list[dict[str, Any]]:
        """Query memories from in-memory storage."""
        results = []
        for memory in self.memories:
            if (
                memory.get("contextKey") == context_key
                and memory.get("category") == category
                and memory.get("confidenceScore", 0) >= min_confidence
            ):
                results.append(memory)

        # Sort by confidence score descending
        results.sort(key=lambda m: m.get("confidenceScore", 0), reverse=True)
        return results[:10]  # Limit to 10

    async def create_memory(
        self, memory_data: dict[str, Any], actor: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Create memory in in-memory storage."""
        memory = dict(memory_data)
        memory["id"] = memory.get("id") or f"memory_{uuid4().hex[:12]}"
        memory["appliedCount"] = 0
        memory["successCount"] = 0
        memory["failureCount"] = 0
        self.memories.append(memory)
        return memory

    async def record_application(
        self,
        memory_id: str,
        task_id: str | None,
        event_id: str | None,
        outcome: str,
        actor: dict[str, Any] | None = None,
    ) -> None:
        """Record application in in-memory storage."""
        application = {
            "id": f"app_{uuid4().hex[:12]}",
            "memoryId": memory_id,
            "taskId": task_id,
            "eventId": event_id,
            "outcome": outcome,
            "actor": actor or {"id": "system", "name": "System", "type": "system"},
        }
        self.applications.append(application)

        # Update memory stats
        for memory in self.memories:
            if memory["id"] == memory_id:
                memory["appliedCount"] = memory.get("appliedCount", 0) + 1
                if outcome == "success":
                    memory["successCount"] = memory.get("successCount", 0) + 1
                    memory["confidenceScore"] = min(
                        memory.get("confidenceScore", 0.5) + 0.05, 1.0
                    )
                elif outcome == "failure":
                    memory["failureCount"] = memory.get("failureCount", 0) + 1
                    memory["confidenceScore"] = max(
                        memory.get("confidenceScore", 0.5) - 0.1, 0.0
                    )
                break


class MemoryServiceMemoryTool:
    """Memory tool adapter backed by MemoryService."""

    def __init__(self, connection_factory: Any):
        """Initialize memory tool.

        Args:
            connection_factory: Factory function for database connections
        """
        self._connection_factory = connection_factory

    async def query_memories(
        self, context_key: str, category: str, min_confidence: float = 0.3
    ) -> list[dict[str, Any]]:
        """Query memories using MemoryService."""
        async with self._connection_factory() as conn:
            service = MemoryService(conn)
            query = QueryMemoriesRequest(
                context_key=context_key,
                category=category,
                min_confidence=min_confidence,
                limit=10,
            )
            memories = await service.query_relevant_memories(query)

        return [self._memory_to_dict(m) for m in memories]

    async def create_memory(
        self, memory_data: dict[str, Any], actor: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Create memory using MemoryService."""
        from app.memory.models import CreateMemoryRequest, RelatedEntity

        # Convert dict to CreateMemoryRequest
        related_entities = [
            RelatedEntity(**e) for e in memory_data.get("relatedEntities", [])
        ]

        request = CreateMemoryRequest(
            memory_type=memory_data.get("memoryType", "pattern"),
            category=memory_data.get("category", "task_execution"),
            context_key=memory_data["contextKey"],
            title=memory_data["title"],
            summary=memory_data["summary"],
            insight=memory_data["insight"],
            confidence_score=memory_data.get("confidenceScore", 0.5),
            source_task_ids=memory_data.get("sourceTaskIds", []),
            source_event_ids=memory_data.get("sourceEventIds", []),
            related_entities=related_entities,
            expires_at=None,
            metadata=memory_data.get("metadata", {}),
        )

        actor_obj = self._dict_to_actor(actor)

        async with self._connection_factory() as conn:
            service = MemoryService(conn)
            created = await service.create_memory(request, actor_obj)

        return self._memory_to_dict(created)

    async def record_application(
        self,
        memory_id: str,
        task_id: str | None,
        event_id: str | None,
        outcome: str,
        actor: dict[str, Any] | None = None,
    ) -> None:
        """Record application using MemoryService."""
        from app.memory.models import RecordMemoryApplicationRequest

        request = RecordMemoryApplicationRequest(
            memory_id=memory_id,
            task_id=task_id,
            event_id=event_id,
            application_type="auto_applied",
            outcome=outcome,
            detail=f"Memory applied to task {task_id or event_id}",
            metadata={},
        )

        actor_obj = self._dict_to_actor(actor)

        async with self._connection_factory() as conn:
            service = MemoryService(conn)
            await service.record_application(request, actor_obj)

    def _memory_to_dict(self, memory: Any) -> dict[str, Any]:
        """Convert memory DTO to dictionary."""
        return {
            "id": memory.id,
            "memoryType": memory.memory_type,
            "category": memory.category,
            "contextKey": memory.context_key,
            "title": memory.title,
            "summary": memory.summary,
            "insight": memory.insight,
            "confidenceScore": memory.confidence_score,
            "sourceTaskIds": memory.source_task_ids,
            "sourceEventIds": memory.source_event_ids,
            "relatedEntities": [e.model_dump() for e in memory.related_entities],
            "appliedCount": memory.applied_count,
            "successCount": memory.success_count,
            "failureCount": memory.failure_count,
            "lastAppliedAt": (
                memory.last_applied_at.isoformat().replace("+00:00", "Z")
                if memory.last_applied_at
                else None
            ),
            "createdBy": memory.created_by.model_dump(),
            "createdAt": memory.created_at.isoformat().replace("+00:00", "Z"),
            "updatedAt": memory.updated_at.isoformat().replace("+00:00", "Z"),
            "expiresAt": (
                memory.expires_at.isoformat().replace("+00:00", "Z")
                if memory.expires_at
                else None
            ),
            "metadata": memory.metadata,
        }

    def _dict_to_actor(self, actor: dict[str, Any] | None) -> AuditActor:
        """Convert dict to AuditActor."""
        if not actor:
            return AuditActor(id="system", name="System", type="system")
        return AuditActor(
            id=actor.get("id", "system"),
            name=actor.get("name", "System"),
            type=actor.get("type", "system"),
        )


__all__ = [
    "MemoryTool",
    "InMemoryMemoryTool",
    "MemoryServiceMemoryTool",
]
