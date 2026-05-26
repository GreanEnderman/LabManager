"""Type mapping utilities for task types and statuses.

This module provides a single source of truth for mapping between
formal (Python) and compat (TypeScript) task types and statuses.
"""

from typing import Optional


# Task type mappings
FORMAL_TO_COMPAT_TYPE = {
    "restock": "chemical_purchase",
    "maintenance": "equipment_maintenance",
    "inspection": "equipment_maintenance",
    "calibration": "equipment_maintenance",
    "equipment_repair": "equipment_repair",
    "disposal": "other",
    "procurement": "chemical_purchase",
    "training": "other",
    "audit": "other",
    "other": "other",
}

COMPAT_TO_FORMAL_TYPE = {
    "chemical_purchase": "procurement",
    "equipment_maintenance": "maintenance",
    "equipment_repair": "equipment_repair",
    "restock": "restock",
    "maintenance": "maintenance",
    "anomaly_review": "inspection",
    "data_fix": "other",
}


# Status mappings
FORMAL_TO_COMPAT_STATUS = {
    "open": "open",
    "in_progress": "in_progress",
    "blocked": "in_progress",  # Map blocked to in_progress for compat
    "completed": "done",
    "cancelled": "closed",
}

COMPAT_TO_FORMAL_STATUS = {
    "open": "open",
    "in_progress": "in_progress",
    "pending_approval": "in_progress",  # Map to in_progress in formal
    "done": "completed",
    "closed": "cancelled",
}


def compat_to_formal_task_type(compat_type: str) -> str:
    """Convert compat task type to formal type.

    Args:
        compat_type: Compat task type (e.g., "anomaly_review")

    Returns:
        Formal task type (e.g., "inspection")

    Rationale:
        - anomaly_review maps to inspection (most common anomaly type)
        - data_fix maps to other (catch-all for misc tasks)
    """
    return COMPAT_TO_FORMAL_TYPE.get(compat_type, compat_type)


def formal_to_compat_task_type(formal_type: str) -> str:
    """Convert formal task type to compat type.

    Args:
        formal_type: Formal task type (e.g., "inspection")

    Returns:
        Compat task type (e.g., "anomaly_review")

    Rationale:
        - inspection/calibration map to anomaly_review (TS legacy naming)
        - procurement maps to restock (similar workflow)
        - training/audit/disposal map to other (not in TS enum)
    """
    return FORMAL_TO_COMPAT_TYPE.get(formal_type, formal_type)


def formal_to_compat_status(formal_status: str) -> str:
    """Convert formal status to compat status.

    Args:
        formal_status: Formal status (e.g., "completed")

    Returns:
        Compat status (e.g., "done")

    Rationale:
        - completed maps to done (TS naming)
        - cancelled maps to closed (TS naming)
        - blocked maps to in_progress (TS doesn't have blocked state)
    """
    return FORMAL_TO_COMPAT_STATUS.get(formal_status, formal_status)


def compat_to_formal_status(compat_status: str) -> str:
    """Convert compat status to formal status.

    Args:
        compat_status: Compat status (e.g., "done")

    Returns:
        Formal status (e.g., "completed")

    Rationale:
        - done maps to completed (formal naming)
        - closed maps to cancelled (formal naming)
        - pending_approval maps to in_progress (formal doesn't have pending_approval yet)
    """
    return COMPAT_TO_FORMAL_STATUS.get(compat_status, compat_status)


def get_formal_type_for_event(event_type: str) -> str:
    """Get formal task type for a domain event type.

    Args:
        event_type: Domain event type (e.g., "low_stock")

    Returns:
        Formal task type (e.g., "restock")

    Rationale:
        - low_stock -> restock (inventory replenishment)
        - maintenance_overdue -> maintenance (scheduled maintenance)
        - equipment_fault -> equipment_repair (repair workflow)
    """
    if event_type == "low_stock":
        return "chemical_purchase"
    elif event_type == "maintenance_overdue":
        return "equipment_maintenance"
    elif event_type == "equipment_fault":
        return "equipment_repair"
    else:
        return "other"
