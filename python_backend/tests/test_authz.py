"""Tests for authorization module."""

import pytest

from app.authz import (
    AppCapability,
    get_all_capabilities,
    get_capabilities_for_role,
    has_capability,
)


def test_get_capabilities_for_admin_role():
    """Test that admin role has all capabilities."""
    capabilities = get_capabilities_for_role("admin")

    # Admin should have all 19 capabilities
    assert len(capabilities) == 19

    # Verify admin has all key capabilities
    assert AppCapability.IMPORTS_CREATE in capabilities
    assert AppCapability.REPORTS_DELETE in capabilities
    assert AppCapability.SETTINGS_UPDATE in capabilities
    assert AppCapability.RULES_EXECUTE in capabilities
    assert AppCapability.AGENTS_EXECUTE in capabilities


def test_get_capabilities_for_manager_role():
    """Test that manager role has most capabilities except specific ones."""
    capabilities = get_capabilities_for_role("manager")

    # Manager should have 17 capabilities (all except imports:create and reports:delete)
    assert len(capabilities) == 17

    # Verify manager has most capabilities
    assert AppCapability.TASKS_WRITE in capabilities
    assert AppCapability.APPROVALS_WRITE in capabilities
    assert AppCapability.SETTINGS_UPDATE in capabilities
    assert AppCapability.RULES_EXECUTE in capabilities

    # Verify manager does NOT have these capabilities
    assert AppCapability.IMPORTS_CREATE not in capabilities
    assert AppCapability.REPORTS_DELETE not in capabilities


def test_get_capabilities_for_operator_role():
    """Test that operator role has limited capabilities."""
    capabilities = get_capabilities_for_role("operator")

    # Operator should have 9 capabilities (read + tasks:write)
    assert len(capabilities) == 9

    # Verify operator has read capabilities
    assert AppCapability.CHEMICALS_READ in capabilities
    assert AppCapability.EQUIPMENT_READ in capabilities
    assert AppCapability.TASKS_READ in capabilities
    assert AppCapability.TASKS_WRITE in capabilities

    # Verify operator does NOT have write capabilities
    assert AppCapability.APPROVALS_WRITE not in capabilities
    assert AppCapability.SETTINGS_UPDATE not in capabilities
    assert AppCapability.RULES_EXECUTE not in capabilities


def test_get_capabilities_for_viewer_role():
    """Test that viewer role has only read capabilities."""
    capabilities = get_capabilities_for_role("viewer")

    # Viewer should have 8 read-only capabilities
    assert len(capabilities) == 8

    # Verify viewer has read capabilities
    assert AppCapability.CHEMICALS_READ in capabilities
    assert AppCapability.EQUIPMENT_READ in capabilities
    assert AppCapability.TASKS_READ in capabilities
    assert AppCapability.REPORTS_READ in capabilities

    # Verify viewer does NOT have any write capabilities
    assert AppCapability.TASKS_WRITE not in capabilities
    assert AppCapability.APPROVALS_WRITE not in capabilities
    assert AppCapability.SETTINGS_UPDATE not in capabilities


def test_get_capabilities_for_unknown_role_raises_error():
    """Test that unknown role raises ValueError."""
    with pytest.raises(ValueError, match="Unknown role: unknown"):
        get_capabilities_for_role("unknown")


def test_has_capability_returns_true_when_user_has_capability():
    """Test that has_capability returns True when user has the capability."""
    user_capabilities = ["tasks:read", "tasks:write", "approvals:read"]

    assert has_capability(user_capabilities, AppCapability.TASKS_READ) is True
    assert has_capability(user_capabilities, AppCapability.TASKS_WRITE) is True
    assert has_capability(user_capabilities, AppCapability.APPROVALS_READ) is True


def test_has_capability_returns_false_when_user_lacks_capability():
    """Test that has_capability returns False when user lacks the capability."""
    user_capabilities = ["tasks:read", "approvals:read"]

    assert has_capability(user_capabilities, AppCapability.TASKS_WRITE) is False
    assert has_capability(user_capabilities, AppCapability.SETTINGS_UPDATE) is False
    assert has_capability(user_capabilities, AppCapability.RULES_EXECUTE) is False


def test_has_capability_with_empty_capabilities():
    """Test that has_capability returns False for empty capability list."""
    user_capabilities = []

    assert has_capability(user_capabilities, AppCapability.TASKS_READ) is False
    assert has_capability(user_capabilities, AppCapability.CHEMICALS_READ) is False


def test_get_all_capabilities_returns_complete_list():
    """Test that get_all_capabilities returns all defined capabilities."""
    all_capabilities = get_all_capabilities()

    # Should return all 19 capabilities
    assert len(all_capabilities) == 19

    # Verify all capability types are present
    assert AppCapability.CHEMICALS_READ in all_capabilities
    assert AppCapability.EQUIPMENT_READ in all_capabilities
    assert AppCapability.IMPORTS_READ in all_capabilities
    assert AppCapability.IMPORTS_CREATE in all_capabilities
    assert AppCapability.ALERTS_READ in all_capabilities
    assert AppCapability.TASKS_READ in all_capabilities
    assert AppCapability.TASKS_WRITE in all_capabilities
    assert AppCapability.APPROVALS_READ in all_capabilities
    assert AppCapability.APPROVALS_WRITE in all_capabilities
    assert AppCapability.REPORTS_READ in all_capabilities
    assert AppCapability.REPORTS_GENERATE in all_capabilities
    assert AppCapability.REPORTS_DELETE in all_capabilities
    assert AppCapability.REPORT_DELIVERY_READ in all_capabilities
    assert AppCapability.REPORT_DELIVERY_MANAGE in all_capabilities
    assert AppCapability.SETTINGS_READ in all_capabilities
    assert AppCapability.SETTINGS_UPDATE in all_capabilities
    assert AppCapability.RULES_INSPECT in all_capabilities
    assert AppCapability.RULES_EXECUTE in all_capabilities
    assert AppCapability.AGENTS_EXECUTE in all_capabilities


def test_capability_enum_values_match_expected_format():
    """Test that capability enum values follow the expected format."""
    # All capabilities should follow the pattern "resource:action"
    for capability in AppCapability:
        assert ":" in capability.value
        parts = capability.value.split(":")
        assert len(parts) == 2
        assert len(parts[0]) > 0  # Resource name
        assert len(parts[1]) > 0  # Action name


def test_role_capabilities_are_consistent():
    """Test that role capabilities follow expected hierarchy."""
    admin_caps = set(get_capabilities_for_role("admin"))
    manager_caps = set(get_capabilities_for_role("manager"))
    operator_caps = set(get_capabilities_for_role("operator"))
    viewer_caps = set(get_capabilities_for_role("viewer"))

    # Manager capabilities should be a subset of admin
    assert manager_caps.issubset(admin_caps)

    # Operator capabilities should be a subset of manager
    assert operator_caps.issubset(manager_caps)

    # Viewer capabilities should be a subset of operator
    assert viewer_caps.issubset(operator_caps)

    # Admin should have more capabilities than manager
    assert len(admin_caps) > len(manager_caps)

    # Manager should have more capabilities than operator
    assert len(manager_caps) > len(operator_caps)
