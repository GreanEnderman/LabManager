"""Test daily report generation."""
import asyncio
from datetime import date

import pytest

from app.reports.generator import generate_daily_report
from app.reports.models import DailyReportData


@pytest.mark.asyncio
async def test_daily_report_with_valid_data(mock_db_connection):
    """Test daily report generation with valid data."""
    target_date = date(2026, 5, 1)
    operator = "test@example.com"
    run_id = "test-run-123"

    report = await generate_daily_report(
        mock_db_connection,
        target_date,
        operator,
        run_id
    )

    assert isinstance(report, DailyReportData)
    assert report.date == target_date
    assert report.metadata.operator == operator
    assert report.metadata.run_id == run_id
    assert report.task_completions >= 0
    assert report.approvals >= 0


@pytest.mark.asyncio
async def test_daily_report_with_no_data(mock_db_connection):
    """Test daily report generation with no activity data."""
    target_date = date(2026, 1, 1)
    operator = "test@example.com"
    run_id = "test-run-456"

    report = await generate_daily_report(
        mock_db_connection,
        target_date,
        operator,
        run_id
    )

    assert report.task_completions == 0
    assert report.approvals == 0
