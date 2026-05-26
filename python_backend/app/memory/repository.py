"""Memory repository for database operations.

This module provides data access functions for the AI Memory system,
following the repository pattern used throughout the application.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from psycopg import AsyncConnection

from app.memory.models import (
    AIMemoryRecord,
    MemoryApplicationRecord,
    QueryMemoriesRequest,
    RelatedEntity,
)
from app.tasks.models import AuditActor


async def create_memory(
    conn: AsyncConnection, memory: AIMemoryRecord
) -> AIMemoryRecord:
    """Create a new memory record.

    Args:
        conn: Database connection
        memory: Memory record to create

    Returns:
        Created memory record
    """
    sql = """
        INSERT INTO ai_memories (
            id, memory_type, category, context_key,
            title, summary, insight, confidence_score,
            source_task_ids, source_event_ids, related_entities,
            applied_count, success_count, failure_count, last_applied_at,
            created_by, created_at, updated_at, expires_at, metadata
        ) VALUES (
            %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s, %s
        )
        RETURNING *
    """

    related_entities_json = [e.model_dump() for e in memory.related_entities]

    async with conn.cursor() as cur:
        await cur.execute(
            sql,
            (
                memory.id,
                memory.memory_type,
                memory.category,
                memory.context_key,
                memory.title,
                memory.summary,
                memory.insight,
                memory.confidence_score,
                memory.source_task_ids,
                memory.source_event_ids,
                related_entities_json,
                memory.applied_count,
                memory.success_count,
                memory.failure_count,
                memory.last_applied_at,
                memory.created_by.model_dump(),
                memory.created_at,
                memory.updated_at,
                memory.expires_at,
                memory.metadata,
            ),
        )
        row = await cur.fetchone()

    return _row_to_memory(row)


async def get_memory_by_id(
    conn: AsyncConnection, memory_id: str
) -> Optional[AIMemoryRecord]:
    """Get a memory by ID.

    Args:
        conn: Database connection
        memory_id: Memory ID

    Returns:
        Memory record if found, None otherwise
    """
    sql = """
        SELECT * FROM ai_memories
        WHERE id = %s
    """

    async with conn.cursor() as cur:
        await cur.execute(sql, (memory_id,))
        row = await cur.fetchone()

    return _row_to_memory(row) if row else None


async def query_memories(
    conn: AsyncConnection, query: QueryMemoriesRequest
) -> list[AIMemoryRecord]:
    """Query memories with filters.

    Args:
        conn: Database connection
        query: Query parameters

    Returns:
        List of matching memory records
    """
    conditions = []
    params = []

    # Build WHERE clause
    if query.context_key:
        conditions.append("context_key = %s")
        params.append(query.context_key)

    if query.memory_type:
        conditions.append("memory_type = %s")
        params.append(query.memory_type)

    if query.category:
        conditions.append("category = %s")
        params.append(query.category)

    conditions.append("confidence_score >= %s")
    params.append(query.min_confidence)

    # Filter out expired memories
    conditions.append("(expires_at IS NULL OR expires_at > NOW())")

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    sql = f"""
        SELECT * FROM ai_memories
        {where_clause}
        ORDER BY confidence_score DESC, created_at DESC
        LIMIT %s OFFSET %s
    """

    params.extend([query.limit, query.offset])

    async with conn.cursor() as cur:
        await cur.execute(sql, params)
        rows = await cur.fetchall()

    return [_row_to_memory(row) for row in rows]


async def update_memory_stats(
    conn: AsyncConnection,
    memory_id: str,
    applied: bool,
    success: bool,
    now: Optional[datetime] = None,
) -> bool:
    """Update memory application statistics.

    Args:
        conn: Database connection
        memory_id: Memory ID
        applied: Whether the memory was applied
        success: Whether the application was successful
        now: Current timestamp (defaults to now)

    Returns:
        True if updated, False if memory not found
    """
    if now is None:
        now = datetime.now(timezone.utc)

    # Build update fields
    updates = ["updated_at = %s"]
    params = [now]

    if applied:
        updates.append("applied_count = applied_count + 1")
        updates.append("last_applied_at = %s")
        params.append(now)

        if success:
            updates.append("success_count = success_count + 1")
            # Increase confidence slightly on success
            updates.append("confidence_score = LEAST(confidence_score + 0.05, 1.0)")
        else:
            updates.append("failure_count = failure_count + 1")
            # Decrease confidence slightly on failure
            updates.append("confidence_score = GREATEST(confidence_score - 0.1, 0.0)")

    params.append(memory_id)

    sql = f"""
        UPDATE ai_memories
        SET {', '.join(updates)}
        WHERE id = %s
    """

    async with conn.cursor() as cur:
        await cur.execute(sql, params)
        return cur.rowcount > 0


async def record_memory_application(
    conn: AsyncConnection, application: MemoryApplicationRecord
) -> None:
    """Record a memory application event.

    Args:
        conn: Database connection
        application: Application record to create
    """
    sql = """
        INSERT INTO ai_memory_applications (
            id, memory_id, task_id, event_id,
            application_type, outcome, impact_score,
            actor, detail, created_at, metadata
        ) VALUES (
            %s, %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s, %s
        )
    """

    async with conn.cursor() as cur:
        await cur.execute(
            sql,
            (
                application.id,
                application.memory_id,
                application.task_id,
                application.event_id,
                application.application_type,
                application.outcome,
                application.impact_score,
                application.actor.model_dump(),
                application.detail,
                application.created_at,
                application.metadata,
            ),
        )


async def get_memory_applications(
    conn: AsyncConnection, memory_id: str, limit: int = 50
) -> list[MemoryApplicationRecord]:
    """Get application history for a memory.

    Args:
        conn: Database connection
        memory_id: Memory ID
        limit: Maximum number of records to return

    Returns:
        List of application records
    """
    sql = """
        SELECT * FROM ai_memory_applications
        WHERE memory_id = %s
        ORDER BY created_at DESC
        LIMIT %s
    """

    async with conn.cursor() as cur:
        await cur.execute(sql, (memory_id, limit))
        rows = await cur.fetchall()

    return [_row_to_application(row) for row in rows]


def _row_to_memory(row) -> AIMemoryRecord:
    """Convert database row to AIMemoryRecord."""
    related_entities = [RelatedEntity(**e) for e in row[10]]

    return AIMemoryRecord(
        id=row[0],
        memory_type=row[1],
        category=row[2],
        context_key=row[3],
        title=row[4],
        summary=row[5],
        insight=row[6],
        confidence_score=row[7],
        source_task_ids=row[8],
        source_event_ids=row[9],
        related_entities=related_entities,
        applied_count=row[11],
        success_count=row[12],
        failure_count=row[13],
        last_applied_at=row[14],
        created_by=AuditActor(**row[15]),
        created_at=row[16],
        updated_at=row[17],
        expires_at=row[18],
        metadata=row[19],
    )


def _row_to_application(row) -> MemoryApplicationRecord:
    """Convert database row to MemoryApplicationRecord."""
    return MemoryApplicationRecord(
        id=row[0],
        memory_id=row[1],
        task_id=row[2],
        event_id=row[3],
        application_type=row[4],
        outcome=row[5],
        impact_score=row[6],
        actor=AuditActor(**row[7]),
        detail=row[8],
        created_at=row[9],
        metadata=row[10],
    )


__all__ = [
    "create_memory",
    "get_memory_by_id",
    "query_memories",
    "update_memory_stats",
    "record_memory_application",
    "get_memory_applications",
]
