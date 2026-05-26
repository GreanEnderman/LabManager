@echo off
REM Celery Worker Startup Script for Windows
REM Ensures .env file is loaded before starting Celery

cd /d "%~dp0"

echo ============================================================
echo Starting Celery Worker with .env configuration
echo ============================================================

REM Activate virtual environment if it exists
if exist .venv\Scripts\activate.bat (
    call .venv\Scripts\activate.bat
)

REM Start Celery using the Python startup script
python start_celery.py

pause
