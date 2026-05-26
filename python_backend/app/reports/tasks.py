from datetime import date

from celery import current_task

from app.db.postgres import get_db_connection
from app.reports.generator import generate_daily_report, generate_weekly_report
from app.reports.status import store_completed_report_result
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.reports.tasks.generate_daily_report_async")
def generate_daily_report_task(target_date: str, operator: str, run_id: str):
    """Async task for daily report generation with LLM support."""
    import asyncio

    async def _generate():
        from app.llm.factory import create_llm_service

        # Create LLM service
        llm_service = create_llm_service()

        try:
            async with get_db_connection() as conn:
                report = await generate_daily_report(
                    conn,
                    date.fromisoformat(target_date),
                    operator,
                    run_id,
                    llm_service=llm_service
                )
                result = report.model_dump(mode="json")
                store_completed_report_result(current_task.request.id or run_id, result)
                return result
        finally:
            # Close LLM service client
            if hasattr(llm_service, 'close'):
                await llm_service.close()

    return asyncio.run(_generate())


@celery_app.task(name="app.reports.tasks.generate_weekly_report_async")
def generate_weekly_report_task(start_date: str, end_date: str, operator: str, run_id: str):
    """Async task for weekly report generation with LLM support."""
    import asyncio

    async def _generate():
        from app.llm.factory import create_llm_service

        # Create LLM service
        llm_service = create_llm_service()

        try:
            async with get_db_connection() as conn:
                report = await generate_weekly_report(
                    conn,
                    date.fromisoformat(start_date),
                    date.fromisoformat(end_date),
                    operator,
                    run_id,
                    llm_service=llm_service
                )
                result = report.model_dump(mode="json")
                store_completed_report_result(current_task.request.id or run_id, result)
                return result
        finally:
            # Close LLM service client
            if hasattr(llm_service, 'close'):
                await llm_service.close()

    return asyncio.run(_generate())
