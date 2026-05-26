from enum import Enum
import json
import logging
from pathlib import Path
from typing import Any

from celery.exceptions import ImproperlyConfigured
from celery.result import AsyncResult

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


_sync_task_results: dict[str, dict[str, Any]] = {}
_COMPLETED_REPORTS_PATH = Path(".tmp/report-results-state.json")


def _read_completed_report_results() -> list[dict[str, Any]]:
    if not _COMPLETED_REPORTS_PATH.exists():
        return []
    try:
        payload = json.loads(_COMPLETED_REPORTS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.warning("Unable to read completed report results from %s", _COMPLETED_REPORTS_PATH)
        return []
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    return []


def list_completed_report_results() -> list[dict[str, Any]]:
    """Return completed report results persisted by worker/background processes."""
    return _read_completed_report_results()


def store_completed_report_result(task_id: str, result: dict[str, Any]) -> None:
    """Persist a completed report so API processes can surface worker results."""
    if not task_id or not result:
        return
    records = [item for item in _read_completed_report_results() if item.get("task_id") != task_id]
    records.insert(0, {"task_id": task_id, "result": result})
    _COMPLETED_REPORTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    _COMPLETED_REPORTS_PATH.write_text(
        json.dumps(records[:100], ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )


def store_sync_task_result(task_id: str, result: dict[str, Any]) -> None:
    """Store an immediately generated report behind the async task contract."""
    _sync_task_results[task_id] = result
    store_completed_report_result(task_id, result)
    logger.info(
        "Stored sync report result: task_id=%s task_completions=%s approvals=%s",
        task_id,
        result.get("task_completions"),
        result.get("approvals"),
    )


def get_task_status(task_id: str) -> dict:
    """Get status of async task."""
    if not task_id or task_id == "undefined":
        logger.warning("Report task status requested with invalid task_id=%s", task_id)
        return {
            "task_id": task_id,
            "status": TaskStatus.FAILED,
            "state": "INVALID_TASK_ID",
            "ready": True,
            "successful": False,
        }

    if task_id in _sync_task_results:
        logger.info("Report task status served from sync cache: task_id=%s state=SUCCESS", task_id)
        return {
            "task_id": task_id,
            "status": TaskStatus.COMPLETED,
            "state": "SUCCESS",
            "ready": True,
            "successful": True,
        }

    result = AsyncResult(task_id, app=celery_app)

    try:
        result_state = result.state
        result_ready = result.ready()
        result_successful = result.successful() if result_ready else None
    except (AttributeError, ImproperlyConfigured):
        logger.warning("Report task status unavailable because Celery result backend is disabled: task_id=%s", task_id)
        return {
            "task_id": task_id,
            "status": TaskStatus.FAILED,
            "state": "RESULT_BACKEND_DISABLED",
            "ready": True,
            "successful": False,
        }

    if result_state == "PENDING":
        status = TaskStatus.PENDING
    elif result_state == "STARTED":
        status = TaskStatus.PROCESSING
    elif result_state == "SUCCESS":
        status = TaskStatus.COMPLETED
    elif result_state == "FAILURE":
        status = TaskStatus.FAILED
    else:
        status = TaskStatus.PENDING

    return {
        "task_id": task_id,
        "status": status,
        "state": result_state,
        "ready": result_ready,
        "successful": result_successful,
    }


def get_task_result(task_id: str):
    """Get result of completed task."""
    if not task_id or task_id == "undefined":
        logger.warning("Report task result requested with invalid task_id=%s", task_id)
        return None

    if task_id in _sync_task_results:
        logger.info("Report task result served from sync cache: task_id=%s", task_id)
        return _sync_task_results[task_id]

    result = AsyncResult(task_id, app=celery_app)
    try:
        ready = result.ready()
    except (AttributeError, ImproperlyConfigured):
        logger.warning("Report task result unavailable because Celery result backend is disabled: task_id=%s", task_id)
        return None

    if ready:
        if result.successful():
            return result.result
        else:
            raise result.result
    return None
