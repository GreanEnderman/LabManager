"""Memory service for business logic.

This module provides the service layer for the AI Memory system,
handling business logic and coordinating between repository and API layers.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from psycopg import AsyncConnection

from app.memory.models import (
    AIMemoryDTO,
    AIMemoryRecord,
    CreateMemoryRequest,
    MemoryApplicationRecord,
    QueryMemoriesRequest,
    RecordMemoryApplicationRequest,
)
from app.memory.repository import (
    create_memory,
    get_memory_applications,
    get_memory_by_id,
    query_memories,
    record_memory_application,
    update_memory_stats,
)
from app.tasks.models import AuditActor


class MemoryService:
    """Service for managing AI memories."""

    def __init__(self, conn: AsyncConnection):
        """Initialize memory service.

        Args:
            conn: Database connection
        """
        self.conn = conn

    async def create_memory(
        self, request: CreateMemoryRequest, actor: AuditActor
    ) -> AIMemoryDTO:
        """Create a new memory.

        Args:
            request: Memory creation request
            actor: Actor creating the memory

        Returns:
            Created memory DTO
        """
        now = datetime.now(timezone.utc)
        memory_id = f"memory_{uuid4().hex[:12]}"

        memory_record = AIMemoryRecord(
            id=memory_id,
            memory_type=request.memory_type,
            category=request.category,
            context_key=request.context_key,
            title=request.title,
            summary=request.summary,
            insight=request.insight,
            confidence_score=request.confidence_score,
            source_task_ids=request.source_task_ids,
            source_event_ids=request.source_event_ids,
            related_entities=request.related_entities,
            applied_count=0,
            success_count=0,
            failure_count=0,
            last_applied_at=None,
            created_by=actor,
            created_at=now,
            updated_at=now,
            expires_at=request.expires_at,
            metadata=request.metadata,
        )

        created = await create_memory(self.conn, memory_record)
        return self._to_dto(created)

    async def get_memory(self, memory_id: str) -> Optional[AIMemoryDTO]:
        """Get a memory by ID.

        Args:
            memory_id: Memory ID

        Returns:
            Memory DTO if found, None otherwise
        """
        memory = await get_memory_by_id(self.conn, memory_id)
        return self._to_dto(memory) if memory else None

    async def query_relevant_memories(
        self, query: QueryMemoriesRequest
    ) -> list[AIMemoryDTO]:
        """Query relevant memories based on filters.

        Args:
            query: Query parameters

        Returns:
            List of matching memory DTOs
        """
        memories = await query_memories(self.conn, query)
        return [self._to_dto(m) for m in memories]

    async def apply_memory(
        self,
        memory_id: str,
        task_id: Optional[str],
        event_id: Optional[str],
        actor: AuditActor,
        detail: str,
    ) -> None:
        """Record that a memory was applied.

        Args:
            memory_id: Memory ID
            task_id: Task ID (if applicable)
            event_id: Event ID (if applicable)
            actor: Actor applying the memory
            detail: Description of how the memory was applied
        """
        now = datetime.now(timezone.utc)
        application_id = f"app_{uuid4().hex[:12]}"

        application = MemoryApplicationRecord(
            id=application_id,
            memory_id=memory_id,
            task_id=task_id,
            event_id=event_id,
            application_type="auto_applied",
            outcome="pending",
            impact_score=None,
            actor=actor,
            detail=detail,
            created_at=now,
            metadata={},
        )

        await record_memory_application(self.conn, application)
        await update_memory_stats(self.conn, memory_id, applied=True, success=False, now=now)

    async def record_outcome(
        self,
        memory_id: str,
        task_id: str,
        success: bool,
        impact_score: Optional[float] = None,
    ) -> None:
        """Record the outcome of a memory application.

        Args:
            memory_id: Memory ID
            task_id: Task ID
            success: Whether the application was successful
            impact_score: Impact score (-1 to 1)
        """
        now = datetime.now(timezone.utc)

        # Update memory statistics
        await update_memory_stats(self.conn, memory_id, applied=False, success=success, now=now)

        # Update the most recent application record for this task
        # Note: This is a simplified implementation
        # In production, you might want to track application IDs more explicitly

    async def record_application(
        self, request: RecordMemoryApplicationRequest, actor: AuditActor
    ) -> None:
        """Record a memory application event.

        Args:
            request: Application record request
            actor: Actor recording the application
        """
        now = datetime.now(timezone.utc)
        application_id = f"app_{uuid4().hex[:12]}"

        application = MemoryApplicationRecord(
            id=application_id,
            memory_id=request.memory_id,
            task_id=request.task_id,
            event_id=request.event_id,
            application_type=request.application_type,
            outcome=request.outcome,
            impact_score=request.impact_score,
            actor=actor,
            detail=request.detail,
            created_at=now,
            metadata=request.metadata,
        )

        await record_memory_application(self.conn, application)

        # Update memory stats if outcome is provided
        if request.outcome:
            success = request.outcome == "success"
            await update_memory_stats(
                self.conn,
                request.memory_id,
                applied=True,
                success=success,
                now=now,
            )

    async def get_application_history(
        self, memory_id: str, limit: int = 50
    ) -> list[MemoryApplicationRecord]:
        """Get application history for a memory.

        Args:
            memory_id: Memory ID
            limit: Maximum number of records to return

        Returns:
            List of application records
        """
        return await get_memory_applications(self.conn, memory_id, limit)

    def _to_dto(self, memory: AIMemoryRecord) -> AIMemoryDTO:
        """Convert memory record to DTO.

        Args:
            memory: Memory record

        Returns:
            Memory DTO
        """
        return AIMemoryDTO(
            id=memory.id,
            memory_type=memory.memory_type,
            category=memory.category,
            context_key=memory.context_key,
            title=memory.title,
            summary=memory.summary,
            insight=memory.insight,
            confidence_score=memory.confidence_score,
            source_task_ids=memory.source_task_ids,
            source_event_ids=memory.source_event_ids,
            related_entities=memory.related_entities,
            applied_count=memory.applied_count,
            success_count=memory.success_count,
            failure_count=memory.failure_count,
            last_applied_at=memory.last_applied_at,
            created_by=memory.created_by,
            created_at=memory.created_at,
            updated_at=memory.updated_at,
            expires_at=memory.expires_at,
            metadata=memory.metadata,
        )


__all__ = ["MemoryService"]
