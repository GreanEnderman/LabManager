import pytest
from tests.regression.client import RegressionClient
from tests.regression.comparator import ResponseComparator
from tests.regression.diff_logger import DiffLogger
from tests.regression.fixture_loader import FixtureLoader
from tests.regression.allowlist import AllowlistManager

@pytest.mark.asyncio
async def test_email_comparison():
    client = RegressionClient()
    fixture_loader = FixtureLoader()
    allowlist_mgr = AllowlistManager()
    comparator = ResponseComparator(allowlist_mgr.get_allowlist("/api/email/send"))
    diff_logger = DiffLogger()

    fixture = fixture_loader.load("email_basic")
    body = fixture_loader.get_request_payload("email_basic")
    headers = fixture_loader.get_request_headers("email_basic")

    result = await client.post("/api/email/send", body=body, headers=headers)

    differences = comparator.compare(result.ts_response, result.python_response)

    if differences:
        diff_logger.log_difference(
            endpoint="/api/email/send",
            method="POST",
            fixture_name="email_basic",
            ts_response=result.ts_response,
            python_response=result.python_response,
            differences=differences
        )
        pytest.fail(f"Found {len(differences)} unadjudicated differences")
