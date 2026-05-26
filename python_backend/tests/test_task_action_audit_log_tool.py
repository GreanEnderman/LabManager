import asyncio
from contextlib import asynccontextmanager

from app.graphs.tools import TaskActionAuditLogTool


def test_task_action_audit_log_tool_persists_formal_task_actions(monkeypatch) -> None:
    captured: list[dict[str, object]] = []

    async def fake_create_task_action(
        conn,
        action_id,
        task_id,
        approval_id,
        action_type,
        from_status,
        to_status,
        actor,
        reason_codes,
        detail,
        tool_name,
        snapshot,
        created_at,
    ) -> None:
        captured.append(
            {
                "conn": conn,
                "action_id": action_id,
                "task_id": task_id,
                "approval_id": approval_id,
                "action_type": action_type,
                "from_status": from_status,
                "to_status": to_status,
                "actor": actor,
                "reason_codes": reason_codes,
                "detail": detail,
                "tool_name": tool_name,
                "snapshot": snapshot,
                "created_at": created_at,
            }
        )

    monkeypatch.setattr("app.graphs.tools.create_task_action", fake_create_task_action)

    @asynccontextmanager
    async def fake_connection():
        yield object()

    tool = TaskActionAuditLogTool(fake_connection)
    persisted = asyncio.run(
        tool.write_many(
            [
                {
                    "id": "action-graph-001",
                    "taskId": "task-formal-001",
                    "approvalId": "approval-formal-001",
                    "actionType": "approval_requested",
                    "fromStatus": "open",
                    "toStatus": "open",
                    "actor": {"id": "tester", "name": "Tester", "type": "user"},
                    "reasonCodes": ["approval_requested"],
                    "detail": "Approval created by graph.",
                    "toolName": "supervisor_graph_v1",
                    "snapshot": {"node": "create_approval"},
                    "createdAt": "2026-05-05T00:00:00Z",
                },
                {
                    "id": "action-graph-002",
                    "actionType": "event_ingested",
                    "detail": "Skipped because there is no task id yet.",
                    "actor": {"id": "system", "name": "System", "type": "system"},
                    "reasonCodes": ["event_ingested"],
                    "snapshot": {"node": "event_ingestor"},
                    "createdAt": "2026-05-05T00:00:01Z",
                },
            ]
        )
    )

    assert len(captured) == 1
    assert captured[0]["task_id"] == "task-formal-001"
    assert captured[0]["approval_id"] == "approval-formal-001"
    assert captured[0]["action_type"] == "approval_requested"
    assert captured[0]["actor"].id == "tester"
    assert persisted[0]["taskId"] == "task-formal-001"
    assert persisted[1]["actionType"] == "event_ingested"
