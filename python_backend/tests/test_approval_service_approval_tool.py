import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from app.approvals.models import AIApprovalDTO
from app.approvals.service import ApprovalService
from app.graphs.tools import ApprovalServiceApprovalTool
from app.tasks.models import AuditActor


def test_approval_service_approval_tool_maps_formal_approval_to_compat(monkeypatch) -> None:
    captured: dict[str, object] = {}

    async def fake_create_approval(self, request):
        captured["request"] = request
        now = datetime(2026, 5, 5, tzinfo=timezone.utc)
        return AIApprovalDTO(
            id="approval-formal-graph-001",
            task_id=request.task_id,
            title=request.title,
            reason=request.reason,
            status="pending",
            risk_level=request.risk_level,
            requested_by=AuditActor(id="tester", name="Tester", type="user"),
            reviewer_id=None,
            reviewer_name=None,
            comment=None,
            created_at=now,
            updated_at=now,
            decided_at=None,
            metadata=request.metadata,
        )

    monkeypatch.setattr(ApprovalService, "create_approval", fake_create_approval)

    @asynccontextmanager
    async def fake_connection():
        yield object()

    tool = ApprovalServiceApprovalTool(fake_connection)
    created = asyncio.run(
        tool.create_approval(
            {
                "taskId": "task-formal-001",
                "title": "Equipment approval",
                "reason": "High-risk anomaly.",
                "riskLevel": "high",
                "metadata": {"source": "graph"},
            },
            actor={"id": "tester", "name": "Tester", "type": "user"},
        )
    )

    request = captured["request"]
    assert request.task_id == "task-formal-001"
    assert request.risk_level == "high"
    assert created["id"] == "approval-formal-graph-001"
    assert created["taskId"] == "task-formal-001"
    assert created["status"] == "pending"

