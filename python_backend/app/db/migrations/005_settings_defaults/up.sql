-- Insert default settings
-- This migration populates the system_settings table with default values

INSERT INTO system_settings (
    id,
    setting_key,
    scope_type,
    scope_id,
    thresholds,
    approval_strategy,
    sla,
    version,
    updated_by,
    created_at,
    updated_at
) VALUES (
    'default-global',
    'default',
    'global',
    NULL,
    '{"defaultLowStockThreshold": 5, "maintenanceOverdueDays": 30, "chemicalThresholdOverrides": {}}'::jsonb,
    '{"highRiskRequiresApproval": true, "equipmentFaultRequiresApproval": true, "maintenanceOverdueRequiresApproval": false}'::jsonb,
    '{"openMinutes": 240, "inProgressMinutes": 480, "pendingApprovalMinutes": 180, "reminderIntervalMinutes": 60, "maxReminderCountBeforeEscalation": 2}'::jsonb,
    1,
    '{"id": "system", "name": "System", "type": "system"}'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT (setting_key) DO NOTHING;
