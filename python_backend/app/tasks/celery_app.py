from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery("labmanager_python_backend")

if settings.celery_broker_url:
    celery_app.conf.broker_url = settings.celery_broker_url
if settings.celery_result_backend:
    celery_app.conf.result_backend = settings.celery_result_backend

celery_app.conf.task_default_queue = "labmanager.default"
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]
celery_app.conf.timezone = "Asia/Shanghai"
celery_app.conf.imports = (
    "app.reports.scheduled_tasks",
    "app.rules.tasks",
    "app.sla.tasks",
)
celery_app.autodiscover_tasks(["app.tasks", "app.reports", "app.email", "app.sla", "app.rules"])

# Load Celery Beat schedule
try:
    from app.tasks.beat_schedule import beat_schedule
    celery_app.conf.beat_schedule = beat_schedule
except ImportError:
    pass  # Beat schedule not configured yet

from app.reports import scheduled_tasks  # noqa: E402,F401
from app.rules import tasks as rules_tasks  # noqa: E402,F401
from app.sla import tasks as sla_tasks  # noqa: E402,F401
