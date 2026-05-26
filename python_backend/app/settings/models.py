"""Settings models."""

from pydantic import BaseModel


class ThresholdsSettings(BaseModel):
    defaultLowStockThreshold: int = 5
    maintenanceOverdueDays: int = 30
    chemicalThresholdOverrides: dict[str, int] = {}


class ApprovalStrategySettings(BaseModel):
    highRiskRequiresApproval: bool = True
    equipmentFaultRequiresApproval: bool = True
    maintenanceOverdueRequiresApproval: bool = False


class SLASettings(BaseModel):
    openMinutes: int = 240
    inProgressMinutes: int = 480
    pendingApprovalMinutes: int = 180
    reminderIntervalMinutes: int = 60
    maxReminderCountBeforeEscalation: int = 2


class EmailDeliverySettings(BaseModel):
    smtpHost: str | None = None
    smtpPort: int | None = 587
    smtpUser: str | None = None
    smtpPassword: str | None = None
    smtpFrom: str | None = None
    smtpUseSsl: bool = False
    supervisorReportBaseUrl: str | None = None
    passwordConfigured: bool = False


class AISettings(BaseModel):
    thresholds: ThresholdsSettings
    approvalStrategy: ApprovalStrategySettings
    sla: SLASettings
    emailDelivery: EmailDeliverySettings = EmailDeliverySettings()
    updatedAt: str


class SettingsPatch(BaseModel):
    thresholds: ThresholdsSettings | None = None
    approvalStrategy: ApprovalStrategySettings | None = None
    sla: SLASettings | None = None
    emailDelivery: EmailDeliverySettings | None = None


class UpdateSettingsRequest(BaseModel):
    patch: SettingsPatch
    updatedBy: str = "system"
