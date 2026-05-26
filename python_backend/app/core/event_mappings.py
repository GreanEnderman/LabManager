"""Unified event type mappings and routing logic.

This module provides a single source of truth for all event-related mappings.
"""

from typing import Literal

EventType = Literal["low_stock", "maintenance_overdue", "equipment_fault"]
TaskType = Literal["chemical_purchase", "equipment_maintenance", "equipment_repair", "restock", "maintenance", "anomaly_review", "inspection", "other"]
RouteType = Literal["inventory", "maintenance", "fault", "ignore"]
PriorityLevel = Literal["low", "medium", "high", "critical"]
RiskLevel = Literal["low", "medium", "high", "critical"]


class EventMappings:
    """Centralized event type mappings."""

    # Event type → Task type (compat format)
    EVENT_TO_COMPAT_TASK_TYPE = {
        "low_stock": "chemical_purchase",
        "maintenance_overdue": "equipment_maintenance",
        "equipment_fault": "equipment_repair",
    }

    # Event type → Task type (formal format)
    EVENT_TO_FORMAL_TASK_TYPE = {
        "low_stock": "chemical_purchase",
        "maintenance_overdue": "equipment_maintenance",
        "equipment_fault": "equipment_repair",
    }

    # Formal task type → Compat task type
    FORMAL_TO_COMPAT_TASK_TYPE = {
        "restock": "chemical_purchase",
        "procurement": "chemical_purchase",
        "maintenance": "equipment_maintenance",
        "equipment_repair": "equipment_repair",
        "inspection": "equipment_maintenance",
        "calibration": "equipment_maintenance",
    }

    # Compat task type → Formal task type
    COMPAT_TO_FORMAL_TASK_TYPE = {
        "chemical_purchase": "procurement",
        "equipment_maintenance": "maintenance",
        "equipment_repair": "equipment_repair",
        "restock": "restock",
        "maintenance": "maintenance",
        "anomaly_review": "inspection",
    }

    # Event type → Route
    EVENT_TO_ROUTE = {
        "low_stock": "inventory",
        "maintenance_overdue": "maintenance",
        "equipment_fault": "fault",
    }

    # Event type → Priority
    EVENT_TO_PRIORITY = {
        "equipment_fault": "high",
        "maintenance_overdue": "medium",
        "low_stock": "medium",
    }

    # Event type → Risk level
    EVENT_TO_RISK = {
        "equipment_fault": "high",
        "maintenance_overdue": "medium",
        "low_stock": "medium",
    }

    # Events that always require approval
    APPROVAL_REQUIRED_EVENTS = {"low_stock", "maintenance_overdue", "equipment_fault"}

    # Risk levels that require approval
    APPROVAL_REQUIRED_RISK_LEVELS = {"high", "critical"}

    @classmethod
    def event_to_compat_task_type(cls, event_type: str) -> str:
        """Map event type to compat task type."""
        return cls.EVENT_TO_COMPAT_TASK_TYPE.get(event_type, "data_fix")

    @classmethod
    def event_to_formal_task_type(cls, event_type: str) -> str:
        """Map event type to formal task type."""
        return cls.EVENT_TO_FORMAL_TASK_TYPE.get(event_type, "other")

    @classmethod
    def formal_to_compat_task_type(cls, formal_type: str, metadata: dict | None = None) -> str:
        """Map formal task type to compat task type."""
        # Check metadata for explicit compat type
        if metadata and metadata.get("compatTaskType"):
            return str(metadata["compatTaskType"])
        return cls.FORMAL_TO_COMPAT_TASK_TYPE.get(formal_type, "data_fix")

    @classmethod
    def compat_to_formal_task_type(cls, compat_type: str) -> str:
        """Map compat task type to formal task type."""
        return cls.COMPAT_TO_FORMAL_TASK_TYPE.get(compat_type, "other")

    @classmethod
    def event_to_route(cls, event_type: str) -> str:
        """Map event type to handler route."""
        return cls.EVENT_TO_ROUTE.get(event_type, "ignore")

    @classmethod
    def event_to_priority(cls, event_type: str) -> str:
        """Map event type to priority level."""
        return cls.EVENT_TO_PRIORITY.get(event_type, "medium")

    @classmethod
    def event_to_risk_level(cls, event_type: str) -> str:
        """Map event type to risk level."""
        return cls.EVENT_TO_RISK.get(event_type, "medium")

    @classmethod
    def requires_approval(cls, event_type: str, risk_level: str = "medium") -> bool:
        """Determine if event requires approval."""
        return event_type in cls.APPROVAL_REQUIRED_EVENTS
