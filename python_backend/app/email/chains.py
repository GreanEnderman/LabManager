from celery import chain

from app.reports.tasks import generate_daily_report_task
from app.email.tasks import send_email_task


def generate_and_send_report(
    target_date: str,
    operator: str,
    run_id: str,
    recipient_email: str,
    subject: str
) -> str:
    """Chain report generation and email delivery tasks."""
    task_chain = chain(
        generate_daily_report_task.s(target_date, operator, run_id),
        send_email_task.s(recipient_email, subject, "Report attached")
    )
    result = task_chain.apply_async()
    return result.id
