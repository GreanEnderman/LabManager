"""Celery Beat schedule configuration."""

from celery.schedules import crontab


beat_schedule = {
    # SLA inspection: every 5 minutes.
    "sla-inspection": {
        "task": "sla.run_inspection",
        "schedule": 300.0,
        "options": {"expires": 240.0},
    },
    # Rule scan: every 10 minutes.
    "rules-scan": {
        "task": "rules.scan_and_execute",
        "schedule": 600.0,
        "options": {"expires": 540.0},
    },
    # Daily report: every day at 08:00 in celery_app.conf.timezone.
    "daily-report": {
        "task": "reports.generate_daily",
        "schedule": crontab(hour=8, minute=0),
        "options": {"expires": 3600.0},
    },
    # Weekly report: every Monday at 09:00 in celery_app.conf.timezone.
    "weekly-report": {
        "task": "reports.generate_weekly",
        "schedule": crontab(day_of_week=1, hour=9, minute=0),
        "options": {"expires": 7200.0},
    },
}
