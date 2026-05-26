"""Unified actor conversion logic."""

from typing import Any

from app.tasks.models import AuditActor


class ActorConverter:
    """Centralized actor conversion and normalization."""

    VALID_ACTOR_TYPES = {"user", "system", "agent"}
    DEFAULT_ACTOR_TYPE = "system"
    DEFAULT_ACTOR_ID = "system"
    DEFAULT_ACTOR_NAME = "System"

    @staticmethod
    def to_formal(actor: dict[str, Any] | None) -> AuditActor:
        """Convert dict to formal AuditActor.

        Args:
            actor: Actor dict with id, name, type fields

        Returns:
            Formal AuditActor instance
        """
        payload = actor or {}
        actor_type = str(payload.get("type") or ActorConverter.DEFAULT_ACTOR_TYPE)

        # Validate and normalize actor type
        if actor_type not in ActorConverter.VALID_ACTOR_TYPES:
            actor_type = ActorConverter.DEFAULT_ACTOR_TYPE

        return AuditActor(
            id=str(payload.get("id") or ActorConverter.DEFAULT_ACTOR_ID),
            name=str(payload.get("name") or ActorConverter.DEFAULT_ACTOR_NAME),
            type=actor_type,
        )

    @staticmethod
    def from_payload(payload: dict[str, Any] | None) -> dict[str, str]:
        """Extract and normalize actor from request payload.

        Args:
            payload: Request payload containing actor field

        Returns:
            Normalized actor dict
        """
        actor = (payload or {}).get("actor") or {}
        actor_type = str(actor.get("type") or ActorConverter.DEFAULT_ACTOR_TYPE)

        # Validate actor type
        if actor_type not in ActorConverter.VALID_ACTOR_TYPES:
            actor_type = ActorConverter.DEFAULT_ACTOR_TYPE

        return {
            "id": str(actor.get("id") or ActorConverter.DEFAULT_ACTOR_ID),
            "name": str(actor.get("name") or ActorConverter.DEFAULT_ACTOR_NAME),
            "type": actor_type,
        }
