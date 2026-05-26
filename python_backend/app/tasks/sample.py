from app.tasks.celery_app import celery_app


@celery_app.task(name="labmanager.health.echo")
def echo_health(payload: str) -> str:
    return payload

