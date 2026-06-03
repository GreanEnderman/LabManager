import type {
  ActionReasonCode,
  AIActionType,
  AIApprovalStatus,
  AuditActor,
  AIEventType,
  AIEvidenceItem,
  AIPriority,
  AIReportType,
  DeliveryScopeType,
  DeliveryTriggerMode,
  ReportDeliveryChannel,
  ReportDeliveryStatus,
  AIRiskLevel,
  AISourceType,
  AITaskStatus,
  AITaskType,
  UserRole,
} from './types'

export interface AIEventRecord {
  id: string
  type: AIEventType
  sourceType: AISourceType
  sourceId: string
  sourceName: string
  title: string
  summary: string
  priority: AIPriority
  riskLevel: AIRiskLevel
  evidence: AIEvidenceItem[]
  metadata: Record<string, unknown>
  createdAt: string
}

export interface AITaskRecord {
  id: string
  eventId: string | null
  type: AITaskType
  title: string
  summary: string
  recommendation: string
  status: AITaskStatus
  priority: AIPriority
  riskLevel: AIRiskLevel
  sourceType: AISourceType
  sourceId: string
  sourceName: string
  assigneeId: string | null
  assigneeName: string | null
  assigneeRole: string | null
  requiresApproval: boolean
  dueAt: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  metadata: Record<string, unknown>
}

export interface AITaskActionRecord {
  id: string
  taskId: string | null
  approvalId: string | null
  actionType: AIActionType
  fromStatus: AITaskStatus | null
  toStatus: AITaskStatus | null
  actor: AuditActor
  reasonCodes: ActionReasonCode[]
  detail: string
  toolName: string | null
  snapshot: Record<string, unknown>
  createdAt: string
}

export interface AIApprovalRecord {
  id: string
  taskId: string
  title: string
  reason: string
  status: AIApprovalStatus
  riskLevel: AIRiskLevel
  requestedBy: AuditActor
  reviewerId: string | null
  reviewerName: string | null
  comment: string | null
  createdAt: string
  updatedAt: string
  decidedAt: string | null
  metadata: Record<string, unknown>
}

export interface AIMemoryRecord {
  id: string
  memoryType: 'summary' | 'pattern' | 'policy' | 'incident'
  sourceType: 'task' | 'approval' | 'report' | 'graph_run'
  sourceId: string
  title: string
  content: string
  tags: string[]
  confidence: number
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface AIReportRecord {
  id: string
  type: AIReportType
  title: string
  summary: string
  highlights: string[]
  createdAt: string
  metadata: Record<string, unknown>
}

export interface SupervisorEmailMappingRecord {
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

export interface ReportDeliveryConfigRecord {
  id: string
  reportType: AIReportType
  scopeType: DeliveryScopeType
  scopeId: string | null
  scopeName: string
  channel: ReportDeliveryChannel
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
  channel: ReportDeliveryChannel
  status: ReportDeliveryStatus
  errorMessage: string | null
  triggeredBy: AuditActor
  triggerMode: DeliveryTriggerMode
  sentAt: string
  createdAt: string
}

export interface UserRecord {
  id: string
  username: string
  passwordHash: string
  name: string
  role: UserRole
  enabled: boolean
  passwordChangedAt: string
  tokenVersion: number
  createdAt: string
  updatedAt: string
}

export interface ChemicalInventoryRecord {
  id: string
  name: string
  casNumber: string | null
  category: string | null
  spec: string | null
  currentQuantity: number
  threshold: number
  status: string
  ownerName: string | null
  updatedAt: string
  imageDataUrl: string | null
  remark: string | null
  metadata: Record<string, unknown>
}

export interface EquipmentAssetRecord {
  id: string
  name: string
  vendor: string | null
  model: string | null
  status: string
  labName: string | null
  ownerName: string | null
  lastMaintenanceAt: string | null
  updatedAt: string
  imageDataUrl: string | null
  remark: string | null
  metadata: Record<string, unknown>
}

export interface ImportErrorRecord {
  rowNumber: number
  field: string
  code: string
  message: string
  rawValue: unknown
}

export interface ImportBatchRecord {
  id: string
  entityType: 'chemical' | 'equipment'
  source: 'manual' | 'excel'
  fileName: string | null
  status: 'completed' | 'partial_failed' | 'failed'
  totalCount: number
  successCount: number
  failureCount: number
  importedBy: AuditActor
  createdAt: string
  completedAt: string
  importedRecordIds: string[]
  ruleInspectionTriggered: boolean
  generatedEventCount: number
  errors: ImportErrorRecord[]
  metadata: Record<string, unknown>
}

export interface SystemSettingsRecord {
  id: string
  scopeType: 'global' | 'lab'
  scopeId: string | null
  settingKey: string
  thresholds: {
    defaultLowStockThreshold: number
    maintenanceOverdueDays: number
    chemicalThresholdOverrides: Record<string, number>
  }
  approvalStrategy: {
    highRiskRequiresApproval: boolean
    equipmentFaultRequiresApproval: boolean
    maintenanceOverdueRequiresApproval: boolean
  }
  sla: {
    openMinutes: number
    inProgressMinutes: number
    pendingApprovalMinutes: number
    reminderIntervalMinutes: number
    maxReminderCountBeforeEscalation: number
  }
  version: number
  updatedBy: AuditActor | null
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export type ColumnType =
  | 'id'
  | 'string'
  | 'text'
  | 'boolean'
  | 'enum'
  | 'json'
  | 'datetime'
  | 'string[]'
  | 'number'
  | 'email'

export type FormalTableName =
  | 'ai_tasks'
  | 'ai_task_actions'
  | 'approvals'
  | 'ai_reports'
  | 'import_jobs'
  | 'report_deliveries'
  | 'system_settings'

export interface TableColumnDefinition {
  type: ColumnType
  required: boolean
  description: string
}

export interface TableIndexDefinition {
  name: string
  columns: string[]
  unique?: boolean
  description: string
}

export interface TableForeignKeyDefinition {
  columns: string[]
  references: {
    table: FormalTableName
    columns: string[]
  }
  description: string
}

export interface TableDefinition {
  name: FormalTableName | 'ai_memories'
  description: string
  columns: Record<string, TableColumnDefinition>
  indexes?: TableIndexDefinition[]
  foreignKeys?: TableForeignKeyDefinition[]
  auditFields?: string[]
  metadataPolicy?: string
}

export const aiTableDefinitions: TableDefinition[] = [
  {
    name: 'ai_tasks',
    description: 'AI 任务主表，承载任务详情、责任人、状态与来源对象。',
    columns: {
      id: { type: 'id', required: true, description: '任务主键。' },
      eventId: { type: 'id', required: false, description: '关联事件 ID。' },
      type: { type: 'enum', required: true, description: '任务类型。' },
      title: { type: 'string', required: true, description: '任务标题。' },
      summary: { type: 'text', required: true, description: '任务摘要。' },
      recommendation: { type: 'text', required: true, description: 'AI 建议动作。' },
      status: { type: 'enum', required: true, description: '任务状态。' },
      priority: { type: 'enum', required: true, description: '优先级。' },
      riskLevel: { type: 'enum', required: true, description: '风险等级。' },
      sourceType: { type: 'enum', required: true, description: '来源对象类型。' },
      sourceId: { type: 'string', required: true, description: '来源对象 ID。' },
      sourceName: { type: 'string', required: true, description: '来源对象名称。' },
      assigneeId: { type: 'string', required: false, description: '责任人 ID。' },
      assigneeName: { type: 'string', required: false, description: '责任人名称。' },
      assigneeRole: { type: 'string', required: false, description: '责任角色。' },
      requiresApproval: { type: 'boolean', required: true, description: '是否需要审批。' },
      dueAt: { type: 'datetime', required: false, description: '计划截止时间。' },
      createdAt: { type: 'datetime', required: true, description: '创建时间。' },
      updatedAt: { type: 'datetime', required: true, description: '更新时间。' },
      closedAt: { type: 'datetime', required: false, description: '关闭时间。' },
      metadata: { type: 'json', required: true, description: '扩展字段。' },
    },
    indexes: [
      {
        name: 'idx_ai_tasks_status_priority_risk_due_at',
        columns: ['status', 'priority', 'riskLevel', 'dueAt'],
        description: '支撑任务中心、驾驶台和 SLA 检查的主查询路径。',
      },
      {
        name: 'idx_ai_tasks_source_type_source_id',
        columns: ['sourceType', 'sourceId'],
        description: '支撑同源对象查重、回溯和跨链路关联查询。',
      },
    ],
    auditFields: ['createdAt', 'updatedAt', 'closedAt'],
    metadataPolicy: 'metadata 仅承载扩展上下文，任务状态、来源、审批门禁、责任人与 SLA 不得只存在于 metadata。',
  },
  {
    name: 'ai_task_actions',
    description: 'AI 动作日志表，记录状态变化、审批关联、操作者和工具。',
    columns: {
      id: { type: 'id', required: true, description: '动作日志主键。' },
      taskId: { type: 'id', required: true, description: '关联任务 ID。' },
      approvalId: { type: 'id', required: false, description: '关联审批 ID。' },
      actionType: { type: 'enum', required: true, description: '动作类型。' },
      fromStatus: { type: 'enum', required: false, description: '变更前任务状态。' },
      toStatus: { type: 'enum', required: false, description: '变更后任务状态。' },
      actor: { type: 'json', required: true, description: '触发动作的主体。' },
      reasonCodes: { type: 'json', required: true, description: '动作原因码。' },
      detail: { type: 'text', required: true, description: '动作详情。' },
      toolName: { type: 'string', required: false, description: '调用的工具名称。' },
      snapshot: { type: 'json', required: true, description: '动作发生时快照。' },
      createdAt: { type: 'datetime', required: true, description: '记录时间。' },
    },
    indexes: [
      {
        name: 'idx_ai_task_actions_task_id_created_at_desc',
        columns: ['taskId', 'createdAt'],
        description: '支撑任务详情时间线、审计追踪与回放。',
      },
    ],
    foreignKeys: [
      {
        columns: ['taskId'],
        references: {
          table: 'ai_tasks',
          columns: ['id'],
        },
        description: '动作日志关联所属任务。',
      },
      {
        columns: ['approvalId'],
        references: {
          table: 'approvals',
          columns: ['id'],
        },
        description: '审批相关动作日志可回溯到对应审批单。',
      },
    ],
    auditFields: ['createdAt'],
    metadataPolicy: 'snapshot 为审计取证字段，不替代正式关系型业务真相。',
  },
  {
    name: 'approvals',
    description: '审批主表，记录审批发起、处理和意见。',
    columns: {
      id: { type: 'id', required: true, description: '审批主键。' },
      taskId: { type: 'id', required: true, description: '关联任务 ID。' },
      title: { type: 'string', required: true, description: '审批标题。' },
      reason: { type: 'text', required: true, description: '审批原因。' },
      status: { type: 'enum', required: true, description: '审批状态。' },
      riskLevel: { type: 'enum', required: true, description: '风险等级。' },
      requestedBy: { type: 'json', required: true, description: '发起人。' },
      reviewerId: { type: 'string', required: false, description: '审批人 ID。' },
      reviewerName: { type: 'string', required: false, description: '审批人名称。' },
      comment: { type: 'text', required: false, description: '审批意见。' },
      createdAt: { type: 'datetime', required: true, description: '创建时间。' },
      updatedAt: { type: 'datetime', required: true, description: '更新时间。' },
      decidedAt: { type: 'datetime', required: false, description: '决策时间。' },
      metadata: { type: 'json', required: true, description: '扩展字段。' },
    },
    indexes: [
      {
        name: 'idx_approvals_status_risk_created_at_desc',
        columns: ['status', 'riskLevel', 'createdAt'],
        description: '支撑审批台队列、风险分层和待处理排序。',
      },
    ],
    foreignKeys: [
      {
        columns: ['taskId'],
        references: {
          table: 'ai_tasks',
          columns: ['id'],
        },
        description: '审批单必须绑定任务主记录。',
      },
    ],
    auditFields: ['createdAt', 'updatedAt', 'decidedAt'],
    metadataPolicy: 'metadata 可承载补充审批上下文，但审批状态、任务绑定和风险等级必须为结构化列。',
  },
  {
    name: 'ai_reports',
    description: 'AI 报告主表，记录日报、周报等正式报告实体。',
    columns: {
      id: { type: 'id', required: true, description: '报告主键。' },
      type: { type: 'enum', required: true, description: '报告类型。' },
      title: { type: 'string', required: true, description: '报告标题。' },
      summary: { type: 'text', required: true, description: '摘要内容。' },
      highlights: { type: 'json', required: true, description: '重点摘要条目。' },
      createdAt: { type: 'datetime', required: true, description: '生成时间。' },
      metadata: { type: 'json', required: true, description: '扩展上下文。' },
    },
    indexes: [
      {
        name: 'idx_ai_reports_type_created_at_desc',
        columns: ['type', 'createdAt'],
        description: '支撑报告中心按类型和时间查询。',
      },
    ],
    auditFields: ['createdAt'],
    metadataPolicy: 'metadata 可放报告生成上下文，报告类型、标题与摘要不得仅保存在 metadata。',
  },
  {
    name: 'import_jobs',
    description: '导入作业主表，记录手工录入与批量导入批次结果。',
    columns: {
      id: { type: 'id', required: true, description: '导入作业主键。' },
      entityType: { type: 'enum', required: true, description: '导入实体类型。' },
      source: { type: 'enum', required: true, description: '导入来源。' },
      fileName: { type: 'string', required: false, description: '原始文件名。' },
      status: { type: 'enum', required: true, description: '导入作业状态。' },
      totalCount: { type: 'number', required: true, description: '总处理条数。' },
      successCount: { type: 'number', required: true, description: '成功条数。' },
      failureCount: { type: 'number', required: true, description: '失败条数。' },
      importedBy: { type: 'json', required: true, description: '导入操作者。' },
      createdAt: { type: 'datetime', required: true, description: '作业创建时间。' },
      completedAt: { type: 'datetime', required: true, description: '作业完成时间。' },
      importedRecordIds: { type: 'json', required: true, description: '成功导入的记录 ID 列表。' },
      ruleInspectionTriggered: { type: 'boolean', required: true, description: '是否触发规则巡检。' },
      generatedEventCount: { type: 'number', required: true, description: '触发的事件数量。' },
      errors: { type: 'json', required: true, description: '导入错误清单。' },
      metadata: { type: 'json', required: true, description: '扩展信息。' },
    },
    indexes: [
      {
        name: 'idx_import_jobs_status_created_at_desc',
        columns: ['status', 'createdAt'],
        description: '支撑导入历史查看与失败批次追踪。',
      },
    ],
    auditFields: ['createdAt', 'completedAt'],
    metadataPolicy: 'metadata 可放批次附加说明，作业状态、统计字段和是否触发规则巡检必须为结构化列。',
  },
  {
    name: 'report_deliveries',
    description: '报告投递表，记录报告发送对象、结果与失败信息。',
    columns: {
      id: { type: 'id', required: true, description: '投递记录主键。' },
      reportId: { type: 'id', required: true, description: '关联报告 ID。' },
      reportTitle: { type: 'string', required: true, description: '报告标题快照。' },
      reportType: { type: 'enum', required: true, description: '报告类型快照。' },
      recipientName: { type: 'string', required: true, description: '接收人名称。' },
      recipientEmail: { type: 'email', required: true, description: '接收邮箱。' },
      channel: { type: 'enum', required: true, description: '投递渠道。' },
      status: { type: 'enum', required: true, description: '投递状态。' },
      errorMessage: { type: 'text', required: false, description: '失败原因。' },
      triggeredBy: { type: 'json', required: true, description: '触发人信息。' },
      triggerMode: { type: 'enum', required: true, description: '触发方式。' },
      sentAt: { type: 'datetime', required: true, description: '发送时间。' },
      createdAt: { type: 'datetime', required: true, description: '记录创建时间。' },
      metadata: { type: 'json', required: true, description: '扩展字段。' },
    },
    indexes: [
      {
        name: 'idx_report_deliveries_report_id_status_sent_at_desc',
        columns: ['reportId', 'status', 'sentAt'],
        description: '支撑报告详情中的投递历史与失败重试追踪。',
      },
    ],
    foreignKeys: [
      {
        columns: ['reportId'],
        references: {
          table: 'ai_reports',
          columns: ['id'],
        },
        description: '每条投递记录必须关联正式报告。',
      },
    ],
    auditFields: ['createdAt', 'sentAt'],
    metadataPolicy: 'metadata 可存外部投递响应片段，但接收方、渠道、状态和失败原因必须为结构化列。',
  },
  {
    name: 'system_settings',
    description: '系统运行配置表，持久化阈值、审批策略、SLA 与变更审计信息。',
    columns: {
      id: { type: 'id', required: true, description: '配置记录主键。' },
      scopeType: { type: 'enum', required: true, description: '配置作用域类型。' },
      scopeId: { type: 'string', required: false, description: '配置作用域 ID。' },
      settingKey: { type: 'string', required: true, description: '作用域内唯一配置键。' },
      thresholds: { type: 'json', required: true, description: '阈值设置。' },
      approvalStrategy: { type: 'json', required: true, description: '审批策略。' },
      sla: { type: 'json', required: true, description: 'SLA 配置。' },
      version: { type: 'number', required: true, description: '配置版本号。' },
      updatedBy: { type: 'json', required: false, description: '最后更新人。' },
      createdAt: { type: 'datetime', required: true, description: '创建时间。' },
      updatedAt: { type: 'datetime', required: true, description: '更新时间。' },
      metadata: { type: 'json', required: true, description: '扩展字段。' },
    },
    indexes: [
      {
        name: 'ux_system_settings_setting_key',
        columns: ['settingKey'],
        unique: true,
        description: '支撑配置唯一查找与幂等更新。',
      },
    ],
    auditFields: ['createdAt', 'updatedAt'],
    metadataPolicy: 'metadata 可承载兼容性扩展，但阈值、审批策略、SLA 与版本号必须为正式结构化字段。',
  },
  {
    name: 'ai_memories',
    description: 'AI 记忆表，用于沉淀可复用经验、摘要与策略。',
    columns: {
      id: { type: 'id', required: true, description: '记忆主键。' },
      memoryType: { type: 'enum', required: true, description: '记忆类型。' },
      sourceType: { type: 'enum', required: true, description: '来源类型。' },
      sourceId: { type: 'string', required: true, description: '来源 ID。' },
      title: { type: 'string', required: true, description: '记忆标题。' },
      content: { type: 'text', required: true, description: '记忆内容。' },
      tags: { type: 'string[]', required: true, description: '标签。' },
      confidence: { type: 'number', required: true, description: '置信度。' },
      createdAt: { type: 'datetime', required: true, description: '创建时间。' },
      updatedAt: { type: 'datetime', required: true, description: '更新时间。' },
      metadata: { type: 'json', required: true, description: '扩展字段。' },
    },
  },
]
