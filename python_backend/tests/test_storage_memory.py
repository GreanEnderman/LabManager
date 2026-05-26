"""Tests for storage implementations."""

import pytest
from datetime import datetime, timezone

from app.storage.memory import InMemoryAIStorage
from app.storage.factory import create_storage, StorageMode
from app.tasks.models import AITaskRecord, ListTasksQuery
from app.approvals.models import AIApprovalRecord, AuditActor
from app.settings.models import AISettings, ThresholdsSettings, ApprovalStrategySettings, SLASettings


@pytest.fixture
def memory_storage():
    """Create in-memory storage instance."""
    return InMemoryAIStorage()


@pytest.fixture
def sample_task():
    """Sample task record."""
    now = datetime.now(timezone.utc)
    return AITaskRecord(
        id="task_001",
        event_id="event_001",
        type="restock",
        title="Restock item",
        summary="Summary",
        recommendation="Recommendation",
        status="open",
        priority="medium",
        risk_level="low",
        source_type="chemical",
        source_id="chem_001",
        source_name="Chemical X",
        created_at=now,
        updated_at=now,
        metadata={},
    )


@pytest.mark.asyncio
async def test_create_and_get_task(memory_storage, sample_task):
    """Test creating and retrieving a task."""
    # Create task
    created = await memory_storage.create_task(sample_task)
    assert created.id == sample_task.id

    # Get task
    retrieved = await memory_storage.get_task(sample_task.id)
    assert retrieved is not None
    assert retrieved.id == sample_task.id
    assert retrieved.title == sample_task.title


@pytest.mark.asyncio
async def test_list_tasks_with_filters(memory_storage, sample_task):
    """Test listing tasks with filters."""
    # Create multiple tasks
    await memory_storage.create_task(sample_task)

    task2 = sample_task.model_copy()
    task2.id = "task_002"
    task2.status = "in_progress"
    await memory_storage.create_task(task2)

    # List all tasks
    query = ListTasksQuery()
    all_tasks = await memory_storage.list_tasks(query)
    assert len(all_tasks) == 2

    # Filter by status
    query = ListTasksQuery(status="open")
    open_tasks = await memory_storage.list_tasks(query)
    assert len(open_tasks) == 1
    assert open_tasks[0].status == "open"


@pytest.mark.asyncio
async def test_update_task(memory_storage, sample_task):
    """Test updating a task."""
    # Create task
    await memory_storage.create_task(sample_task)

    # Update task
    updates = {"title": "Updated title", "priority": "high"}
    updated = await memory_storage.update_task(sample_task.id, updates)

    assert updated is not None
    assert updated.title == "Updated title"
    assert updated.priority == "high"


@pytest.mark.asyncio
async def test_update_task_status(memory_storage, sample_task):
    """Test updating task status."""
    # Create task
    await memory_storage.create_task(sample_task)

    # Update status
    now = datetime.now(timezone.utc)
    success = await memory_storage.update_task_status(sample_task.id, "completed", now)

    assert success is True

    # Verify update
    task = await memory_storage.get_task(sample_task.id)
    assert task.status == "completed"
    assert task.closed_at == now


@pytest.mark.asyncio
async def test_create_and_get_approval(memory_storage):
    """Test creating and retrieving an approval."""
    now = datetime.now(timezone.utc)
    approval = AIApprovalRecord(
        id="approval_001",
        task_id="task_001",
        title="Approve task",
        reason="High risk",
        status="pending",
        risk_level="high",
        requested_by=AuditActor(id="user_001", name="Alice", type="user"),
        created_at=now,
        updated_at=now,
        metadata={},
    )

    # Create approval
    created = await memory_storage.create_approval(approval)
    assert created.id == approval.id

    # Get approval
    retrieved = await memory_storage.get_approval(approval.id)
    assert retrieved is not None
    assert retrieved.id == approval.id


@pytest.mark.asyncio
async def test_list_approvals_by_task(memory_storage):
    """Test listing approvals filtered by task."""
    now = datetime.now(timezone.utc)

    # Create approvals for different tasks
    approval1 = AIApprovalRecord(
        id="approval_001",
        task_id="task_001",
        title="Approval 1",
        reason="Reason",
        status="pending",
        risk_level="high",
        requested_by=AuditActor(id="user_001", name="Alice", type="user"),
        created_at=now,
        updated_at=now,
        metadata={},
    )

    approval2 = AIApprovalRecord(
        id="approval_002",
        task_id="task_002",
        title="Approval 2",
        reason="Reason",
        status="pending",
        risk_level="medium",
        requested_by=AuditActor(id="user_002", name="Bob", type="user"),
        created_at=now,
        updated_at=now,
        metadata={},
    )

    await memory_storage.create_approval(approval1)
    await memory_storage.create_approval(approval2)

    # List all approvals
    all_approvals = await memory_storage.list_approvals()
    assert len(all_approvals) == 2

    # Filter by task
    task1_approvals = await memory_storage.list_approvals(task_id="task_001")
    assert len(task1_approvals) == 1
    assert task1_approvals[0].task_id == "task_001"


@pytest.mark.asyncio
async def test_settings_operations(memory_storage):
    """Test settings save and retrieve."""
    settings = AISettings(
        thresholds=ThresholdsSettings(),
        approvalStrategy=ApprovalStrategySettings(),
        sla=SLASettings(),
        updatedAt="2026-05-05T10:00:00Z",
    )

    # Save settings
    await memory_storage.save_settings("default", settings)

    # Get settings
    retrieved = await memory_storage.get_settings("default")
    assert retrieved is not None
    assert retrieved.sla.openMinutes == 240


@pytest.mark.asyncio
async def test_clear_all(memory_storage, sample_task):
    """Test clearing all data."""
    # Create some data
    await memory_storage.create_task(sample_task)

    # Verify data exists
    tasks = await memory_storage.list_tasks(ListTasksQuery())
    assert len(tasks) == 1

    # Clear all
    await memory_storage.clear_all()

    # Verify data is gone
    tasks = await memory_storage.list_tasks(ListTasksQuery())
    assert len(tasks) == 0


def test_create_storage_factory():
    """Test storage factory."""
    # Create memory storage
    storage = create_storage(StorageMode.MEMORY)
    assert isinstance(storage, InMemoryAIStorage)

    # PostgreSQL storage should raise error without connection
    with pytest.raises(ValueError, match="PostgreSQL storage requires"):
        create_storage(StorageMode.POSTGRES)
