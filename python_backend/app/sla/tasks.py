"""Celery tasks for SLA monitoring."""

from datetime import datetime, timezone

from app.tasks.celery_app import celery_app
from app.core.logging import get_logger
from app.db import get_connection
from app.sla.service import SLAService
from app.sla.models import (
    SLAConfig,
    InspectTaskSLARequest,
    ExecuteTaskSLARequest,
)
from app.tasks.models import AuditActor
from app.settings.service import SettingsService

logger = get_logger(__name__)


@celery_app.task(name="sla.run_inspection")
def run_sla_inspection():
    """Run SLA inspection and execute actions (reminders/escalations).

    This task is scheduled to run every 5 minutes via Celery Beat.
    """
    import asyncio

    async def _run():
        logger.info("Starting SLA inspection")

        try:
            # Get AI settings for SLA config from database
            async with get_connection() as conn:
                settings_service = SettingsService(conn)
                settings = await settings_service.get_settings()

            sla_settings = settings.sla

            config = SLAConfig(
                open_minutes=sla_settings.openMinutes,
                in_progress_minutes=sla_settings.inProgressMinutes,
                pending_approval_minutes=sla_settings.pendingApprovalMinutes,
                reminder_interval_minutes=sla_settings.reminderIntervalMinutes,
                max_reminder_count_before_escalation=sla_settings.maxReminderCountBeforeEscalation,
            )

            now = datetime.now(timezone.utc)
            actor = AuditActor(
                id="system",
                name="SLA Monitor",
                type="system",
            )

            # Execute SLA inspection and actions
            async with get_connection() as conn:
                service = SLAService(conn)

                # First inspect to see what needs action
                inspect_request = InspectTaskSLARequest(now=now, config=config)
                inspection = await service.inspect(inspect_request)

                logger.info(
                    f"SLA inspection found {len(inspection.items)} tasks requiring attention"
                )

                if inspection.items:
                    # Execute actions
                    execute_request = ExecuteTaskSLARequest(
                        now=now,
                        config=config,
                        actor=actor,
                    )
                    result = await service.execute(execute_request)

                    logger.info(
                        f"SLA execution completed: {len(result.reminders)} reminders, "
                        f"{len(result.escalations)} escalations"
                    )

                    return {
                        "reminders": len(result.reminders),
                        "escalations": len(result.escalations),
                        "total_inspected": len(inspection.items),
                    }
                else:
                    logger.info("No tasks require SLA action")
                    return {
                        "reminders": 0,
                        "escalations": 0,
                        "total_inspected": 0,
                    }

        except Exception as e:
            logger.error(f"SLA inspection failed: {e}", exc_info=True)
            raise

    return asyncio.run(_run())
