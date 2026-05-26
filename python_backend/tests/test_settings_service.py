"""Tests for settings service."""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock

from app.settings.service import SettingsService
from app.settings.models import (
    AISettings,
    ThresholdsSettings,
    ApprovalStrategySettings,
    SLASettings,
    EmailDeliverySettings,
)


@pytest.fixture
def sample_settings():
    """Sample settings for testing."""
    return AISettings(
        thresholds=ThresholdsSettings(
            defaultLowStockThreshold=5,
            maintenanceOverdueDays=30,
            chemicalThresholdOverrides={},
        ),
        approvalStrategy=ApprovalStrategySettings(
            highRiskRequiresApproval=True,
            equipmentFaultRequiresApproval=True,
            maintenanceOverdueRequiresApproval=False,
        ),
        sla=SLASettings(
            openMinutes=240,
            inProgressMinutes=480,
            pendingApprovalMinutes=180,
            reminderIntervalMinutes=60,
            maxReminderCountBeforeEscalation=2,
        ),
        emailDelivery=EmailDeliverySettings(
            smtpHost="smtp.example.com",
            smtpPort=465,
            smtpUser="sender@example.com",
            smtpPassword="secret",
            smtpFrom="sender@example.com",
            smtpUseSsl=True,
            supervisorReportBaseUrl="https://labmanager.example.com",
            passwordConfigured=True,
        ),
        updatedAt="2026-05-05T10:00:00Z",
    )


@pytest.mark.asyncio
async def test_get_settings_from_database(sample_settings):
    """Test getting settings from database."""
    mock_conn = MagicMock()
    service = SettingsService(mock_conn)

    with patch("app.settings.service.get_settings_from_db") as mock_get:
        mock_get.return_value = {
            "thresholds": sample_settings.thresholds.model_dump(),
            "approvalStrategy": sample_settings.approvalStrategy.model_dump(),
            "sla": sample_settings.sla.model_dump(),
            "emailDelivery": sample_settings.emailDelivery.model_dump(exclude={"passwordConfigured"}),
            "updatedAt": sample_settings.updatedAt,
        }

        result = await service.get_settings()

        assert result.thresholds.defaultLowStockThreshold == 5
        assert result.sla.openMinutes == 240
        assert result.emailDelivery.smtpHost == "smtp.example.com"
        assert result.emailDelivery.smtpPassword is None
        assert result.emailDelivery.passwordConfigured is True
        mock_get.assert_called_once_with(mock_conn, "default")


@pytest.mark.asyncio
async def test_get_settings_uses_defaults_when_not_in_db():
    """Test getting default settings when not in database."""
    mock_conn = MagicMock()
    service = SettingsService(mock_conn)

    with patch("app.settings.service.get_settings_from_db") as mock_get:
        mock_get.return_value = None

        result = await service.get_settings()

        # Should return defaults
        assert result.thresholds.defaultLowStockThreshold == 5
        assert result.sla.openMinutes == 240
        assert result.approvalStrategy.highRiskRequiresApproval is True
        assert result.emailDelivery.smtpPort == 587


@pytest.mark.asyncio
async def test_get_settings_caching():
    """Test settings caching mechanism."""
    mock_conn = MagicMock()
    service = SettingsService(mock_conn)

    with patch("app.settings.service.get_settings_from_db") as mock_get:
        mock_get.return_value = {
            "thresholds": {"defaultLowStockThreshold": 5, "maintenanceOverdueDays": 30, "chemicalThresholdOverrides": {}},
            "approvalStrategy": {"highRiskRequiresApproval": True, "equipmentFaultRequiresApproval": True, "maintenanceOverdueRequiresApproval": False},
            "sla": {"openMinutes": 240, "inProgressMinutes": 480, "pendingApprovalMinutes": 180, "reminderIntervalMinutes": 60, "maxReminderCountBeforeEscalation": 2},
            "emailDelivery": {},
            "updatedAt": "2026-05-05T10:00:00Z",
        }

        # First call - should hit database
        result1 = await service.get_settings()
        assert mock_get.call_count == 1

        # Second call - should use cache
        result2 = await service.get_settings()
        assert mock_get.call_count == 1  # Still 1, not called again

        assert result1.sla.openMinutes == result2.sla.openMinutes


@pytest.mark.asyncio
async def test_update_settings():
    """Test updating settings."""
    mock_conn = MagicMock()
    service = SettingsService(mock_conn)

    with patch("app.settings.service.get_settings_from_db") as mock_get, \
         patch("app.settings.service.upsert_settings") as mock_upsert:

        mock_get.return_value = {
            "thresholds": {"defaultLowStockThreshold": 5, "maintenanceOverdueDays": 30, "chemicalThresholdOverrides": {}},
            "approvalStrategy": {"highRiskRequiresApproval": True, "equipmentFaultRequiresApproval": True, "maintenanceOverdueRequiresApproval": False},
            "sla": {"openMinutes": 240, "inProgressMinutes": 480, "pendingApprovalMinutes": 180, "reminderIntervalMinutes": 60, "maxReminderCountBeforeEscalation": 2},
            "emailDelivery": {},
            "updatedAt": "2026-05-05T10:00:00Z",
        }

        patch_data = {
            "sla": {
                "openMinutes": 300,  # Changed from 240
                "inProgressMinutes": 480,
                "pendingApprovalMinutes": 180,
                "reminderIntervalMinutes": 60,
                "maxReminderCountBeforeEscalation": 2,
            }
        }

        result = await service.update_settings(patch_data, "user_001")

        # Verify updated value
        assert result.sla.openMinutes == 300

        # Verify upsert was called
        mock_upsert.assert_called_once()
        call_args = mock_upsert.call_args[0]
        assert call_args[1] == "default"  # setting_key


@pytest.mark.asyncio
async def test_update_settings_invalidates_cache():
    """Test that updating settings invalidates cache."""
    mock_conn = MagicMock()
    service = SettingsService(mock_conn)

    with patch("app.settings.service.get_settings_from_db") as mock_get, \
         patch("app.settings.service.upsert_settings") as mock_upsert:

        mock_get.return_value = {
            "thresholds": {"defaultLowStockThreshold": 5, "maintenanceOverdueDays": 30, "chemicalThresholdOverrides": {}},
            "approvalStrategy": {"highRiskRequiresApproval": True, "equipmentFaultRequiresApproval": True, "maintenanceOverdueRequiresApproval": False},
            "sla": {"openMinutes": 240, "inProgressMinutes": 480, "pendingApprovalMinutes": 180, "reminderIntervalMinutes": 60, "maxReminderCountBeforeEscalation": 2},
            "emailDelivery": {},
            "updatedAt": "2026-05-05T10:00:00Z",
        }

        # Get settings (populates cache)
        await service.get_settings()
        assert mock_get.call_count == 1

        # Update settings (should invalidate cache)
        await service.update_settings({"sla": {"openMinutes": 300, "inProgressMinutes": 480, "pendingApprovalMinutes": 180, "reminderIntervalMinutes": 60, "maxReminderCountBeforeEscalation": 2}}, "user_001")

        # Get settings again (should hit database again)
        await service.get_settings()
        assert mock_get.call_count == 3  # Raw update load + reload after cache invalidation


@pytest.mark.asyncio
async def test_get_settings_history():
    """Test getting settings history."""
    mock_conn = MagicMock()
    service = SettingsService(mock_conn)

    with patch("app.settings.service.list_history_from_db") as mock_list:
        mock_list.return_value = [
            {
                "id": 1,
                "settingKey": "default",
                "thresholds": {},
                "approvalStrategy": {},
                "sla": {},
                "version": 2,
                "updatedBy": "user_001",
                "updatedAt": "2026-05-05T12:00:00Z",
            },
            {
                "id": 2,
                "settingKey": "default",
                "thresholds": {},
                "approvalStrategy": {},
                "sla": {},
                "version": 1,
                "updatedBy": "system",
                "updatedAt": "2026-05-05T10:00:00Z",
            },
        ]

        result = await service.get_settings_history(limit=10)

        assert len(result) == 2
        assert result[0]["version"] == 2
        assert result[1]["version"] == 1
        mock_list.assert_called_once_with(mock_conn, "default", 10)


@pytest.mark.asyncio
async def test_update_partial_settings():
    """Test updating only part of settings."""
    mock_conn = MagicMock()
    service = SettingsService(mock_conn)

    with patch("app.settings.service.get_settings_from_db") as mock_get, \
         patch("app.settings.service.upsert_settings") as mock_upsert:

        mock_get.return_value = {
            "thresholds": {"defaultLowStockThreshold": 5, "maintenanceOverdueDays": 30, "chemicalThresholdOverrides": {}},
            "approvalStrategy": {"highRiskRequiresApproval": True, "equipmentFaultRequiresApproval": True, "maintenanceOverdueRequiresApproval": False},
            "sla": {"openMinutes": 240, "inProgressMinutes": 480, "pendingApprovalMinutes": 180, "reminderIntervalMinutes": 60, "maxReminderCountBeforeEscalation": 2},
            "emailDelivery": {},
            "updatedAt": "2026-05-05T10:00:00Z",
        }

        # Update only thresholds
        patch_data = {
            "thresholds": {
                "defaultLowStockThreshold": 10,  # Changed
                "maintenanceOverdueDays": 30,
                "chemicalThresholdOverrides": {},
            }
        }

        result = await service.update_settings(patch_data, "user_001")

        # Verify only thresholds changed
        assert result.thresholds.defaultLowStockThreshold == 10
        assert result.sla.openMinutes == 240  # Unchanged
        assert result.approvalStrategy.highRiskRequiresApproval is True  # Unchanged


@pytest.mark.asyncio
async def test_update_email_delivery_preserves_existing_password_when_blank():
    """Blank password in settings patch keeps the stored SMTP password."""
    mock_conn = MagicMock()
    service = SettingsService(mock_conn)

    with patch("app.settings.service.get_settings_from_db") as mock_get, \
         patch("app.settings.service.upsert_settings") as mock_upsert:

        mock_get.return_value = {
            "thresholds": {"defaultLowStockThreshold": 5, "maintenanceOverdueDays": 30, "chemicalThresholdOverrides": {}},
            "approvalStrategy": {"highRiskRequiresApproval": True, "equipmentFaultRequiresApproval": True, "maintenanceOverdueRequiresApproval": False},
            "sla": {"openMinutes": 240, "inProgressMinutes": 480, "pendingApprovalMinutes": 180, "reminderIntervalMinutes": 60, "maxReminderCountBeforeEscalation": 2},
            "emailDelivery": {
                "smtpHost": "smtp.old.example.com",
                "smtpPort": 587,
                "smtpUser": "old@example.com",
                "smtpPassword": "stored-secret",
                "smtpFrom": "old@example.com",
                "smtpUseSsl": False,
                "supervisorReportBaseUrl": "https://old.example.com",
            },
            "updatedAt": "2026-05-05T10:00:00Z",
        }

        result = await service.update_settings(
            {
                "emailDelivery": {
                    "smtpHost": "smtp.new.example.com",
                    "smtpPassword": "",
                }
            },
            "user_001",
        )

        assert result.emailDelivery.smtpHost == "smtp.new.example.com"
        assert result.emailDelivery.smtpPassword is None
        assert result.emailDelivery.passwordConfigured is True
        persisted_smtp = mock_upsert.call_args[0][5]
        assert persisted_smtp["smtpPassword"] == "stored-secret"
