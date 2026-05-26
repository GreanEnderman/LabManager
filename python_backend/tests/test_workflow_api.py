import pytest

from app.api.workflow import endpoints
from app.tasks.celery_app import celery_app


def test_workflow_tasks_are_registered() -> None:
    assert "rules.scan_and_execute" in celery_app.tasks
    assert "sla.run_inspection" in celery_app.tasks
    assert "reports.generate_daily" in celery_app.tasks


class _FakeEagerResult:
    id = "rules-scan-local-001"
    state = "SUCCESS"
    result = {"events_found": 2, "tasks_created": 1, "task_ids": ["task-001"]}

    def successful(self) -> bool:
        return True

    def failed(self) -> bool:
        return False


class _FakeRulesTask:
    def apply(self, throw: bool = False):
        return _FakeEagerResult()


class _FailingInspect:
    def stats(self):
        raise TimeoutError("stats timed out")

    def active(self):
        return {"worker-1": [{"id": "active-task"}]}


class _FakeControl:
    def inspect(self, timeout=None):
        assert timeout == endpoints.WORKFLOW_INSPECT_TIMEOUT_SECONDS
        return _FailingInspect()


@pytest.mark.asyncio
async def test_workflow_status_keeps_schedule_when_worker_stats_timeout(monkeypatch) -> None:
    monkeypatch.setattr(endpoints.celery_app, "control", _FakeControl())

    status = await endpoints.get_workflow_status()

    assert status.stats["total_scheduled_tasks"] >= 1
    assert status.stats["total_workers"] == 1
    assert status.workers[0].name == "worker-1"
    assert status.workers[0].active_tasks == 1
    assert status.workers[0].processed == 0


@pytest.mark.asyncio
async def test_trigger_rules_scan_executes_synchronously(monkeypatch) -> None:
    monkeypatch.setitem(endpoints.celery_app.tasks, "rules.scan_and_execute", _FakeRulesTask())

    body = await endpoints.trigger_task("rules.scan_and_execute")

    assert body["success"] is True
    assert body["task_name"] == "rules.scan_and_execute"
    assert body["state"] == "SUCCESS"
    assert body["result"]["events_found"] == 2
    assert body["result"]["tasks_created"] == 1
    assert body["result"]["task_ids"] == ["task-001"]


@pytest.mark.asyncio
async def test_trigger_unknown_workflow_task_returns_error() -> None:
    body = await endpoints.trigger_task("not.registered")

    assert body["success"] is False
    assert "not.registered" in body["error"]
