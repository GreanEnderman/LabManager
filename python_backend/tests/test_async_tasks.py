"""Test async task queue flow."""
import pytest
from unittest.mock import MagicMock, patch

from app.reports.status import TaskStatus, get_task_status, get_task_result


def test_get_task_status_pending():
    """Test getting status of pending task."""
    with patch('app.reports.status.AsyncResult') as mock_result:
        mock_result.return_value.state = 'PENDING'
        mock_result.return_value.ready.return_value = False
        mock_result.return_value.successful.return_value = None

        status = get_task_status("test-task-id")

        assert status["task_id"] == "test-task-id"
        assert status["status"] == TaskStatus.PENDING
        assert status["ready"] is False


def test_get_task_status_processing():
    """Test getting status of processing task."""
    with patch('app.reports.status.AsyncResult') as mock_result:
        mock_result.return_value.state = 'STARTED'
        mock_result.return_value.ready.return_value = False

        status = get_task_status("test-task-id")

        assert status["status"] == TaskStatus.PROCESSING


def test_get_task_status_completed():
    """Test getting status of completed task."""
    with patch('app.reports.status.AsyncResult') as mock_result:
        mock_result.return_value.state = 'SUCCESS'
        mock_result.return_value.ready.return_value = True
        mock_result.return_value.successful.return_value = True

        status = get_task_status("test-task-id")

        assert status["status"] == TaskStatus.COMPLETED
        assert status["ready"] is True
        assert status["successful"] is True


def test_get_task_result_success():
    """Test retrieving result of successful task."""
    with patch('app.reports.status.AsyncResult') as mock_result:
        mock_result.return_value.ready.return_value = True
        mock_result.return_value.successful.return_value = True
        mock_result.return_value.result = {"data": "test"}

        result = get_task_result("test-task-id")

        assert result == {"data": "test"}


def test_get_task_result_not_ready():
    """Test retrieving result of task that's not ready."""
    with patch('app.reports.status.AsyncResult') as mock_result:
        mock_result.return_value.ready.return_value = False

        result = get_task_result("test-task-id")

        assert result is None
