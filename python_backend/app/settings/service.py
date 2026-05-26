"""Settings service for managing system settings."""

from datetime import datetime, timezone
from typing import Optional
from psycopg import AsyncConnection

from app.settings.repository import (
    get_settings as get_settings_from_db,
    upsert_settings,
    list_settings_history as list_history_from_db,
)
from app.settings.models import (
    AISettings,
    ThresholdsSettings,
    ApprovalStrategySettings,
    SLASettings,
    EmailDeliverySettings,
)


class SettingsService:
    """Service for settings operations with caching."""

    def __init__(self, conn: AsyncConnection):
        """Initialize settings service.

        Args:
            conn: Database connection
        """
        self.conn = conn
        self._cache: Optional[AISettings] = None
        self._cache_time: Optional[datetime] = None
        self._cache_ttl_seconds = 300  # 5 minutes

    def _is_cache_valid(self) -> bool:
        """Check if cache is still valid."""
        if self._cache is None or self._cache_time is None:
            return False

        now = datetime.now(timezone.utc)
        elapsed = (now - self._cache_time).total_seconds()
        return elapsed < self._cache_ttl_seconds

    def _redact_email_delivery(self, email_delivery: EmailDeliverySettings) -> EmailDeliverySettings:
        if not email_delivery.smtpPassword:
            return email_delivery
        return email_delivery.model_copy(
            update={
                "smtpPassword": None,
                "passwordConfigured": True,
            }
        )

    def _get_default_settings(self, include_secrets: bool = False) -> AISettings:
        """Get default settings."""
        settings = AISettings(
            thresholds=ThresholdsSettings(),
            approvalStrategy=ApprovalStrategySettings(),
            sla=SLASettings(),
            emailDelivery=EmailDeliverySettings(),
            updatedAt=datetime.now(timezone.utc).isoformat(),
        )
        if not include_secrets:
            settings.emailDelivery = self._redact_email_delivery(settings.emailDelivery)
        return settings

    async def get_settings(self, setting_key: str = "default", include_secrets: bool = False) -> AISettings:
        """Get settings from database with caching.

        Args:
            setting_key: Settings key (default: "default")

        Returns:
            AI settings
        """
        # Check cache first
        if self._is_cache_valid() and not include_secrets:
            return self._cache

        # Load from database
        settings_dict = await get_settings_from_db(self.conn, setting_key)

        if settings_dict:
            # Parse from database
            email_delivery = EmailDeliverySettings(**settings_dict.get("emailDelivery", {}))
            settings = AISettings(
                thresholds=ThresholdsSettings(**settings_dict["thresholds"]),
                approvalStrategy=ApprovalStrategySettings(
                    **settings_dict["approvalStrategy"]
                ),
                sla=SLASettings(**settings_dict["sla"]),
                emailDelivery=email_delivery,
                updatedAt=settings_dict["updatedAt"],
            )
        else:
            # Use defaults
            settings = self._get_default_settings(include_secrets=include_secrets)

        if not include_secrets:
            settings.emailDelivery = self._redact_email_delivery(settings.emailDelivery)

        # Update cache
        if not include_secrets:
            self._cache = settings
            self._cache_time = datetime.now(timezone.utc)

        return settings

    async def update_settings(
        self,
        patch: dict,
        updated_by: str,
        setting_key: str = "default",
    ) -> AISettings:
        """Update settings with partial patch.

        Args:
            patch: Partial settings update
            updated_by: User ID who is updating
            setting_key: Settings key (default: "default")

        Returns:
            Updated settings
        """
        # Get current settings
        current = await self.get_settings(setting_key, include_secrets=True)

        # Apply patch (deep merge)
        if "thresholds" in patch:
            current.thresholds = ThresholdsSettings(**patch["thresholds"])

        if "approvalStrategy" in patch:
            current.approvalStrategy = ApprovalStrategySettings(
                **patch["approvalStrategy"]
            )

        if "sla" in patch:
            current.sla = SLASettings(**patch["sla"])

        if "emailDelivery" in patch:
            email_patch = dict(patch["emailDelivery"])
            existing_password = current.emailDelivery.smtpPassword
            if not email_patch.get("smtpPassword"):
                email_patch["smtpPassword"] = existing_password
            current.emailDelivery = EmailDeliverySettings(**{
                **current.emailDelivery.model_dump(),
                **email_patch,
                "passwordConfigured": bool(email_patch.get("smtpPassword")),
            })

        # Update timestamp
        current.updatedAt = datetime.now(timezone.utc).isoformat()

        # Persist to database
        await upsert_settings(
            self.conn,
            setting_key,
            current.thresholds.model_dump(),
            current.approvalStrategy.model_dump(),
            current.sla.model_dump(),
            current.emailDelivery.model_dump(exclude={"passwordConfigured"}),
            updated_by,
        )

        # Invalidate cache
        self._cache = None
        self._cache_time = None

        current.emailDelivery = self._redact_email_delivery(current.emailDelivery)
        return current

    async def get_settings_history(
        self,
        setting_key: str = "default",
        limit: int = 10,
    ) -> list[dict]:
        """Get settings history for audit trail.

        Args:
            setting_key: Settings key (default: "default")
            limit: Maximum number of history entries

        Returns:
            List of settings history entries
        """
        return await list_history_from_db(self.conn, setting_key, limit)
