"""Authorization module for LabManager Python backend.

This module defines application capabilities and role-based access control (RBAC)
that mirrors the TypeScript backend implementation in backend/src/domain/authz.ts.
"""

from enum import Enum


class AppCapability(str, Enum):
    """Application capabilities that can be granted to users.

    These capabilities define fine-grained permissions for different operations
    in the LabManager system. They are aligned with the TypeScript backend
    capability definitions.
    """

    # Chemical inventory capabilities
    CHEMICALS_READ = "chemicals:read"

    # Equipment capabilities
    EQUIPMENT_READ = "equipment:read"

    # Import capabilities
    IMPORTS_READ = "imports:read"
    IMPORTS_CREATE = "imports:create"

    # Alert capabilities
    ALERTS_READ = "alerts:read"

    # Task capabilities
    TASKS_READ = "tasks:read"
    TASKS_WRITE = "tasks:write"

    # Approval capabilities
    APPROVALS_READ = "approvals:read"
    APPROVALS_WRITE = "approvals:write"

    # Report capabilities
    REPORTS_READ = "reports:read"
    REPORTS_GENERATE = "reports:generate"
    REPORTS_DELETE = "reports:delete"

    # Report delivery capabilities
    REPORT_DELIVERY_READ = "report_delivery:read"
    REPORT_DELIVERY_MANAGE = "report_delivery:manage"

    # Settings capabilities
    SETTINGS_READ = "settings:read"
    SETTINGS_UPDATE = "settings:update"

    # Rules and agent capabilities
    RULES_INSPECT = "rules:inspect"
    RULES_EXECUTE = "rules:execute"
    AGENTS_EXECUTE = "agents:execute"


# Role capability mappings
# These define which capabilities each role has by default
ROLE_CAPABILITIES: dict[str, list[AppCapability]] = {
    "admin": [
        # Admin has all capabilities
        AppCapability.CHEMICALS_READ,
        AppCapability.EQUIPMENT_READ,
        AppCapability.IMPORTS_READ,
        AppCapability.IMPORTS_CREATE,
        AppCapability.ALERTS_READ,
        AppCapability.TASKS_READ,
        AppCapability.TASKS_WRITE,
        AppCapability.APPROVALS_READ,
        AppCapability.APPROVALS_WRITE,
        AppCapability.REPORTS_READ,
        AppCapability.REPORTS_GENERATE,
        AppCapability.REPORTS_DELETE,
        AppCapability.REPORT_DELIVERY_READ,
        AppCapability.REPORT_DELIVERY_MANAGE,
        AppCapability.SETTINGS_READ,
        AppCapability.SETTINGS_UPDATE,
        AppCapability.RULES_INSPECT,
        AppCapability.RULES_EXECUTE,
        AppCapability.AGENTS_EXECUTE,
    ],
    "manager": [
        # Manager has all capabilities except imports:create and reports:delete
        AppCapability.CHEMICALS_READ,
        AppCapability.EQUIPMENT_READ,
        AppCapability.IMPORTS_READ,
        # AppCapability.IMPORTS_CREATE,  # Not granted to manager
        AppCapability.ALERTS_READ,
        AppCapability.TASKS_READ,
        AppCapability.TASKS_WRITE,
        AppCapability.APPROVALS_READ,
        AppCapability.APPROVALS_WRITE,
        AppCapability.REPORTS_READ,
        AppCapability.REPORTS_GENERATE,
        # AppCapability.REPORTS_DELETE,  # Not granted to manager
        AppCapability.REPORT_DELIVERY_READ,
        AppCapability.REPORT_DELIVERY_MANAGE,
        AppCapability.SETTINGS_READ,
        AppCapability.SETTINGS_UPDATE,
        AppCapability.RULES_INSPECT,
        AppCapability.RULES_EXECUTE,
        AppCapability.AGENTS_EXECUTE,
    ],
    "operator": [
        # Operator has read capabilities plus task write
        AppCapability.CHEMICALS_READ,
        AppCapability.EQUIPMENT_READ,
        AppCapability.IMPORTS_READ,
        AppCapability.ALERTS_READ,
        AppCapability.TASKS_READ,
        AppCapability.TASKS_WRITE,
        AppCapability.APPROVALS_READ,
        AppCapability.REPORTS_READ,
        AppCapability.REPORT_DELIVERY_READ,
    ],
    "viewer": [
        # Viewer has only read capabilities
        AppCapability.CHEMICALS_READ,
        AppCapability.EQUIPMENT_READ,
        AppCapability.IMPORTS_READ,
        AppCapability.ALERTS_READ,
        AppCapability.TASKS_READ,
        AppCapability.APPROVALS_READ,
        AppCapability.REPORTS_READ,
        AppCapability.REPORT_DELIVERY_READ,
    ],
}


def get_capabilities_for_role(role: str) -> list[AppCapability]:
    """Get the list of capabilities for a given role.

    Args:
        role: The role name (admin, manager, operator, viewer)

    Returns:
        List of AppCapability enums for the role

    Raises:
        ValueError: If the role is not recognized
    """
    if role not in ROLE_CAPABILITIES:
        raise ValueError(f"Unknown role: {role}")

    return ROLE_CAPABILITIES[role]


def has_capability(user_capabilities: list[str], required: AppCapability) -> bool:
    """Check if a user has a required capability.

    Args:
        user_capabilities: List of capability strings the user has
        required: The capability to check for

    Returns:
        True if the user has the required capability, False otherwise
    """
    return required.value in user_capabilities


def get_all_capabilities() -> list[AppCapability]:
    """Get all available capabilities in the system.

    Returns:
        List of all AppCapability enums
    """
    return list(AppCapability)


__all__ = [
    "AppCapability",
    "ROLE_CAPABILITIES",
    "get_capabilities_for_role",
    "has_capability",
    "get_all_capabilities",
]
