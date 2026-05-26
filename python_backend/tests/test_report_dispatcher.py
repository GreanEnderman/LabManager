from contextlib import asynccontextmanager
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from kombu.exceptions import OperationalError

from app.reports.dispatcher import submit_daily_report
from app.reports.models import DailyReportData, ReportMetadata
from app.reports.status import get_task_result, get_task_status


def _report(run_id: str) -> DailyReportData:
    return DailyReportData(
        date=date(2026, 5, 6),
        task_completions=1,
        approvals=2,
        metrics={"activities": 3},
        metadata=ReportMetadata(operator="tester", timestamp="2026-05-06T00:00:00", run_id=run_id),
    )


@asynccontextmanager
async def _mock_connection():
    yield AsyncMock()


@pytest.mark.asyncio
async def test_submit_daily_report_uses_sync_mode_without_broker(monkeypatch):
    monkeypatch.setattr(
        "app.reports.dispatcher.get_settings",
        lambda: SimpleNamespace(celery_broker_url=None),
    )
    monkeypatch.setattr("app.reports.dispatcher.get_db_connection", _mock_connection)
    monkeypatch.setattr(
        "app.reports.dispatcher.generate_daily_report",
        AsyncMock(return_value=_report("sync-run-1")),
    )

    response = await submit_daily_report("2026-05-06", "tester", "sync-run-1")

    assert response["task_id"] == "sync-run-1"
    assert response["status"] == "completed"
    assert response["mode"] == "sync"
    assert response["result"]["task_completions"] == 1

    status = get_task_status("sync-run-1")
    assert status["ready"] is True
    assert status["successful"] is True
    assert get_task_result("sync-run-1")["approvals"] == 2


@pytest.mark.asyncio
async def test_submit_daily_report_falls_back_when_broker_refuses_connection(monkeypatch):
    monkeypatch.setattr(
        "app.reports.dispatcher.get_settings",
        lambda: SimpleNamespace(
            celery_broker_url="redis://localhost:6379/1",
            celery_result_backend="redis://localhost:6379/2",
        ),
    )
    monkeypatch.setattr("app.reports.dispatcher.get_db_connection", _mock_connection)
    monkeypatch.setattr(
        "app.reports.dispatcher.generate_daily_report",
        AsyncMock(return_value=_report("sync-run-2")),
    )
    monkeypatch.setattr(
        "app.reports.dispatcher.generate_daily_report_task.delay",
        lambda *_args: (_ for _ in ()).throw(OperationalError("connection refused")),
    )

    response = await submit_daily_report("2026-05-06", "tester", "sync-run-2")

    assert response["status"] == "completed"
    assert response["mode"] == "sync"
    assert "connection refused" in response["fallback_reason"]
