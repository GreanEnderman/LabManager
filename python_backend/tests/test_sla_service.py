"""Tests for SLA service."""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from app.sla.service import SLAService, _to_minutes, _get_threshold_minutes, _inspect_task
from app.sla.repository import update_task_sla_metadata
from app.sla.models import (
    SLAConfig,
    InspectTaskSLARequest,
    ExecuteTaskSLARequest,
)
from app.tasks.models import (
    AITaskRecord,
    AuditActor,
)


@pytest.fixture
def sla_config():
    """Default SLA configuration."""
    return SLAConfig(
        open_minutes=240,
        in_progress_minutes=480,
        pending_approval_minutes=180,
        reminder_interval_minutes=60,
        max_reminder_count_before_escalation=2,
    )


@pytest.fixture
def system_actor():
    """System actor for SLA actions."""
    return AuditActor(
        id="system",
        name="SLA Monitor",
        type="system",
    )


@pytest.fixture
def sample_task():
    """Sample task for testing."""
    now = datetime.now(timezone.utc)
    return AITaskRecord(
        id="task_001",
        event_id="event_001",
        type="restock",
        title="Low stock alert",
        summary="Chemical X is low",
        recommendation="Restock chemical X",
        status="open",
        priority="medium",
        risk_level="low",
        source_type="chemical",
        source_id="chem_001",
        source_name="Chemical X",
        assignee_id=None,
        assignee_name=None,
        assignee_role=None,
        requires_approval=False,
        due_at=None,
        created_at=now - timedelta(hours=5),  # 5 hours ago
        updated_at=now - timedelta(hours=5),
        closed_at=None,
        metadata={},
    )


def test_to_minutes():
    """Test minutes calculation."""
    start = datetime(2026, 5, 5, 10, 0, 0, tzinfo=timezone.utc)
    end = datetime(2026, 5, 5, 12, 30, 0, tzinfo=timezone.utc)

    assert _to_minutes(start, end) == 150

    # Test negative diff returns 0
    assert _to_minutes(end, start) == 0


def test_get_threshold_minutes(sla_config):
    """Test threshold retrieval for different statuses."""
    assert _get_threshold_minutes("open", sla_config) == 240
    assert _get_threshold_minutes("in_progress", sla_config) == 480
    assert _get_threshold_minutes("pending_approval", sla_config) == 180
    assert _get_threshold_minutes("completed", sla_config) is None
    assert _get_threshold_minutes("cancelled", sla_config) is None


def test_inspect_task_no_violation(sample_task, sla_config):
    """Test inspecting task with no SLA violation."""
    now = sample_task.created_at + timedelta(hours=2)  # Only 2 hours overdue
    request = InspectTaskSLARequest(now=now, config=sla_config)

    result = _inspect_task(sample_task, request)

    assert result is None  # No violation yet


def test_inspect_task_should_remind(sample_task, sla_config):
    """Test inspecting task that should trigger reminder."""
    now = sample_task.created_at + timedelta(hours=5)  # 5 hours = 300 minutes > 240 threshold
    request = InspectTaskSLARequest(now=now, config=sla_config)

    result = _inspect_task(sample_task, request)

    assert result is not None
    assert result.overdue_minutes >= 240
    assert result.threshold_minutes == 240
    assert result.reminder_count == 0
    assert result.should_remind is True
    assert result.should_escalate is False


def test_inspect_task_should_escalate(sample_task, sla_config):
    """Test inspecting task that should be escalated."""
    # Task with 2 reminders already sent
    sample_task.metadata = {"slaReminderCount": 2}
    now = sample_task.created_at + timedelta(hours=5)
    request = InspectTaskSLARequest(now=now, config=sla_config)

    result = _inspect_task(sample_task, request)

    assert result is not None
    assert result.reminder_count == 2
    assert result.should_remind is False
    assert result.should_escalate is True


def test_inspect_task_already_escalated(sample_task, sla_config):
    """Test inspecting task that's already escalated."""
    sample_task.metadata = {"slaEscalated": True, "slaReminderCount": 2}
    now = sample_task.created_at + timedelta(hours=5)
    request = InspectTaskSLARequest(now=now, config=sla_config)

    result = _inspect_task(sample_task, request)

    assert result is not None
    assert result.should_remind is False
    assert result.should_escalate is False  # Already escalated


def test_inspect_task_completed_status(sample_task, sla_config):
    """Test inspecting completed task (should be skipped)."""
    sample_task.status = "completed"
    now = sample_task.created_at + timedelta(hours=5)
    request = InspectTaskSLARequest(now=now, config=sla_config)

    result = _inspect_task(sample_task, request)

    assert result is None  # Completed tasks not inspected


@pytest.mark.asyncio
async def test_sla_service_inspect():
    """Test SLA service inspection."""
    mock_conn = AsyncMock()
    service = SLAService(mock_conn)

    now = datetime.now(timezone.utc)
    old_task = AITaskRecord(
        id="task_001",
        event_id="event_001",
        type="restock",
        title="Old task",
        summary="Summary",
        recommendation="Recommendation",
        status="open",
        priority="medium",
        risk_level="low",
        source_type="chemical",
        source_id="chem_001",
        source_name="Chemical X",
        created_at=now - timedelta(hours=6),
        updated_at=now - timedelta(hours=6),
        metadata={},
    )

    recent_task = AITaskRecord(
        id="task_002",
        event_id="event_002",
        type="maintenance",
        title="Recent task",
        summary="Summary",
        recommendation="Recommendation",
        status="in_progress",
        priority="high",
        risk_level="medium",
        source_type="equipment",
        source_id="eq_001",
        source_name="Equipment Y",
        created_at=now - timedelta(hours=2),
        updated_at=now - timedelta(hours=2),
        metadata={},
    )

    with patch("app.sla.service.list_tasks_for_sla_inspection") as mock_list:
        mock_list.return_value = [old_task, recent_task]

        config = SLAConfig(
            open_minutes=240,
            in_progress_minutes=480,
            pending_approval_minutes=180,
            reminder_interval_minutes=60,
            max_reminder_count_before_escalation=2,
        )

        request = InspectTaskSLARequest(now=now, config=config)
        response = await service.inspect(request)

        # Only old_task should be in results (6 hours > 4 hour threshold)
        assert len(response.items) == 1
        assert response.items[0].task.id == "task_001"
        assert response.items[0].should_remind is True


@pytest.mark.asyncio
async def test_sla_service_execute_reminder():
    """Test SLA service execution with reminder."""
    mock_conn = AsyncMock()
    service = SLAService(mock_conn)

    now = datetime.now(timezone.utc)
    task = AITaskRecord(
        id="task_001",
        event_id="event_001",
        type="restock",
        title="Overdue task",
        summary="Summary",
        recommendation="Recommendation",
        status="open",
        priority="medium",
        risk_level="low",
        source_type="chemical",
        source_id="chem_001",
        source_name="Chemical X",
        created_at=now - timedelta(hours=5),
        updated_at=now - timedelta(hours=5),
        metadata={},
    )

    with patch("app.sla.service.list_tasks_for_sla_inspection") as mock_list, \
         patch("app.sla.service.update_task_sla_metadata") as mock_update, \
         patch("app.sla.service.create_task_action") as mock_create_action:

        mock_list.return_value = [task]

        config = SLAConfig(
            open_minutes=240,
            in_progress_minutes=480,
            pending_approval_minutes=180,
            reminder_interval_minutes=60,
            max_reminder_count_before_escalation=2,
        )

        actor = AuditActor(id="system", name="SLA Monitor", type="system")
        request = ExecuteTaskSLARequest(now=now, config=config, actor=actor)

        response = await service.execute(request)

        # Should create 1 reminder
        assert len(response.reminders) == 1
        assert len(response.escalations) == 0
        assert response.reminders[0].task_id == "task_001"
        assert response.reminders[0].action_type == "sla_reminder_sent"

        # Verify metadata update was called
        mock_update.assert_called_once()
        call_args = mock_update.call_args
        # call_args[0] contains positional args, call_args[1] contains kwargs
        assert call_args[0][1] == "task_001"  # task_id is second positional arg
        assert call_args[0][2]["slaReminderCount"] == 1  # metadata_patch is third arg


@pytest.mark.asyncio
async def test_update_task_sla_metadata_wraps_json_patch():
    """Test SLA metadata patch is adapted as JSON for psycopg."""
    mock_conn = MagicMock()
    mock_cursor = AsyncMock()
    mock_conn.cursor.return_value.__aenter__.return_value = mock_cursor

    await update_task_sla_metadata(
        mock_conn,
        "task_001",
        {"slaReminderCount": 1},
        "2026-05-23T16:32:26Z",
    )

    args = mock_cursor.execute.call_args.args[1]
    assert args[0].obj == {"slaReminderCount": 1}
    assert args[1] == "2026-05-23T16:32:26Z"
    assert args[2] == "task_001"


@pytest.mark.asyncio
async def test_sla_service_execute_escalation():
    """Test SLA service execution with escalation."""
    mock_conn = AsyncMock()
    service = SLAService(mock_conn)

    now = datetime.now(timezone.utc)
    task = AITaskRecord(
        id="task_001",
        event_id="event_001",
        type="restock",
        title="Overdue task",
        summary="Summary",
        recommendation="Recommendation",
        status="open",
        priority="medium",
        risk_level="low",
        source_type="chemical",
        source_id="chem_001",
        source_name="Chemical X",
        created_at=now - timedelta(hours=5),
        updated_at=now - timedelta(hours=5),
        metadata={"slaReminderCount": 2},  # Already sent 2 reminders
    )

    with patch("app.sla.service.list_tasks_for_sla_inspection") as mock_list, \
         patch("app.sla.service.update_task_sla_metadata") as mock_update, \
         patch("app.sla.service.create_task_action") as mock_create_action:

        mock_list.return_value = [task]

        config = SLAConfig(
            open_minutes=240,
            in_progress_minutes=480,
            pending_approval_minutes=180,
            reminder_interval_minutes=60,
            max_reminder_count_before_escalation=2,
        )

        actor = AuditActor(id="system", name="SLA Monitor", type="system")
        request = ExecuteTaskSLARequest(now=now, config=config, actor=actor)

        response = await service.execute(request)

        # Should create 1 escalation
        assert len(response.reminders) == 0
        assert len(response.escalations) == 1
        assert response.escalations[0].task_id == "task_001"
        assert response.escalations[0].action_type == "task_escalated"

        # Verify metadata update was called with escalation flag
        mock_update.assert_called_once()
        call_args = mock_update.call_args
        # call_args[0] contains positional args
        assert call_args[0][1] == "task_001"  # task_id is second positional arg
        assert call_args[0][2]["slaEscalated"] is True  # metadata_patch is third arg
