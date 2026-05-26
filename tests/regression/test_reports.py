import pytest
from tests.regression.client import RegressionClient
from tests.regression.comparator import ResponseComparator
from tests.regression.diff_logger import DiffLogger
from tests.regression.fixture_loader import FixtureLoader
from tests.regression.allowlist import AllowlistManager

@pytest.mark.asyncio
async def test_report_comparison():
    client = RegressionClient()
    fixture_loader = FixtureLoader()
    allowlist_mgr = AllowlistManager()
    comparator = ResponseComparator(allowlist_mgr.get_allowlist("/api/reports/:id"))
    diff_logger = DiffLogger()

    fixture = fixture_loader.load("report_basic")
    headers = fixture_loader.get_request_headers("report_basic")

    result = await client.get("/api/reports/test-report-1", headers=headers)

    differences = comparator.compare(result.ts_response, result.python_response)

    if differences:
        diff_logger.log_difference(
            endpoint="/api/reports/:id",
            method="GET",
            fixture_name="report_basic",
            ts_response=result.ts_response,
            python_response=result.python_response,
            differences=differences
        )
        pytest.fail(f"Found {len(differences)} unadjudicated differences")
