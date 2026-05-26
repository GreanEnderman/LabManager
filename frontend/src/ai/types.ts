export type AIEventType = 'low_stock' | 'maintenance_overdue' | 'equipment_fault' | 'data_gap'
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
export type AIAssignee = '库管' | '采购' | '设备管理员' | '实验室管理员' | 'AI 员工'
export type AIApprovalStatus = 'pending' | 'approved' | 'rejected' | 'needs_info'
export type AIReportType = 'daily' | 'weekly' | 'risk_summary'
export type AISLAStatus = 'on_track' | 'overdue' | 'escalated'
export type DeliveryScopeType = 'lab' | 'department' | 'global'
export type ReportDeliveryStatus = 'success' | 'failed'

export interface AIEvent {
  id: string
  type: AIEventType
  title: string
  summary: string
  priority: AIPriority
  riskLevel: AIRiskLevel
  sourceType: 'chemical' | 'equipment' | 'system'
  sourceId: string
  sourceName: string
  suggestedTaskType: Exclude<AITaskType, 'report'>
  createdAt: string
  evidence?: string[]
  metadata?: Record<string, unknown>
}

export interface AITask {
  id: string
  type: AITaskType
  title: string
  summary: string
  status: AITaskStatus
  priority: AIPriority
  riskLevel: AIRiskLevel
  assignee: AIAssignee
  sourceType: AIEvent['sourceType']
  sourceId: string
  sourceName: string
  dueAt: string
  createdAt: string
  updatedAt: string
  recommendation: string
  evidence?: string[]
  requiresApproval?: boolean
  reminderCount?: number
  slaStatus?: AISLAStatus
  metadata?: Record<string, unknown>
}

export interface AIApproval {
  id: string
  taskId: string
  title: string
  reason: string
  status: AIApprovalStatus
  riskLevel: AIRiskLevel
  createdAt: string
  updatedAt: string
  comment?: string
}

export interface AIReport {
  id: string
  type: AIReportType
  title: string
  createdAt: string
  summary: string
  highlights: string[]
  sections?: Array<{
    title: string
    content: string
  }>
  metadata?: Record<string, unknown>
}

export interface SupervisorEmailMapping {
  id: string
  scopeType: DeliveryScopeType
  scopeId: string | null
  scopeName: string
  recipientName: string
  recipientEmail: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface ReportDeliveryConfig {
  id: string
  reportType: AIReportType
  scopeType: DeliveryScopeType
  scopeId: string | null
  scopeName: string
  channel: 'email'
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface ReportDeliveryRecord {
  id: string
  reportId: string
  reportTitle: string
  reportType: AIReportType
  recipientName: string
  recipientEmail: string
  channel: 'email'
  status: ReportDeliveryStatus
  errorMessage: string | null
  triggeredBy: {
    id: string
    name: string
    type: 'system' | 'user' | 'agent' | 'tool'
  }
  triggerMode: 'manual' | 'auto'
  sentAt: string
  createdAt: string
}

export interface AIActivityLog {
  id: string
  timestamp: string
  action: string
  detail: string
  actorType?: 'ai' | 'user' | 'system'
  actorName?: string
  taskId?: string
  approvalId?: string
}

export interface AIAnalysisSummary {
  generatedAt: string
  windowDays: number
  overview: {
    activeTasks: number
    pendingApprovals: number
    overdueTasks: number
    highRiskTasks: number
    lowStockItems: number
    maintenanceOverdueItems: number
  }
  inventory: {
    lowStockItems: Array<{
      id: string
      name: string
      currentQuantity: number
      minThreshold: number
      shortageRatio: number
      unit: string
    }>
    highUsageItems: Array<{
      id: string
      name: string
      outboundCount: number
      outboundQuantity: number
      unit: string
    }>
  }
  equipment: {
    overdueMaintenance: Array<{
      id: string
      name: string
      lastMaintenanceAt: string | null
      overdueDays: number
      status: string | null
    }>
    faultHotspots: Array<{
      id: string
      name: string
      faultCount: number
      latestFaultAt: string | null
    }>
  }
  workflow: {
    taskStatusDistribution: Record<string, number>
    approvalStatusDistribution: Record<string, number>
    slaRisks: Array<{
      taskId: string
      title: string
      status: string
      riskLevel: string
      dueAt?: string | null
      sourceName?: string | null
    }>
  }
  recommendations: Array<{
    id: string
    severity: 'info' | 'warning' | 'critical'
    category: 'inventory' | 'equipment' | 'workflow' | 'approval'
    title: string
    reason: string
    suggestedAction: string
    evidence: Array<{ label: string; value: string }>
  }>
}

export interface AIThresholdSettings {
  defaultLowStockThreshold: number
  maintenanceOverdueDays: number
  chemicalThresholdOverrides: Record<string, number>
}

export interface AIApprovalStrategySettings {
  highRiskRequiresApproval: boolean
  equipmentFaultRequiresApproval: boolean
  maintenanceOverdueRequiresApproval: boolean
}

export interface AISLASettings {
  openMinutes: number
  inProgressMinutes: number
  pendingApprovalMinutes: number
  reminderIntervalMinutes: number
  maxReminderCountBeforeEscalation: number
}

export interface AIEmailDeliverySettings {
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpPassword?: string | null
  smtpFrom: string | null
  smtpUseSsl: boolean
  supervisorReportBaseUrl: string | null
  passwordConfigured: boolean
}

export interface AISettings {
  thresholds: AIThresholdSettings
  approvalStrategy: AIApprovalStrategySettings
  sla: AISLASettings
  emailDelivery: AIEmailDeliverySettings
  updatedAt: string
}
