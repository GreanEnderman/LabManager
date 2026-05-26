import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from app.graphs.tools import TaskServiceTaskTool
from app.tasks.models import AITaskDTO
from app.tasks.service import TaskService


def test_task_service_task_tool_maps_create_request_to_formal_task(monkeypatch) -> None:
    captured: dict[str, object] = {}

    async def fake_create_task(self, request, actor):
        captured["request"] = request
        captured["actor"] = actor
        now = datetime(2026, 5, 4, tzinfo=timezone.utc)
        return AITaskDTO(
            id="task_formal_001",
            event_id=request.event_id,
            type=request.type,
            title=request.title,
            summary=request.summary,
            recommendation=request.recommendation,
            status="open",
            priority=request.priority,
            risk_level=request.risk_level,
            source_type=request.source_type,
            source_id=request.source_id,
            source_name=request.source_name,
            assignee_id=request.assignee_id,
            assignee_name=request.assignee_name,
            assignee_role=request.assignee_role,
            requires_approval=request.requires_approval,
            due_at=request.due_at,
            created_at=now,
            updated_at=now,
            closed_at=None,
            metadata=request.metadata,
        )

    monkeypatch.setattr(TaskService, "create_task", fake_create_task)

    @asynccontextmanager
    async def fake_connection():
        yield object()

    tool = TaskServiceTaskTool(fake_connection)
    created = asyncio.run(
        tool.create_task(
            {
                "id": "task-draft-001",
                "eventId": "event-001",
                "type": "anomaly_review",
                "title": "Equipment abnormal",
                "summary": "Equipment status requires review.",
                "recommendation": "Investigate and contain if needed.",
                "priority": "high",
                "riskLevel": "high",
                "sourceType": "equipment",
                "sourceId": "equip-001",
                "sourceName": "HPLC",
                "assigneeRole": "equipment-manager",
                "requiresApproval": True,
                "dueAt": "2026-05-04T04:00:00Z",
                "metadata": {"evidence": [{"label": "Status", "value": "fault"}]},
            },
            actor={"id": "tester", "name": "Tester", "type": "user"},
        )
    )

    request = captured["request"]
    actor = captured["actor"]
    assert request.type == "inspection"
    assert request.metadata["compatTaskType"] == "anomaly_review"
    assert request.evidence[0].type == "observation"
    assert request.evidence[0].label == "Status"
    assert actor.id == "tester"
    assert created["id"] == "task_formal_001"
    assert created["type"] == "anomaly_review"
    assert created["status"] == "open"


def test_task_service_task_tool_maps_existing_formal_task_back_to_compat(monkeypatch) -> None:
    captured: dict[str, object] = {}

    async def fake_list_tasks(self, query):
        captured["query"] = query
        now = datetime(2026, 5, 4, tzinfo=timezone.utc)
        return [
            AITaskDTO(
                id="task_formal_002",
                event_id="event-dup-001",
                type="inspection",
                title="Existing anomaly review",
                summary="Existing task should be reused.",
                recommendation="Reuse current task.",
                status="blocked",
                priority="high",
                risk_level="high",
                source_type="equipment",
                source_id="equip-dup-001",
                source_name="GC-MS",
                assignee_id=None,
                assignee_name=None,
                assignee_role="equipment-manager",
                requires_approval=True,
                due_at=now,
                created_at=now,
                updated_at=now,
                closed_at=None,
                metadata={"compatTaskType": "anomaly_review"},
            )
        ]

    monkeypatch.setattr(TaskService, "list_tasks", fake_list_tasks)

    @asynccontextmanager
    async def fake_connection():
        yield object()

    tool = TaskServiceTaskTool(fake_connection)
    existing = asyncio.run(
        tool.find_existing_open_task(
            event_id="event-dup-001",
            source_id="equip-dup-001",
            task_type="anomaly_review",
        )
    )

    assert captured["query"].type == "inspection"
    assert existing["id"] == "task_formal_002"
    assert existing["type"] == "anomaly_review"
    assert existing["status"] == "in_progress"

