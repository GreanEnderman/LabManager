"""Contract tests for DTO mappings between Python and TypeScript.

These tests ensure that Python DTOs correctly map to the TypeScript API contract.
"""

import pytest
from datetime import datetime, timezone

from app.gateway.adapter import ProtocolAdapter
from app.gateway.dto import (
    UnifiedTaskDTO,
    UnifiedApprovalDTO,
    UnifiedTaskActionDTO,
    UnifiedSettingsDTO,
)
from app.tasks.models import AITaskDTO, TaskActionDTO, AuditActor
from app.approvals.models import AIApprovalDTO
from app.settings.models import AISettings, ThresholdsSettings, ApprovalStrategySettings, SLASettings


@pytest.fixture
def adapter():
    """Protocol adapter instance."""
    return ProtocolAdapter()


@pytest.fixture
def sample_task():
    """Sample Python task DTO."""
    now = datetime.now(timezone.utc)
    return AITaskDTO(
        id="task_001",
        event_id="event_001",
        type="inspection",
        title="Equipment inspection required",
        summary="Equipment X needs inspection",
        recommendation="Schedule inspection",
        status="in_progress",
        priority="high",
        risk_level="medium",
        source_type="equipment",
        source_id="eq_001",
        source_name="Equipment X",
        assignee_id="user_001",
        assignee_name="Alice",
        assignee_role="technician",
        requires_approval=True,
        due_at=now,
        created_at=now,
        updated_at=now,
        closed_at=None,
        metadata={"notes": "Urgent"},
    )


@pytest.fixture
def sample_approval():
    """Sample Python approval DTO."""
    now = datetime.now(timezone.utc)
    return AIApprovalDTO(
        id="approval_001",
        task_id="task_001",
        title="Approve inspection",
        reason="High risk equipment",
        status="pending",
        risk_level="high",
        requested_by=AuditActor(id="user_001", name="Alice", type="user"),
        reviewer_id="user_002",
        reviewer_name="Bob",
        comment=None,
        created_at=now,
        updated_at=now,
        decided_at=None,
        metadata={},
    )


@pytest.fixture
def sample_action():
    """Sample Python task action DTO."""
    now = datetime.now(timezone.utc)
    return TaskActionDTO(
        id="action_001",
        task_id="task_001",
        approval_id=None,
        action_type="status_changed",
        from_status="open",
        to_status="in_progress",
        actor=AuditActor(id="user_001", name="Alice", type="user"),
        reason_codes=["started_work"],
        detail="Started working on task",
        tool_name=None,
        snapshot={},
        created_at=now,
    )


def test_task_to_unified_basic_fields(adapter, sample_task):
    """Test basic field mapping for task DTO."""
    unified = adapter.task_to_unified(sample_task)

    assert isinstance(unified, UnifiedTaskDTO)
    assert unified.id == "task_001"
    assert unified.eventId == "event_001"
    assert unified.title == "Equipment inspection required"
    assert unified.summary == "Equipment X needs inspection"
    assert unified.recommendation == "Schedule inspection"


def test_task_to_unified_status_mapping(adapter, sample_task):
    """Test status mapping from formal to compat."""
    # Test in_progress -> in_progress
    sample_task.status = "in_progress"
    unified = adapter.task_to_unified(sample_task)
    assert unified.status == "in_progress"

    # Test completed -> done
    sample_task.status = "completed"
    unified = adapter.task_to_unified(sample_task)
    assert unified.status == "done"

    # Test cancelled -> closed
    sample_task.status = "cancelled"
    unified = adapter.task_to_unified(sample_task)
    assert unified.status == "closed"

    # Test blocked -> in_progress (mapped)
    sample_task.status = "blocked"
    unified = adapter.task_to_unified(sample_task)
    assert unified.status == "in_progress"


def test_task_to_unified_type_mapping(adapter, sample_task):
    """Test task type mapping from formal to compat."""
    # Test inspection -> anomaly_review
    sample_task.type = "inspection"
    unified = adapter.task_to_unified(sample_task)
    assert unified.type == "anomaly_review"

    # Test restock -> restock (unchanged)
    sample_task.type = "restock"
    unified = adapter.task_to_unified(sample_task)
    assert unified.type == "restock"

    # Test maintenance -> maintenance (unchanged)
    sample_task.type = "maintenance"
    unified = adapter.task_to_unified(sample_task)
    assert unified.type == "maintenance"

    # Test calibration -> anomaly_review
    sample_task.type = "calibration"
    unified = adapter.task_to_unified(sample_task)
    assert unified.type == "anomaly_review"


def test_task_to_unified_camel_case(adapter, sample_task):
    """Test that unified DTO uses camelCase."""
    unified = adapter.task_to_unified(sample_task)

    # Check camelCase fields
    assert hasattr(unified, "eventId")
    assert hasattr(unified, "sourceType")
    assert hasattr(unified, "sourceId")
    assert hasattr(unified, "sourceName")
    assert hasattr(unified, "assigneeId")
    assert hasattr(unified, "assigneeName")
    assert hasattr(unified, "assigneeRole")
    assert hasattr(unified, "requiresApproval")
    assert hasattr(unified, "dueAt")
    assert hasattr(unified, "createdAt")
    assert hasattr(unified, "updatedAt")
    assert hasattr(unified, "closedAt")


def test_task_to_unified_datetime_serialization(adapter, sample_task):
    """Test datetime fields are serialized to ISO strings."""
    unified = adapter.task_to_unified(sample_task)

    # All datetime fields should be strings
    assert isinstance(unified.createdAt, str)
    assert isinstance(unified.updatedAt, str)
    assert isinstance(unified.dueAt, str)

    # Should be valid ISO format
    datetime.fromisoformat(unified.createdAt.replace("Z", "+00:00"))


def test_approval_to_unified(adapter, sample_approval):
    """Test approval DTO conversion."""
    unified = adapter.approval_to_unified(sample_approval)

    assert isinstance(unified, UnifiedApprovalDTO)
    assert unified.id == "approval_001"
    assert unified.taskId == "task_001"
    assert unified.title == "Approve inspection"
    assert unified.status == "pending"
    assert unified.riskLevel == "high"
    assert unified.requestedBy["id"] == "user_001"
    assert unified.reviewerId == "user_002"


def test_action_to_unified(adapter, sample_action):
    """Test task action DTO conversion."""
    unified = adapter.action_to_unified(sample_action)

    assert isinstance(unified, UnifiedTaskActionDTO)
    assert unified.id == "action_001"
    assert unified.taskId == "task_001"
    assert unified.actionType == "status_changed"
    assert unified.fromStatus == "open"
    assert unified.toStatus == "in_progress"
    assert unified.actor["id"] == "user_001"
    assert unified.reasonCodes == ["started_work"]


def test_action_to_unified_status_mapping(adapter, sample_action):
    """Test status mapping in task actions."""
    # Test completed -> done
    sample_action.from_status = "in_progress"
    sample_action.to_status = "completed"
    unified = adapter.action_to_unified(sample_action)
    assert unified.fromStatus == "in_progress"
    assert unified.toStatus == "done"

    # Test cancelled -> closed
    sample_action.to_status = "cancelled"
    unified = adapter.action_to_unified(sample_action)
    assert unified.toStatus == "closed"


def test_settings_to_unified(adapter):
    """Test settings DTO conversion."""
    settings = AISettings(
        thresholds=ThresholdsSettings(
            defaultLowStockThreshold=5,
            maintenanceOverdueDays=30,
            chemicalThresholdOverrides={},
        ),
        approvalStrategy=ApprovalStrategySettings(
            highRiskRequiresApproval=True,
            equipmentFaultRequiresApproval=True,
            maintenanceOverdueRequiresApproval=False,
        ),
        sla=SLASettings(
            openMinutes=240,
            inProgressMinutes=480,
            pendingApprovalMinutes=180,
            reminderIntervalMinutes=60,
            maxReminderCountBeforeEscalation=2,
        ),
        updatedAt="2026-05-05T10:00:00Z",
    )

    unified = adapter.settings_to_unified(settings)

    assert isinstance(unified, UnifiedSettingsDTO)
    assert unified.thresholds["defaultLowStockThreshold"] == 5
    assert unified.sla["openMinutes"] == 240
    assert unified.approvalStrategy["highRiskRequiresApproval"] is True


def test_status_mapping_round_trip(adapter):
    """Test that status mappings are consistent."""
    # Test formal -> compat -> formal consistency
    formal_statuses = ["open", "in_progress", "blocked", "completed", "cancelled"]

    for formal_status in formal_statuses:
        compat_status = adapter.FORMAL_TO_COMPAT_STATUS.get(formal_status, formal_status)
        # Note: Some mappings are lossy (blocked -> in_progress)
        # This is expected behavior

        # Verify compat status is valid
        assert compat_status in ["open", "in_progress", "pending_approval", "done", "closed"]


def test_type_mapping_consistency(adapter):
    """Test that type mappings are consistent."""
    # All formal types should map to valid compat types
    formal_types = [
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

    for formal_type in formal_types:
        compat_type = adapter.FORMAL_TO_COMPAT_TYPE.get(formal_type, formal_type)
        # Verify compat type is valid
        assert compat_type in ["restock", "maintenance", "anomaly_review", "data_fix", "other"]


def test_task_with_null_fields(adapter):
    """Test task conversion with null optional fields."""
    now = datetime.now(timezone.utc)
    task = AITaskDTO(
        id="task_002",
        event_id=None,  # Null
        type="restock",
        title="Restock item",
        summary="Summary",
        recommendation="Recommendation",
        status="open",
        priority="low",
        risk_level="low",
        source_type="chemical",
        source_id="chem_001",
        source_name="Chemical Y",
        assignee_id=None,  # Null
        assignee_name=None,  # Null
        assignee_role=None,  # Null
        requires_approval=False,
        due_at=None,  # Null
        created_at=now,
        updated_at=now,
        closed_at=None,  # Null
        metadata={},
    )

    unified = adapter.task_to_unified(task)

    assert unified.eventId is None
    assert unified.assigneeId is None
    assert unified.assigneeName is None
    assert unified.assigneeRole is None
    assert unified.dueAt is None
    assert unified.closedAt is None
