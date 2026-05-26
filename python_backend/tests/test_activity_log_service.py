"""Tests for activity log service."""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.activity_logs.service import ActivityLogService
from app.tasks.models import TaskActionDTO, AuditActor


@pytest.fixture
def sample_actions():
    """Sample task actions for testing."""
    now = datetime.now(timezone.utc)
    actor1 = AuditActor(id="user_001", name="Alice", type="user")
    actor2 = AuditActor(id="user_002", name="Bob", type="user")

    return [
        TaskActionDTO(
            id="action_001",
            task_id="task_001",
            approval_id=None,
            action_type="task_created",
            from_status=None,
            to_status="open",
            actor=actor1,
            reason_codes=["manual_creation"],
            detail="Task created manually",
            tool_name=None,
            snapshot={},
            created_at=now - timedelta(hours=3),
        ),
        TaskActionDTO(
            id="action_002",
            task_id="task_001",
            approval_id=None,
            action_type="status_changed",
            from_status="open",
            to_status="in_progress",
            actor=actor2,
            reason_codes=["started_work"],
            detail="Started working on task",
            tool_name=None,
            snapshot={},
            created_at=now - timedelta(hours=2),
        ),
        TaskActionDTO(
            id="action_003",
            task_id="task_002",
            approval_id="approval_001",
            action_type="approval_requested",
            from_status="in_progress",
            to_status="in_progress",
            actor=actor1,
            reason_codes=["requires_approval"],
            detail="Approval requested",
            tool_name=None,
            snapshot={},
            created_at=now - timedelta(hours=1),
        ),
    ]


@pytest.mark.asyncio
async def test_list_task_actions(sample_actions):
    """Test listing actions for a specific task."""
    mock_conn = AsyncMock()
    service = ActivityLogService(mock_conn)

    with patch("app.activity_logs.service.list_task_actions") as mock_list:
        mock_list.return_value = [sample_actions[0], sample_actions[1]]

        result = await service.list_task_actions("task_001", limit=100, offset=0)

        assert len(result) == 2
        assert result[0].id == "action_001"
        assert result[1].id == "action_002"
        mock_list.assert_called_once_with(mock_conn, "task_001")


@pytest.mark.asyncio
async def test_list_task_actions_with_pagination(sample_actions):
    """Test pagination in list_task_actions."""
    mock_conn = AsyncMock()
    service = ActivityLogService(mock_conn)

    with patch("app.activity_logs.service.list_task_actions") as mock_list:
        mock_list.return_value = sample_actions[:2]

        # Get second page (offset=1, limit=1)
        result = await service.list_task_actions("task_001", limit=1, offset=1)

        assert len(result) == 1
        assert result[0].id == "action_002"


@pytest.mark.asyncio
async def test_list_actions_by_type():
    """Test filtering actions by type."""
    mock_conn = MagicMock()
    service = ActivityLogService(mock_conn)

    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=1)
    end_date = now

    # Mock cursor as async context manager
    mock_cursor = AsyncMock()
    mock_cursor.fetchall = AsyncMock(return_value=[
        (
            "action_001",
            "task_001",
            None,
            "task_created",
            None,
            "open",
            {"id": "user_001", "name": "Alice", "type": "user"},
            ["manual_creation"],
            "Task created",
            None,
            {},
            now - timedelta(hours=2),
        ),
    ])
    mock_cursor.execute = AsyncMock()
    mock_cursor.__aenter__ = AsyncMock(return_value=mock_cursor)
    mock_cursor.__aexit__ = AsyncMock(return_value=None)

    mock_conn.cursor = MagicMock(return_value=mock_cursor)

    result = await service.list_actions_by_type(
        "task_created", start_date, end_date, limit=100, offset=0
    )

    assert len(result) == 1
    assert result[0].action_type == "task_created"
    assert result[0].task_id == "task_001"


@pytest.mark.asyncio
async def test_list_actions_by_actor():
    """Test filtering actions by actor."""
    mock_conn = MagicMock()
    service = ActivityLogService(mock_conn)

    now = datetime.now(timezone.utc)

    # Mock cursor as async context manager
    mock_cursor = AsyncMock()
    mock_cursor.fetchall = AsyncMock(return_value=[
        (
            "action_001",
            "task_001",
            None,
            "task_created",
            None,
            "open",
            {"id": "user_001", "name": "Alice", "type": "user"},
            ["manual_creation"],
            "Task created by Alice",
            None,
            {},
            now - timedelta(hours=2),
        ),
        (
            "action_003",
            "task_002",
            "approval_001",
            "approval_requested",
            "in_progress",
            "in_progress",
            {"id": "user_001", "name": "Alice", "type": "user"},
            ["requires_approval"],
            "Approval requested by Alice",
            None,
            {},
            now - timedelta(hours=1),
        ),
    ])
    mock_cursor.execute = AsyncMock()
    mock_cursor.__aenter__ = AsyncMock(return_value=mock_cursor)
    mock_cursor.__aexit__ = AsyncMock(return_value=None)

    mock_conn.cursor = MagicMock(return_value=mock_cursor)

    result = await service.list_actions_by_actor("user_001", limit=100, offset=0)

    assert len(result) == 2
    assert all(action.actor.id == "user_001" for action in result)


@pytest.mark.asyncio
async def test_list_actions_by_approval():
    """Test filtering actions by approval ID."""
    mock_conn = MagicMock()
    service = ActivityLogService(mock_conn)

    now = datetime.now(timezone.utc)

    # Mock cursor as async context manager
    mock_cursor = AsyncMock()
    mock_cursor.fetchall = AsyncMock(return_value=[
        (
            "action_003",
            "task_002",
            "approval_001",
            "approval_requested",
            "in_progress",
            "in_progress",
            {"id": "user_001", "name": "Alice", "type": "user"},
            ["requires_approval"],
            "Approval requested",
            None,
            {},
            now - timedelta(hours=1),
        ),
    ])
    mock_cursor.execute = AsyncMock()
    mock_cursor.__aenter__ = AsyncMock(return_value=mock_cursor)
    mock_cursor.__aexit__ = AsyncMock(return_value=None)

    mock_conn.cursor = MagicMock(return_value=mock_cursor)

    result = await service.list_actions_by_approval("approval_001", limit=100, offset=0)

    assert len(result) == 1
    assert result[0].approval_id == "approval_001"


@pytest.mark.asyncio
async def test_get_cross_task_activity():
    """Test getting cross-task activity view."""
    mock_conn = MagicMock()
    service = ActivityLogService(mock_conn)

    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=7)
    end_date = now

    # Mock cursor as async context manager
    mock_cursor = AsyncMock()
    mock_cursor.fetchall = AsyncMock(return_value=[
        (
            "action_001",
            "task_001",
            None,
            "task_created",
            None,
            "open",
            {"id": "user_001", "name": "Alice", "type": "user"},
            ["manual_creation"],
            "Task 1 created",
            None,
            {},
            now - timedelta(days=3),
        ),
        (
            "action_002",
            "task_002",
            None,
            "task_created",
            None,
            "open",
            {"id": "user_002", "name": "Bob", "type": "user"},
            ["manual_creation"],
            "Task 2 created",
            None,
            {},
            now - timedelta(days=2),
        ),
    ])
    mock_cursor.execute = AsyncMock()
    mock_cursor.__aenter__ = AsyncMock(return_value=mock_cursor)
    mock_cursor.__aexit__ = AsyncMock(return_value=None)

    mock_conn.cursor = MagicMock(return_value=mock_cursor)

    result = await service.get_cross_task_activity(
        start_date, end_date, limit=1000, offset=0
    )

    assert len(result) == 2
    assert result[0].task_id == "task_001"
    assert result[1].task_id == "task_002"


@pytest.mark.asyncio
async def test_get_cross_task_activity_with_action_types():
    """Test cross-task activity with action type filter."""
    mock_conn = MagicMock()
    service = ActivityLogService(mock_conn)

    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=7)
    end_date = now

    # Mock cursor as async context manager
    mock_cursor = AsyncMock()
    mock_cursor.fetchall = AsyncMock(return_value=[
        (
            "action_001",
            "task_001",
            None,
            "sla_reminder_sent",
            "open",
            "open",
            {"id": "system", "name": "SLA Monitor", "type": "system"},
            ["sla_timeout"],
            "SLA reminder sent",
            None,
            {},
            now - timedelta(days=1),
        ),
    ])
    mock_cursor.execute = AsyncMock()
    mock_cursor.__aenter__ = AsyncMock(return_value=mock_cursor)
    mock_cursor.__aexit__ = AsyncMock(return_value=None)

    mock_conn.cursor = MagicMock(return_value=mock_cursor)

    result = await service.get_cross_task_activity(
        start_date,
        end_date,
        action_types=["sla_reminder_sent", "task_escalated"],
        limit=1000,
        offset=0,
    )

    assert len(result) == 1
    assert result[0].action_type == "sla_reminder_sent"
