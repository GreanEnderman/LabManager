"""
Celery worker startup script that ensures .env is loaded.
"""
import os
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Load .env file explicitly
from dotenv import load_dotenv
env_path = project_root / ".env"
load_dotenv(env_path)

# Verify configuration is loaded
from app.core.config import get_settings
settings = get_settings()

print("=" * 60)
print("Celery Worker Configuration")
print("=" * 60)
print(f"Broker URL: {settings.celery_broker_url}")
print(f"Result Backend: {settings.celery_result_backend}")
print(f"Environment: {settings.app_env}")
print("=" * 60)

if not settings.celery_broker_url:
    print("\n❌ ERROR: LABMANAGER_PY_CELERY_BROKER_URL not set!")
    print("Please check your .env file.")
    sys.exit(1)

# Import and start Celery
from app.tasks.celery_app import celery_app

if __name__ == "__main__":
    # Start worker
    celery_app.worker_main([
        "worker",
        "--loglevel=info",
        "--pool=solo",  # Windows compatibility
    ])
