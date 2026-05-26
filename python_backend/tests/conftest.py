import pytest
import os
from unittest.mock import AsyncMock


@pytest.fixture(scope="session", autouse=True)
def setup_test_env():
    """Setup test environment variables."""
    os.environ["LABMANAGER_PY_LLM_API_KEY"] = "test-key"
    os.environ["LABMANAGER_PY_LLM_ENDPOINT"] = "http://test"
    os.environ["LABMANAGER_PY_LLM_MODEL"] = "test-model"


@pytest.fixture
def mock_db_connection():
    """Mock database connection for testing."""
    return AsyncMock()
