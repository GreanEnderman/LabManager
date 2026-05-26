#!/bin/bash
cd "$(dirname "$0")/.."
celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
