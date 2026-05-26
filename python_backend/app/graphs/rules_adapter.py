"""Adapter layer bridging Supervisor Graph domain events to RulesEngine entity events."""

from __future__ import annotations

from typing import Any

from app.core.event_mappings import EventMappings
from app.rules.engine import RulesEngine


class SupervisorRulesAdapter:
    """Bridges Supervisor Graph domain events to RulesEngine entity events.

    The Supervisor Graph uses domain-specific event types like "low_stock",
    "maintenance_overdue", and "equipment_fault". The RulesEngine expects
    entity-level events like "task", "approval", and "activity".

    This adapter transforms between the two formats and provides a unified
    rule evaluation interface for the Supervisor Graph's rule_gate node.
    """

    def __init__(self, rules_engine: RulesEngine, task_tool: Any | None = None):
        self._rules_engine = rules_engine
        self._task_tool = task_tool

    async def evaluate_rule_async(
        self,
        normalized_event: dict[str, Any],
        actor: dict[str, Any],
        accumulated_errors: list[str],
    ) -> dict[str, Any]:
        """Async version of evaluate_rule that can check for existing tasks.

        Args:
            normalized_event: Normalized domain event from normalize_event node
            actor: Actor context (user/system/agent)
            accumulated_errors: Errors accumulated from previous nodes

        Returns:
            Rule decision dict with keys:
            - isValidEvent: bool
            - route: str (inventory/maintenance/fault/ignore)
            - requiresApproval: bool
            - dedupeHit: bool
            - shouldCreateTask: bool
            - reason: str
            - existingTaskId: str | None (if dedupeHit)
        """
        # Check actor permissions if actor is a user
        if actor.get("type") == "user":
            user_capabilities = actor.get("capabilities", [])
            # Check if user has rules:execute capability
            # Note: For backward compatibility, if capabilities is empty, allow execution
            if user_capabilities and "rules:execute" not in user_capabilities:
                return {
                    "isValidEvent": False,
                    "route": "ignore",
                    "requiresApproval": False,
                    "dedupeHit": False,
                    "shouldCreateTask": False,
                    "reason": "Actor lacks rules:execute capability",
                    "existingTaskId": None,
                    "metadata": {"permissionDenied": True},
                }

        # Check if there are pre-existing validation errors
        is_valid = not accumulated_errors
        event_type = normalized_event.get("type", "")

        if not is_valid:
            return {
                "isValidEvent": False,
                "route": "ignore",
                "requiresApproval": False,
                "dedupeHit": False,
                "shouldCreateTask": False,
                "reason": "; ".join(accumulated_errors),
                "existingTaskId": None,
            }

        # Validate event type is supported
        if event_type not in {"low_stock", "maintenance_overdue", "equipment_fault"}:
            return {
                "isValidEvent": False,
                "route": "ignore",
                "requiresApproval": False,
                "dedupeHit": False,
                "shouldCreateTask": False,
                "reason": f"Unsupported event type: {event_type}",
                "existingTaskId": None,
            }

        # Check for existing open task if task_tool is available
        existing_task = None
        if self._task_tool:
            task_type = EventMappings.event_to_formal_task_type(event_type)
            existing_task = await self._task_tool.find_existing_open_task(
                event_id=normalized_event.get("id", ""),
                source_id=normalized_event.get("sourceId", ""),
                task_type=task_type,
            )

        if existing_task:
            # Found existing open task - this is a duplicate
            return {
                "isValidEvent": True,
                "route": EventMappings.event_to_route(event_type),
                "requiresApproval": EventMappings.requires_approval(
                    event_type, normalized_event.get("riskLevel", "medium")
                ),
                "dedupeHit": True,
                "shouldCreateTask": False,
                "reason": f"Existing open task {existing_task['id']} found for this event.",
                "existingTaskId": existing_task["id"],
                "metadata": {},
            }

        # No existing task found - proceed with event processing
        route = EventMappings.event_to_route(event_type)
        requires_approval = EventMappings.requires_approval(
            event_type, normalized_event.get("riskLevel", "medium")
        )

        return {
            "isValidEvent": True,
            "route": route,
            "requiresApproval": requires_approval,
            "dedupeHit": False,
            "shouldCreateTask": True,
            "reason": f"Event accepted. Route: {route}.",
            "existingTaskId": None,
            "metadata": {},
        }

    def evaluate_rule(
        self,
        normalized_event: dict[str, Any],
        actor: dict[str, Any],
        accumulated_errors: list[str],
    ) -> dict[str, Any]:
        """Synchronous wrapper for evaluate_rule_async.

        This is kept for backward compatibility but delegates to async version.
        """
        import asyncio
        return asyncio.run(self.evaluate_rule_async(normalized_event, actor, accumulated_errors))
