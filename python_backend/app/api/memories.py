"""Memory API endpoints.

This module provides REST API endpoints for managing AI memories.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request, status

from app.core.actor_converter import ActorConverter
from app.db import get_connection
from app.memory.models import (
    AIMemoryDTO,
    CreateMemoryRequest,
    QueryMemoriesRequest,
    RecordMemoryApplicationRequest,
)
from app.memory.service import MemoryService

router = APIRouter(prefix="/api/memories", tags=["memories"])


@router.post("", response_model=AIMemoryDTO, status_code=status.HTTP_201_CREATED)
async def create_memory(
    request_body: CreateMemoryRequest,
    request: Request,
) -> AIMemoryDTO:
    """Create a new memory.

    Args:
        request_body: Memory creation request
        request: FastAPI request object

    Returns:
        Created memory DTO

    Raises:
        HTTPException: If creation fails
    """
    # Extract actor from request (simplified - in production, use auth middleware)
    actor = ActorConverter.to_formal(
        getattr(request.state, "actor", None)
        or {"id": "system", "name": "System", "type": "system"}
    )

    try:
        async with get_connection() as conn:
            service = MemoryService(conn)
            memory = await service.create_memory(request_body, actor)
        return memory
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create memory: {str(e)}",
        ) from e


@router.get("", response_model=list[AIMemoryDTO])
async def query_memories(
    context_key: str | None = None,
    memory_type: str | None = None,
    category: str | None = None,
    min_confidence: float = 0.3,
    limit: int = 10,
    offset: int = 0,
) -> list[AIMemoryDTO]:
    """Query memories with filters.

    Args:
        context_key: Context key filter
        memory_type: Memory type filter
        category: Category filter
        min_confidence: Minimum confidence score
        limit: Maximum number of results
        offset: Offset for pagination

    Returns:
        List of matching memories

    Raises:
        HTTPException: If query fails
    """
    query = QueryMemoriesRequest(
        context_key=context_key,
        memory_type=memory_type,
        category=category,
        min_confidence=min_confidence,
        limit=limit,
        offset=offset,
    )

    try:
        async with get_connection() as conn:
            service = MemoryService(conn)
            memories = await service.query_relevant_memories(query)
        return memories
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query memories: {str(e)}",
        ) from e


@router.get("/{memory_id}", response_model=AIMemoryDTO)
async def get_memory(memory_id: str) -> AIMemoryDTO:
    """Get a memory by ID.

    Args:
        memory_id: Memory ID

    Returns:
        Memory DTO

    Raises:
        HTTPException: If memory not found or retrieval fails
    """
    try:
        async with get_connection() as conn:
            service = MemoryService(conn)
            memory = await service.get_memory(memory_id)

        if not memory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Memory {memory_id} not found",
            )

        return memory
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get memory: {str(e)}",
        ) from e


@router.post("/{memory_id}/applications", status_code=status.HTTP_201_CREATED)
async def record_application(
    memory_id: str,
    request_body: RecordMemoryApplicationRequest,
    request: Request,
) -> dict[str, Any]:
    """Record a memory application.

    Args:
        memory_id: Memory ID
        request_body: Application record request
        request: FastAPI request object

    Returns:
        Success message

    Raises:
        HTTPException: If recording fails
    """
    # Validate memory_id matches request body
    if request_body.memory_id != memory_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Memory ID in path does not match request body",
        )

    # Extract actor from request
    actor = ActorConverter.to_formal(
        getattr(request.state, "actor", None)
        or {"id": "system", "name": "System", "type": "system"}
    )

    try:
        async with get_connection() as conn:
            service = MemoryService(conn)
            await service.record_application(request_body, actor)

        return {"message": "Application recorded successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record application: {str(e)}",
        ) from e


@router.get("/{memory_id}/applications")
async def get_application_history(
    memory_id: str, limit: int = 50
) -> dict[str, Any]:
    """Get application history for a memory.

    Args:
        memory_id: Memory ID
        limit: Maximum number of records

    Returns:
        Application history

    Raises:
        HTTPException: If retrieval fails
    """
    try:
        async with get_connection() as conn:
            service = MemoryService(conn)
            applications = await service.get_application_history(memory_id, limit)

        return {
            "memoryId": memory_id,
            "applications": [
                {
                    "id": app.id,
                    "taskId": app.task_id,
                    "eventId": app.event_id,
                    "applicationType": app.application_type,
                    "outcome": app.outcome,
                    "impactScore": app.impact_score,
                    "actor": app.actor.model_dump(),
                    "detail": app.detail,
                    "createdAt": app.created_at.isoformat().replace("+00:00", "Z"),
                    "metadata": app.metadata,
                }
                for app in applications
            ],
            "count": len(applications),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get application history: {str(e)}",
        ) from e


__all__ = ["router"]
