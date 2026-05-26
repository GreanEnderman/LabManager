from __future__ import annotations

from datetime import date
import logging
from typing import Any

from kombu.exceptions import OperationalError

from app.core.config import get_settings
from app.db.postgres import get_db_connection
from app.reports.generator import generate_daily_report, generate_weekly_report
from app.reports.status import store_sync_task_result
from app.reports.tasks import generate_daily_report_task, generate_weekly_report_task

logger = logging.getLogger(__name__)


def _dump_report(report: Any) -> dict[str, Any]:
    if hasattr(report, "model_dump"):
        return report.model_dump(mode="json")
    return dict(report)


async def _generate_daily_report_sync(target_date: str, operator: str, run_id: str) -> dict[str, Any]:
    logger.info(
        "Generating daily report synchronously: run_id=%s date=%s operator=%s",
        run_id,
        target_date,
        operator,
    )

    # Create LLM service for report generation
    from app.llm.factory import create_llm_service
    llm_service = create_llm_service()

    async with get_db_connection() as conn:
        report = await generate_daily_report(
            conn,
            date.fromisoformat(target_date),
            operator,
            run_id,
            llm_service=llm_service
        )

    # Close LLM service client
    if hasattr(llm_service, 'close'):
        await llm_service.close()

    result = _dump_report(report)
    logger.info(
        "Daily report sync generation completed: run_id=%s task_completions=%s approvals=%s activities=%s llm_used=%s",
        run_id,
        result.get("task_completions"),
        result.get("approvals"),
        result.get("metrics", {}).get("activities"),
        result.get("metadata", {}).get("llmUsed", False),
    )
    return result


async def _generate_weekly_report_sync(
    start_date: str,
    end_date: str,
    operator: str,
    run_id: str,
) -> dict[str, Any]:
    logger.info(
        "Generating weekly report synchronously: run_id=%s start_date=%s end_date=%s operator=%s",
        run_id,
        start_date,
        end_date,
        operator,
    )

    # Create LLM service for report generation
    from app.llm.factory import create_llm_service
    llm_service = create_llm_service()

    async with get_db_connection() as conn:
        report = await generate_weekly_report(
            conn,
            date.fromisoformat(start_date),
            date.fromisoformat(end_date),
            operator,
            run_id,
            llm_service=llm_service
        )

    # Close LLM service client
    if hasattr(llm_service, 'close'):
        await llm_service.close()

    result = _dump_report(report)
    logger.info(
        "Weekly report sync generation completed: run_id=%s task_completions=%s approvals=%s breakdown_days=%s llm_used=%s",
        run_id,
        result.get("task_completions"),
        result.get("approvals"),
        len(result.get("daily_breakdown", [])),
        result.get("metadata", {}).get("llmUsed", False),
    )
    return result


async def submit_daily_report(target_date: str, operator: str, run_id: str) -> dict[str, Any]:
    settings = get_settings()
    celery_broker_url = getattr(settings, "celery_broker_url", None)
    celery_result_backend = getattr(settings, "celery_result_backend", None)
    logger.info(
        "Submitting daily report: run_id=%s date=%s operator=%s broker_configured=%s result_backend_configured=%s",
        run_id,
        target_date,
        operator,
        bool(celery_broker_url),
        bool(celery_result_backend),
    )
    if celery_broker_url and celery_result_backend:
        try:
            task = generate_daily_report_task.delay(target_date, operator, run_id)
            logger.info("Daily report queued asynchronously: run_id=%s celery_task_id=%s", run_id, task.id)
            return {"task_id": task.id, "status": "pending", "mode": "async"}
        except OperationalError as exc:
            fallback_reason = str(exc)
            logger.warning(
                "Daily report async queue unavailable, falling back to sync mode: run_id=%s reason=%s",
                run_id,
                fallback_reason,
            )
    elif celery_broker_url and not celery_result_backend:
        fallback_reason = "Celery result backend is not configured"
        logger.info("Daily report using sync mode: run_id=%s reason=%s", run_id, fallback_reason)
    else:
        fallback_reason = "Celery broker is not configured"
        logger.info("Daily report using sync mode: run_id=%s reason=%s", run_id, fallback_reason)

    result = await _generate_daily_report_sync(target_date, operator, run_id)
    store_sync_task_result(run_id, result)
    return {
        "task_id": run_id,
        "status": "completed",
        "mode": "sync",
        "fallback_reason": fallback_reason,
        "result": result,
    }


async def submit_weekly_report(
    start_date: str,
    end_date: str,
    operator: str,
    run_id: str,
) -> dict[str, Any]:
    settings = get_settings()
    celery_broker_url = getattr(settings, "celery_broker_url", None)
    celery_result_backend = getattr(settings, "celery_result_backend", None)
    logger.info(
        "Submitting weekly report: run_id=%s start_date=%s end_date=%s operator=%s broker_configured=%s result_backend_configured=%s",
        run_id,
        start_date,
        end_date,
        operator,
        bool(celery_broker_url),
        bool(celery_result_backend),
    )
    if celery_broker_url and celery_result_backend:
        try:
            task = generate_weekly_report_task.delay(start_date, end_date, operator, run_id)
            logger.info("Weekly report queued asynchronously: run_id=%s celery_task_id=%s", run_id, task.id)
            return {"task_id": task.id, "status": "pending", "mode": "async"}
        except OperationalError as exc:
            fallback_reason = str(exc)
            logger.warning(
                "Weekly report async queue unavailable, falling back to sync mode: run_id=%s reason=%s",
                run_id,
                fallback_reason,
            )
    elif celery_broker_url and not celery_result_backend:
        fallback_reason = "Celery result backend is not configured"
        logger.info("Weekly report using sync mode: run_id=%s reason=%s", run_id, fallback_reason)
    else:
        fallback_reason = "Celery broker is not configured"
        logger.info("Weekly report using sync mode: run_id=%s reason=%s", run_id, fallback_reason)

    result = await _generate_weekly_report_sync(start_date, end_date, operator, run_id)
    store_sync_task_result(run_id, result)
    return {
        "task_id": run_id,
        "status": "completed",
        "mode": "sync",
        "fallback_reason": fallback_reason,
        "result": result,
    }
