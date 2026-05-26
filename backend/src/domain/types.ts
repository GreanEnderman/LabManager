export type AIEventType = 'low_stock' | 'maintenance_overdue' | 'equipment_fault'
export type AISourceType = 'chemical' | 'equipment' | 'system'
export type AITaskType =
  | 'chemical_purchase'
  | 'equipment_maintenance'
  | 'equipment_repair'
  | 'restock'
  | 'maintenance'
  | 'anomaly_review'
  | 'data_fix'
  | 'report'
export type AITaskStatus = 'open' | 'in_progress' | 'pending_approval' | 'done' | 'closed'
export type AIPriority = 'P0' | 'P1' | 'P2'
export type AIRiskLevel = 'high' | 'medium' | 'low'
export type AIApprovalStatus = 'pending' | 'approved' | 'rejected' | 'needs_info'
export type AIReportType = 'daily' | 'weekly' | 'risk_summary'
export type AIActorType = 'system' | 'user' | 'agent' | 'tool'
export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer'
export type DeliveryScopeType = 'lab' | 'department' | 'global'
export type ReportDeliveryChannel = 'email'
export type ReportDeliveryStatus = 'success' | 'failed'
export type DeliveryTriggerMode = 'manual'
export type AIActionType =
  | 'task_created'
  | 'task_assigned'
  | 'task_status_changed'
  | 'task_closed'
  | 'approval_requested'
  | 'approval_processed'
  | 'sla_reminder_sent'
  | 'task_escalated'
  | 'report_generated'
  | 'report_delivery_requested'
  | 'report_delivery_succeeded'
  | 'report_delivery_failed'
  | 'memory_upserted'

export type ActionReasonCode =
  | 'event_validated'
  | 'event_duplicated'
  | 'manual_request'
  | 'inventory_threshold_hit'
  | 'maintenance_overdue'
  | 'equipment_fault'
  | 'approval_required'
  | 'approval_approved'
  | 'approval_rejected'
  | 'approval_needs_info'
  | 'sla_reminder_due'
  | 'sla_timeout'
  | 'sla_escalated'
  | 'report_delivery_requested'
  | 'report_delivery_succeeded'
  | 'report_delivery_failed'

export interface AuditActor {
  type: AIActorType
  id: string
  name: string
}

export interface AIEvidenceItem {
  kind: 'text' | 'metric' | 'link'
  label: string
  value: string
}
