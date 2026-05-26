from celery import Celery

from app.tasks.celery_app import celery_app

# Report generation task queue configuration
celery_app.conf.task_routes = {
    "app.reports.tasks.*": {"queue": "labmanager.reports"}
}
