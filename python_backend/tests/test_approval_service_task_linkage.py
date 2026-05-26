import asyncio
from datetime import datetime, timezone

from app.approvals.models import AIApprovalRecord, CreateApprovalRequest, ProcessApprovalRequest
from app.approvals.service import ApprovalService
from app.core.event_mappings import EventMappings
from app.tasks.models import AITaskRecord, AuditActor


def _make_task(status: str) -> AITaskRecord:
    now = datetime(2026, 5, 5, tzinfo=timezone.utc)
    return AITaskRecord(
        id="task-formal-001",
        event_id="event-formal-001",
        type="inspection",
        title="Formal task",
        summary="Task summary",
        recommendation="Task recommendation",
        status=status,
        priority="high",
        risk_level="high",
        source_type="equipment",
        source_id="equip-001",
        source_name="HPLC",
        assignee_id=None,
        assignee_name=None,
        assignee_role="equipment-manager",
        requires_approval=True,
        due_at=now,
        created_at=now,
        updated_at=now,
        closed_at=None,
        metadata={},
    )


def _make_purchase_task(status: str) -> AITaskRecord:
    return _make_task(status).model_copy(update={"task_type": "procurement", "source_type": "chemical"})


def _make_approval() -> AIApprovalRecord:
    now = datetime(2026, 5, 5, tzinfo=timezone.utc)
    return AIApprovalRecord(
        id="approval-formal-001",
        task_id="task-formal-001",
        title="Formal approval",
        reason="Need review",
        status="pending",
        risk_level="high",
        requested_by=AuditActor(id="requester", name="Requester", type="user"),
        reviewer_id=None,
        reviewer_name=None,
        comment=None,
        created_at=now,
        updated_at=now,
        decided_at=None,
        metadata={},
    )


def test_approval_service_process_links_decision_to_task_status(monkeypatch) -> None:
    approval = _make_approval()
    now = datetime(2026, 5, 5, tzinfo=timezone.utc)

    scenarios = [
        ("approve", "blocked", "open"),
        ("reject", "open", "cancelled"),
        ("request_info", "in_progress", None),
    ]

    for decision, initial_status, expected_status in scenarios:
        recorded_updates: list[dict[str, object]] = []
        recorded_actions: list[dict[str, object]] = []

        async def fake_get_approval_by_id(conn, approval_id):
            assert approval_id == "approval-formal-001"
            return approval.model_copy()

        async def fake_get_task_by_id(conn, task_id):
            assert task_id == "task-formal-001"
            return _make_task(initial_status)

        async def fake_update_approval_processing(conn, approval_id, **kwargs):
            return approval.model_copy(
                update={
                    "status": {"approve": "approved", "reject": "rejected", "request_info": "needs_info"}[decision],
                    "reviewer_id": kwargs["reviewer_id"],
                    "reviewer_name": kwargs["reviewer_name"],
                    "comment": kwargs["comment"],
                    "updated_at": kwargs["updated_at"],
                    "decided_at": kwargs["decided_at"],
                }
            )

        async def fake_update_task_status(conn, task_id, status, closed_at=None):
            recorded_updates.append(
                {"task_id": task_id, "status": status, "closed_at": closed_at}
            )
            return True

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
        ):
            recorded_actions.append(
                {
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

        monkeypatch.setattr("app.approvals.service.get_approval_by_id", fake_get_approval_by_id)
        monkeypatch.setattr("app.approvals.service.get_task_by_id", fake_get_task_by_id)
        monkeypatch.setattr("app.approvals.service.update_approval_processing", fake_update_approval_processing)
        monkeypatch.setattr("app.approvals.service.update_task_status", fake_update_task_status)
        monkeypatch.setattr("app.approvals.service.create_task_action", fake_create_task_action)

        service = ApprovalService(conn=object())
        result = asyncio.run(
            service.process_approval(
                "approval-formal-001",
                ProcessApprovalRequest(
                    decision=decision,
                    reviewer_id="reviewer-001",
                    reviewer_name="Reviewer",
                    comment=f"{decision} comment",
                ),
            )
        )

        assert result.status == {"approve": "approved", "reject": "rejected", "request_info": "needs_info"}[decision]
        assert recorded_actions[-1]["action_type"] == "approval_processed"
        if expected_status is None:
            assert recorded_updates == []
            assert all(action["action_type"] != "task_status_changed" for action in recorded_actions)
        else:
            assert recorded_updates[0]["status"] == expected_status
            assert any(
                action["action_type"] == "task_status_changed"
                and action["to_status"] == expected_status
                and action["approval_id"] == "approval-formal-001"
                for action in recorded_actions
            )


def test_approval_service_reuses_existing_unresolved_approval(monkeypatch) -> None:
    existing_records = [
        _make_approval(),
        _make_approval().model_copy(update={"id": "approval-formal-info-001", "status": "needs_info"}),
    ]

    for existing in existing_records:
        recorded_creates: list[object] = []
        recorded_actions: list[object] = []

        async def fake_get_latest_approval_for_task(conn, task_id):
            assert task_id == "task-formal-001"
            return existing

        async def fake_create_approval(conn, approval):
            recorded_creates.append(approval)
            return approval

        async def fake_create_task_action(*args, **kwargs):
            recorded_actions.append({"args": args, "kwargs": kwargs})

        monkeypatch.setattr("app.approvals.service.get_latest_approval_for_task", fake_get_latest_approval_for_task)
        monkeypatch.setattr("app.approvals.service.create_approval", fake_create_approval)
        monkeypatch.setattr("app.approvals.service.create_task_action", fake_create_task_action)

        service = ApprovalService(conn=object())
        result = asyncio.run(
            service.create_approval(
                CreateApprovalRequest(
                    task_id="task-formal-001",
                    title="Duplicate approval",
                    reason="Duplicate request",
                    risk_level="high",
                    requested_by=AuditActor(id="requester", name="Requester", type="user"),
                    metadata={},
                )
            )
        )

        assert result.id == existing.id
        assert recorded_creates == []
        assert recorded_actions == []


def test_human_intervention_events_require_approval() -> None:
    assert EventMappings.requires_approval("low_stock")
    assert EventMappings.requires_approval("maintenance_overdue")
    assert EventMappings.requires_approval("equipment_fault")


def test_purchase_approval_completes_task_after_submission() -> None:
    service = ApprovalService(conn=object())

    assert service._approval_task_next_status(_make_purchase_task("open"), "approve") == "completed"
