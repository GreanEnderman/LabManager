from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.api import ai_compat
from app.approvals.models import AIApprovalDTO
from app.gateway.routing import Capability, ServiceTarget, set_capability_target_override
from app.graphs.tools import SupervisorTools
from app.main import create_app
from app.tasks.models import AITaskDTO, AuditActor, TaskActionDTO, TaskDetailDTO


def test_ai_compat_health_returns_frontend_envelope() -> None:
    client = TestClient(create_app())

    response = client.get("/api/ai/health")

    assert response.status_code == 200
    body = response.json()
    assert body["error"] is None
    assert body["data"]["capabilities"]["rules"] == "compat_fallback"
    assert "tasks" in body["data"]
    assert "chemicals" in body["data"]
    assert "equipment" in body["data"]


def test_ai_compat_rules_to_task_contract() -> None:
    client = TestClient(create_app())

    inspect_response = client.post(
        "/api/ai/rules/inspect",
        json={
            "input": {
                "chemicals": [
                    {
                        "id": "chem-low",
                        "name": "Low stock item",
                        "totalQuantity": 1,
                        "threshold": 5,
                    }
                ],
                "equipment": [],
            },
            "config": {"now": "2026-05-04T00:00:00Z", "maintenanceOverdueDays": 30},
        },
    )

    assert inspect_response.status_code == 200
    event = inspect_response.json()["data"]["items"][0]["event"]
    assert event["type"] == "low_stock"
    assert event["sourceType"] == "chemical"

    execute_response = client.post(
        "/api/ai/rules/execute",
        json={
            "runId": "test-run",
            "actor": {"id": "tester", "name": "Tester", "type": "user"},
            "event": event,
        },
    )

    assert execute_response.status_code == 200
    state = execute_response.json()["data"]["state"]
    task_id = state["output"]["taskId"]
    assert task_id

    task_response = client.get(f"/api/ai/tasks/{task_id}")
    task_detail = task_response.json()["data"]
    assert task_detail["task"]["eventId"] == event["id"]
    assert task_detail["actions"][0]["actionType"] == "task_created"


def test_ai_compat_task_approval_and_report_contracts() -> None:
    client = TestClient(create_app())

    tasks = client.get("/api/ai/tasks").json()["data"]
    task_id = tasks[0]["id"]

    status_response = client.patch(
        f"/api/ai/tasks/{task_id}/status",
        json={
            "transition": "request_approval",
            "detail": "Request approval from test.",
            "actor": {"id": "tester", "name": "Tester", "type": "user"},
        },
    )
    assert status_response.status_code == 200
    assert status_response.json()["data"]["task"]["status"] == "pending_approval"

    approval_response = client.post(
        "/api/ai/approvals",
        json={
            "taskId": task_id,
            "title": "Test approval",
            "reason": "Compatibility test",
            "riskLevel": "medium",
            "actor": {"id": "tester", "name": "Tester", "type": "user"},
        },
    )
    approval = approval_response.json()["data"]["approval"]
    assert approval["status"] == "pending"

    process_response = client.patch(
        f"/api/ai/approvals/{approval['id']}/process",
        json={
            "decision": "approve",
            "comment": "Approved in compatibility test.",
            "actor": {"id": "tester", "name": "Tester", "type": "user"},
        },
    )
    assert process_response.status_code == 200
    assert process_response.json()["data"]["approval"]["status"] == "approved"

    report_response = client.post("/api/ai/reports/generate", json={"type": "daily", "now": "2026-05-04T00:00:00Z"})
    report = report_response.json()["data"]["report"]
    assert report["id"]
    assert report["metadata"]["sections"][0]["title"] == "Generated"

    pdf_response = client.get(f"/api/ai/reports/{report['id']}/pdf")
    pdf = pdf_response.json()["data"]
    assert pdf["mimeType"] == "application/pdf"
    assert pdf["fileName"].endswith(".pdf")
    assert pdf["contentBase64"]


def test_ai_compat_rules_execute_switches_to_python_graph() -> None:
    set_capability_target_override(Capability.RULES, ServiceTarget.PYTHON_BACKEND)
    try:
        client = TestClient(create_app())

        execute_response = client.post(
            "/api/ai/rules/execute",
            json={
                "runId": "graph-run",
                "actor": {"id": "tester", "name": "Tester", "type": "user"},
                "event": {
                    "id": "event-graph-low-stock",
                    "type": "low_stock",
                    "sourceType": "chemical",
                    "sourceId": "chem-graph-001",
                    "sourceName": "Graph chemical",
                    "title": "Graph low stock",
                    "summary": "Graph-created task.",
                    "priority": "medium",
                    "riskLevel": "medium",
                },
            },
        )

        assert execute_response.status_code == 200
        state = execute_response.json()["data"]["state"]
        assert state["output"]["taskId"]
        assert state["context"]["existingOpenTask"] is None
        assert state["task"]["id"] == state["output"]["taskId"]
        assert state["activityLogCount"] > 0

        task_response = client.get(f"/api/ai/tasks/{state['output']['taskId']}")
        task_detail = task_response.json()["data"]
        assert any(action["actionType"] == "task_created" for action in task_detail["actions"])
    finally:
        set_capability_target_override(Capability.RULES, None)


def test_ai_compat_rules_execute_uses_async_tooling_path(monkeypatch) -> None:
    class FakeTaskTool:
        async def find_existing_open_task(self, event_id: str, source_id: str, task_type: str):
            return None

        async def create_task(self, task_draft, actor=None):
            return {
                **task_draft,
                "id": "task-async-tool-001",
                "assigneeRole": task_draft.get("assigneeRole") or "warehouse-manager",
            }

    monkeypatch.setattr(
        ai_compat,
        "resolve_supervisor_tools",
        lambda: SupervisorTools(
            task_tool=FakeTaskTool(),
            approval_tool=ai_compat._supervisor_tools.approval_tool,
            audit_log_tool=ai_compat._supervisor_tools.audit_log_tool,
        ),
    )

    set_capability_target_override(Capability.RULES, ServiceTarget.PYTHON_BACKEND)
    try:
        client = TestClient(create_app())
        response = client.post(
            "/api/ai/rules/execute",
            json={
                "runId": "graph-run-async-tool",
                "actor": {"id": "tester", "name": "Tester", "type": "user"},
                "event": {
                    "id": "event-graph-async-001",
                    "type": "low_stock",
                    "sourceType": "chemical",
                    "sourceId": "chem-async-001",
                    "sourceName": "Async graph chemical",
                    "title": "Async graph low stock",
                    "summary": "Async tool path task.",
                    "priority": "medium",
                    "riskLevel": "medium",
                },
            },
        )

        assert response.status_code == 200
        state = response.json()["data"]["state"]
        assert state["output"]["taskId"] == "task-async-tool-001"
        assert state["task"]["id"] == "task-async-tool-001"
        assert state["activityLogCount"] > 0

        task_response = client.get("/api/ai/tasks/task-async-tool-001")
        assert task_response.status_code == 200
        assert task_response.json()["data"]["task"]["id"] == "task-async-tool-001"
    finally:
        set_capability_target_override(Capability.RULES, None)


def test_ai_compat_tasks_switch_to_formal_service(monkeypatch) -> None:
    now = datetime(2026, 5, 5, tzinfo=timezone.utc)

    class FakeTaskService:
        async def list_tasks(self, query):
            return [
                AITaskDTO(
                    id="task-formal-001",
                    event_id="event-formal-001",
                    type="inspection",
                    title="Formal anomaly review",
                    summary="Formal task from TaskService.",
                    recommendation="Review and document.",
                    status="blocked",
                    priority="high",
                    risk_level="high",
                    source_type="equipment",
                    source_id="equip-001",
                    source_name="GC-MS",
                    assignee_id="owner-001",
                    assignee_name="Owner",
                    assignee_role="equipment-manager",
                    requires_approval=True,
                    due_at=now,
                    created_at=now,
                    updated_at=now,
                    closed_at=None,
                    metadata={"compatTaskType": "anomaly_review"},
                )
            ]

        async def get_task_detail(self, task_id):
            assert task_id == "task-formal-001"
            return TaskDetailDTO(
                task=(await self.list_tasks(None))[0],
                actions=[
                    TaskActionDTO(
                        id="action-formal-001",
                        task_id="task-formal-001",
                        action_type="task_created",
                        from_status=None,
                        to_status="open",
                        actor=AuditActor(id="system", name="System", type="system"),
                        reason_codes=["manual_request"],
                        detail="Created by formal service.",
                        tool_name=None,
                        snapshot={"requires_approval": True},
                        created_at=now,
                    )
                ],
                approval=None,
            )

        async def update_task_status(self, task_id, request, actor):
            assert task_id == "task-formal-001"
            assert request.transition == "start"
            assert actor.id == "tester"
            return AITaskDTO(
                id="task-formal-001",
                event_id="event-formal-001",
                type="inspection",
                title="Formal anomaly review",
                summary="Formal task from TaskService.",
                recommendation="Review and document.",
                status="in_progress",
                priority="high",
                risk_level="high",
                source_type="equipment",
                source_id="equip-001",
                source_name="GC-MS",
                assignee_id="owner-001",
                assignee_name="Owner",
                assignee_role="equipment-manager",
                requires_approval=True,
                due_at=now,
                created_at=now,
                updated_at=now,
                closed_at=None,
                metadata={"compatTaskType": "anomaly_review"},
            )

        async def assign_task(self, task_id, request, actor):
            assert task_id == "task-formal-001"
            assert request.assignee_id == "owner-002"
            assert actor.id == "tester"
            return AITaskDTO(
                id="task-formal-001",
                event_id="event-formal-001",
                type="inspection",
                title="Formal anomaly review",
                summary="Formal task from TaskService.",
                recommendation="Review and document.",
                status="in_progress",
                priority="high",
                risk_level="high",
                source_type="equipment",
                source_id="equip-001",
                source_name="GC-MS",
                assignee_id="owner-002",
                assignee_name="Next Owner",
                assignee_role="lab-supervisor",
                requires_approval=True,
                due_at=now,
                created_at=now,
                updated_at=now,
                closed_at=None,
                metadata={"compatTaskType": "anomaly_review"},
            )

    @asynccontextmanager
    async def fake_formal_task_service():
        yield FakeTaskService()

    monkeypatch.setattr(ai_compat, "use_formal_task_service_for_tasks", lambda: True)
    monkeypatch.setattr(ai_compat, "get_formal_task_service", fake_formal_task_service)

    set_capability_target_override(Capability.TASKS, ServiceTarget.PYTHON_BACKEND)
    try:
        client = TestClient(create_app())

        list_response = client.get("/api/ai/tasks")
        assert list_response.status_code == 200
        listed_task = list_response.json()["data"][0]
        assert listed_task["id"] == "task-formal-001"
        assert listed_task["type"] == "anomaly_review"
        assert listed_task["status"] == "in_progress"

        detail_response = client.get("/api/ai/tasks/task-formal-001")
        assert detail_response.status_code == 200
        detail = detail_response.json()["data"]
        assert detail["task"]["id"] == "task-formal-001"
        assert detail["actions"][0]["actionType"] == "task_created"

        status_response = client.patch(
            "/api/ai/tasks/task-formal-001/status",
            json={
                "transition": "start_progress",
                "detail": "Begin work.",
                "actor": {"id": "tester", "name": "Tester", "type": "user"},
            },
        )
        assert status_response.status_code == 200
        assert status_response.json()["data"]["task"]["status"] == "in_progress"

        assignee_response = client.patch(
            "/api/ai/tasks/task-formal-001/assignee",
            json={
                "assigneeId": "owner-002",
                "assigneeName": "Next Owner",
                "assigneeRole": "lab-supervisor",
                "reason": "Reassign for follow-up.",
                "actor": {"id": "tester", "name": "Tester", "type": "user"},
            },
        )
        assert assignee_response.status_code == 200
        assert assignee_response.json()["data"]["task"]["assigneeId"] == "owner-002"
    finally:
        set_capability_target_override(Capability.TASKS, None)


def test_ai_compat_formal_task_status_rejects_approval_transition(monkeypatch) -> None:
    @asynccontextmanager
    async def fake_formal_task_service():
        raise AssertionError("formal service should not be called for unsupported transitions")
        yield  # pragma: no cover

    monkeypatch.setattr(ai_compat, "use_formal_task_service_for_tasks", lambda: True)
    monkeypatch.setattr(ai_compat, "get_formal_task_service", fake_formal_task_service)

    set_capability_target_override(Capability.TASKS, ServiceTarget.PYTHON_BACKEND)
    try:
        client = TestClient(create_app())
        response = client.patch(
            "/api/ai/tasks/task-formal-001/status",
            json={
                "transition": "request_approval",
                "detail": "Need approval.",
                "actor": {"id": "tester", "name": "Tester", "type": "user"},
            },
        )
        assert response.status_code == 400
        assert response.json()["detail"]["code"] == "unsupported_transition"
    finally:
        set_capability_target_override(Capability.TASKS, None)


def test_ai_compat_approvals_switch_to_formal_service(monkeypatch) -> None:
    now = datetime(2026, 5, 5, tzinfo=timezone.utc)

    class FakeApprovalService:
        async def list_approvals(self):
            return [
                AIApprovalDTO(
                    id="approval-formal-001",
                    task_id="task-formal-001",
                    title="Formal approval",
                    reason="Need supervisor review.",
                    status="pending",
                    risk_level="high",
                    requested_by=AuditActor(id="tester", name="Tester", type="user"),
                    reviewer_id=None,
                    reviewer_name=None,
                    comment=None,
                    created_at=now,
                    updated_at=now,
                    decided_at=None,
                    metadata={},
                )
            ]

        async def get_latest_task_approval(self, task_id):
            assert task_id == "task-formal-001"
            return (await self.list_approvals())[0]

        async def create_approval(self, request):
            assert request.task_id == "task-formal-001"
            return (await self.list_approvals())[0]

        async def process_approval(self, approval_id, request):
            assert approval_id == "approval-formal-001"
            assert request.decision == "approve"
            return AIApprovalDTO(
                id="approval-formal-001",
                task_id="task-formal-001",
                title="Formal approval",
                reason="Need supervisor review.",
                status="approved",
                risk_level="high",
                requested_by=AuditActor(id="tester", name="Tester", type="user"),
                reviewer_id="reviewer-001",
                reviewer_name="Reviewer",
                comment="Approved.",
                created_at=now,
                updated_at=now,
                decided_at=now,
                metadata={},
            )

    @asynccontextmanager
    async def fake_formal_approval_service():
        yield FakeApprovalService()

    monkeypatch.setattr(ai_compat, "use_formal_approval_service", lambda: True)
    monkeypatch.setattr(ai_compat, "get_formal_approval_service", fake_formal_approval_service)

    set_capability_target_override(Capability.APPROVALS, ServiceTarget.PYTHON_BACKEND)
    try:
        client = TestClient(create_app())

        list_response = client.get("/api/ai/approvals")
        assert list_response.status_code == 200
        approval = list_response.json()["data"][0]
        assert approval["id"] == "approval-formal-001"
        assert approval["status"] == "pending"

        create_response = client.post(
            "/api/ai/approvals",
            json={
                "taskId": "task-formal-001",
                "title": "Formal approval",
                "reason": "Need supervisor review.",
                "riskLevel": "high",
                "actor": {"id": "tester", "name": "Tester", "type": "user"},
            },
        )
        assert create_response.status_code == 200
        assert create_response.json()["data"]["approval"]["id"] == "approval-formal-001"

        process_response = client.patch(
            "/api/ai/approvals/approval-formal-001/process",
            json={
                "decision": "approve",
                "comment": "Approved.",
                "actor": {"id": "reviewer-001", "name": "Reviewer", "type": "user"},
            },
        )
        assert process_response.status_code == 200
        assert process_response.json()["data"]["approval"]["status"] == "approved"
    finally:
        set_capability_target_override(Capability.APPROVALS, None)


def test_ai_compat_request_approval_transition_uses_formal_approval_service(monkeypatch) -> None:
    now = datetime(2026, 5, 5, tzinfo=timezone.utc)

    class FakeTaskService:
        async def get_task_detail(self, task_id):
            return TaskDetailDTO(
                task=AITaskDTO(
                    id=task_id,
                    event_id="event-approval-001",
                    type="inspection",
                    title="Need approval task",
                    summary="Formal task.",
                    recommendation="Request approval.",
                    status="open",
                    priority="high",
                    risk_level="high",
                    source_type="equipment",
                    source_id="equip-approval-001",
                    source_name="ICP",
                    assignee_id="owner-001",
                    assignee_name="Owner",
                    assignee_role="equipment-manager",
                    requires_approval=True,
                    due_at=now,
                    created_at=now,
                    updated_at=now,
                    closed_at=None,
                    metadata={"compatTaskType": "anomaly_review"},
                ),
                actions=[],
                approval=None,
            )

    class FakeApprovalService:
        async def get_latest_task_approval(self, task_id):
            return None

        async def create_approval(self, request):
            return AIApprovalDTO(
                id="approval-formal-req-001",
                task_id=request.task_id,
                title=request.title,
                reason=request.reason,
                status="pending",
                risk_level=request.risk_level,
                requested_by=request.requested_by,
                reviewer_id=None,
                reviewer_name=None,
                comment=None,
                created_at=now,
                updated_at=now,
                decided_at=None,
                metadata={},
            )

    @asynccontextmanager
    async def fake_formal_task_service():
        yield FakeTaskService()

    @asynccontextmanager
    async def fake_formal_approval_service():
        yield FakeApprovalService()

    monkeypatch.setattr(ai_compat, "use_formal_task_service_for_tasks", lambda: True)
    monkeypatch.setattr(ai_compat, "get_formal_task_service", fake_formal_task_service)
    monkeypatch.setattr(ai_compat, "use_formal_approval_service", lambda: True)
    monkeypatch.setattr(ai_compat, "get_formal_approval_service", fake_formal_approval_service)

    set_capability_target_override(Capability.TASKS, ServiceTarget.PYTHON_BACKEND)
    set_capability_target_override(Capability.APPROVALS, ServiceTarget.PYTHON_BACKEND)
    try:
        client = TestClient(create_app())
        response = client.patch(
            "/api/ai/tasks/task-formal-approval-001/status",
            json={
                "transition": "request_approval",
                "detail": "Need supervisor approval.",
                "actor": {"id": "tester", "name": "Tester", "type": "user"},
            },
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["task"]["status"] == "pending_approval"
        assert data["approval"]["id"] == "approval-formal-req-001"
    finally:
        set_capability_target_override(Capability.TASKS, None)
        set_capability_target_override(Capability.APPROVALS, None)


def test_ai_compat_formal_approval_processing_updates_task_status(monkeypatch) -> None:
    now = datetime(2026, 5, 5, tzinfo=timezone.utc)
    task_state = {"status": "blocked"}

    class FakeTaskService:
        async def get_task_detail(self, task_id):
            return TaskDetailDTO(
                task=AITaskDTO(
                    id=task_id,
                    event_id="event-approval-002",
                    type="inspection",
                    title="Blocked task",
                    summary="Task blocked pending approval.",
                    recommendation="Wait for decision.",
                    status=task_state["status"],
                    priority="high",
                    risk_level="high",
                    source_type="equipment",
                    source_id="equip-approval-002",
                    source_name="UPLC",
                    assignee_id="owner-001",
                    assignee_name="Owner",
                    assignee_role="equipment-manager",
                    requires_approval=True,
                    due_at=now,
                    created_at=now,
                    updated_at=now,
                    closed_at=None,
                    metadata={"compatTaskType": "anomaly_review"},
                ),
                actions=[],
                approval=None,
            )

    class FakeApprovalService:
        async def get_latest_task_approval(self, task_id):
            return AIApprovalDTO(
                id="approval-formal-process-001",
                task_id=task_id,
                title="Formal approval",
                reason="Need supervisor review.",
                status="approved",
                risk_level="high",
                requested_by=AuditActor(id="tester", name="Tester", type="user"),
                reviewer_id="reviewer-001",
                reviewer_name="Reviewer",
                comment="Approved.",
                created_at=now,
                updated_at=now,
                decided_at=now,
                metadata={},
            )

        async def process_approval(self, approval_id, request):
            assert approval_id == "approval-formal-process-001"
            assert request.decision == "approve"
            task_state["status"] = "open"
            return AIApprovalDTO(
                id=approval_id,
                task_id="task-formal-process-001",
                title="Formal approval",
                reason="Need supervisor review.",
                status="approved",
                risk_level="high",
                requested_by=AuditActor(id="tester", name="Tester", type="user"),
                reviewer_id=request.reviewer_id,
                reviewer_name=request.reviewer_name,
                comment=request.comment,
                created_at=now,
                updated_at=now,
                decided_at=now,
                metadata={},
            )

    @asynccontextmanager
    async def fake_formal_task_service():
        yield FakeTaskService()

    @asynccontextmanager
    async def fake_formal_approval_service():
        yield FakeApprovalService()

    monkeypatch.setattr(ai_compat, "use_formal_task_service_for_tasks", lambda: True)
    monkeypatch.setattr(ai_compat, "get_formal_task_service", fake_formal_task_service)
    monkeypatch.setattr(ai_compat, "use_formal_approval_service", lambda: True)
    monkeypatch.setattr(ai_compat, "get_formal_approval_service", fake_formal_approval_service)

    set_capability_target_override(Capability.TASKS, ServiceTarget.PYTHON_BACKEND)
    set_capability_target_override(Capability.APPROVALS, ServiceTarget.PYTHON_BACKEND)
    try:
        client = TestClient(create_app())
        response = client.patch(
            "/api/ai/approvals/approval-formal-process-001/process",
            json={
                "decision": "approve",
                "comment": "Approved.",
                "actor": {"id": "reviewer-001", "name": "Reviewer", "type": "user"},
            },
        )
        assert response.status_code == 200
        assert response.json()["data"]["approval"]["status"] == "approved"

        detail = client.get("/api/ai/tasks/task-formal-process-001").json()["data"]
        assert detail["task"]["status"] == "open"
    finally:
        set_capability_target_override(Capability.TASKS, None)
        set_capability_target_override(Capability.APPROVALS, None)
