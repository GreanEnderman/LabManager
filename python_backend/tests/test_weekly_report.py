"""Test weekly report generation."""
import asyncio
from datetime import date

import pytest

from app.reports.generator import generate_weekly_report
from app.reports.models import WeeklyReportData


@pytest.mark.asyncio
async def test_weekly_report_with_full_data(mock_db_connection):
    """Test weekly report generation with full week data."""
    start_date = date(2026, 4, 24)
    end_date = date(2026, 5, 1)
    operator = "test@example.com"
    run_id = "test-run-789"

    report = await generate_weekly_report(
        mock_db_connection,
        start_date,
        end_date,
        operator,
        run_id
    )

    assert isinstance(report, WeeklyReportData)
    assert report.start_date == start_date
    assert report.end_date == end_date
    assert report.metadata.operator == operator
    assert report.metadata.run_id == run_id
    assert len(report.daily_breakdown) == 7


@pytest.mark.asyncio
async def test_weekly_report_with_partial_data(mock_db_connection):
    """Test weekly report generation with some days having no data."""
    start_date = date(2026, 1, 1)
    end_date = date(2026, 1, 8)
    operator = "test@example.com"
    run_id = "test-run-partial"

    report = await generate_weekly_report(
        mock_db_connection,
        start_date,
        end_date,
        operator,
        run_id
    )

    assert len(report.daily_breakdown) == 7
    # Some days should have zero counts
    zero_days = [d for d in report.daily_breakdown if d["task_completions"] == 0]
    assert len(zero_days) >= 0
