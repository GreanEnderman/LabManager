"""Tests for type mapper utilities."""

import pytest

from app.graphs.type_mapper import (
    compat_to_formal_task_type,
    formal_to_compat_task_type,
    formal_to_compat_status,
    compat_to_formal_status,
    get_formal_type_for_event,
    FORMAL_TO_COMPAT_TYPE,
    COMPAT_TO_FORMAL_TYPE,
    FORMAL_TO_COMPAT_STATUS,
    COMPAT_TO_FORMAL_STATUS,
)


def test_compat_to_formal_task_type():
    """Test compat to formal task type conversion."""
    assert compat_to_formal_task_type("restock") == "restock"
    assert compat_to_formal_task_type("maintenance") == "maintenance"
    assert compat_to_formal_task_type("anomaly_review") == "inspection"
    assert compat_to_formal_task_type("data_fix") == "other"
    assert compat_to_formal_task_type("unknown") == "unknown"  # Passthrough


def test_formal_to_compat_task_type():
    """Test formal to compat task type conversion."""
    assert formal_to_compat_task_type("restock") == "restock"
    assert formal_to_compat_task_type("maintenance") == "maintenance"
    assert formal_to_compat_task_type("inspection") == "anomaly_review"
    assert formal_to_compat_task_type("calibration") == "anomaly_review"
    assert formal_to_compat_task_type("disposal") == "other"
    assert formal_to_compat_task_type("procurement") == "restock"
    assert formal_to_compat_task_type("training") == "other"
    assert formal_to_compat_task_type("audit") == "other"


def test_formal_to_compat_status():
    """Test formal to compat status conversion."""
    assert formal_to_compat_status("open") == "open"
    assert formal_to_compat_status("in_progress") == "in_progress"
    assert formal_to_compat_status("blocked") == "in_progress"
    assert formal_to_compat_status("completed") == "done"
    assert formal_to_compat_status("cancelled") == "closed"


def test_compat_to_formal_status():
    """Test compat to formal status conversion."""
    assert compat_to_formal_status("open") == "open"
    assert compat_to_formal_status("in_progress") == "in_progress"
    assert compat_to_formal_status("pending_approval") == "in_progress"
    assert compat_to_formal_status("done") == "completed"
    assert compat_to_formal_status("closed") == "cancelled"


def test_get_formal_type_for_event():
    """Test getting formal type from event type."""
    assert get_formal_type_for_event("low_stock") == "restock"
    assert get_formal_type_for_event("maintenance_overdue") == "maintenance"
    assert get_formal_type_for_event("equipment_fault") == "inspection"
    assert get_formal_type_for_event("unknown_event") == "other"


def test_type_mapping_consistency():
    """Test that type mappings are consistent."""
    # All formal types should map to valid compat types
    for formal_type, compat_type in FORMAL_TO_COMPAT_TYPE.items():
        assert compat_type in ["restock", "maintenance", "anomaly_review", "other"]

    # All compat types should map to valid formal types
    for compat_type, formal_type in COMPAT_TO_FORMAL_TYPE.items():
        assert formal_type in [
            "restock",
            "maintenance",
            "inspection",
            "calibration",
            "disposal",
            "procurement",
            "training",
            "audit",
            "other",
        ]


def test_status_mapping_consistency():
    """Test that status mappings are consistent."""
    # All formal statuses should map to valid compat statuses
    for formal_status, compat_status in FORMAL_TO_COMPAT_STATUS.items():
        assert compat_status in ["open", "in_progress", "pending_approval", "done", "closed"]

    # All compat statuses should map to valid formal statuses
    for compat_status, formal_status in COMPAT_TO_FORMAL_STATUS.items():
        assert formal_status in ["open", "in_progress", "blocked", "completed", "cancelled"]


def test_round_trip_type_mapping():
    """Test round-trip type mapping (where possible)."""
    # Some mappings are lossy, but these should round-trip
    assert compat_to_formal_task_type(formal_to_compat_task_type("restock")) == "restock"
    assert compat_to_formal_task_type(formal_to_compat_task_type("maintenance")) == "maintenance"

    # inspection -> anomaly_review -> inspection (round-trip works)
    assert compat_to_formal_task_type(formal_to_compat_task_type("inspection")) == "inspection"


def test_round_trip_status_mapping():
    """Test round-trip status mapping (where possible)."""
    # Some mappings are lossy, but these should round-trip
    assert compat_to_formal_status(formal_to_compat_status("open")) == "open"
    assert compat_to_formal_status(formal_to_compat_status("in_progress")) == "in_progress"

    # completed -> done -> completed (round-trip works)
    assert compat_to_formal_status(formal_to_compat_status("completed")) == "completed"

    # cancelled -> closed -> cancelled (round-trip works)
    assert compat_to_formal_status(formal_to_compat_status("cancelled")) == "cancelled"


def test_lossy_mappings():
    """Test known lossy mappings."""
    # blocked -> in_progress (lossy, can't round-trip)
    assert formal_to_compat_status("blocked") == "in_progress"
    assert compat_to_formal_status("in_progress") == "in_progress"  # Not "blocked"

    # calibration -> anomaly_review (lossy, maps back to inspection)
    assert formal_to_compat_task_type("calibration") == "anomaly_review"
    assert compat_to_formal_task_type("anomaly_review") == "inspection"  # Not "calibration"
