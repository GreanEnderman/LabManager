import type {
  AIApprovalDTO,
  AIEventDTO,
  AIReportDTO,
  AITaskActionDTO,
  AITaskDTO,
} from '../../../backend/src/contracts/shared'
import type { ApprovalDecision } from '../../../backend/src/domain/approval-state-machine'
import type { TaskTransitionName } from '../../../backend/src/domain/task-state-machine'
import type { AIGateway, CompletionReportInput, InventoryListOptions } from './aiGateway'
import { getAiGateway } from './getAiGateway'
import type {
  ChemicalImportRecord,
  EquipmentImportRecord,
  ImportBatchRecord,
  ImportErrorItem,
} from '../imports/types'
import type {
  AIActivityLog,
  AIApproval,
  AIAssignee,
  AIEvent,
  AIReport,
  ReportDeliveryConfig,
  ReportDeliveryRecord,
  SupervisorEmailMapping,
  AISettings,
  AITask,
  AITaskStatus,
} from '../ai/types'

const gateway: AIGateway = getAiGateway()

function getImportErrorMessage(error: {
  field?: string
  code?: string
  message?: string
  error?: string
  rawValue?: unknown
  data?: unknown
}) {
  const rawMessage = String(error.message ?? error.error ?? '').trim()
  const rawValue = error.rawValue ?? error.data
  const lowerMessage = rawMessage.toLowerCase()

  if (error.code === 'duplicate_record' || lowerMessage.includes('duplicate')) {
    return '记录重复：这一行和本次导入中的其他行使用了相同的记录 ID 或名称，请删除重复行，或改成唯一的记录 ID。'
  }

  if (
    error.code === 'invalid_number' ||
    lowerMessage.includes('invalid input syntax') ||
    lowerMessage.includes('not a valid number')
  ) {
    return '数字格式不正确：库存、阈值或数量只能填写数字，请删掉单位、空格或文字。'
  }

  if (lowerMessage.includes('null value') || lowerMessage.includes('not-null') || lowerMessage.includes('required')) {
    if (error.field && error.field !== 'row') {
      return `必填字段缺失：${error.field} 没有填写，请补全后重新导入。`
    }
    return '必填字段缺失：这一行缺少名称、状态、数量等必要信息，请补全后重新导入。'
  }

  if (lowerMessage.includes('date') || lowerMessage.includes('timestamp')) {
    return '日期格式不正确：请使用 2026-06-03 或 2026-06-03 09:30:00 这类格式。'
  }

  if (lowerMessage.includes('chemical not found') || rawMessage.includes('未找到匹配的化学品')) {
    return `物料未匹配库存：${String(rawValue ?? '').trim() || '该物料'} 不在当前化学品库存中，请把物料名称改成库存里的名称或记录 ID。`
  }

  if (rawMessage) {
    return `导入失败：${rawMessage}`
  }

  return '导入失败：这一行没有成功写入，请检查必填字段、数字格式和是否重复。'
}

function getCurrentActor() {
  return {
    id: 'frontend-user',
    name: '前端联调',
    type: 'user' as const,
  }
}

function mapImportErrors(errors: Array<{
  rowNumber?: number
  row?: number
  field?: string
  code?: string
  message?: string
  error?: string
  rawValue?: unknown
  data?: unknown
}>): ImportErrorItem[] {
  return errors.map((error) => ({
    rowNumber: error.rowNumber ?? (typeof error.row === 'number' ? error.row + 1 : 0),
    field: error.field ?? 'row',
    code:
      error.code === 'required' || error.code === 'invalid_number' || error.code === 'duplicate_record'
        ? error.code
        : 'required',
    message: error.message ?? error.error ?? '导入失败，未返回具体错误信息。',
    rawValue: error.rawValue ?? error.data ?? null,
  }))
}

function mapReadableImportErrors(errors: Array<{
  rowNumber?: number
  row?: number
  field?: string
  code?: string
  message?: string
  error?: string
  rawValue?: unknown
  data?: unknown
}>): ImportErrorItem[] {
  return errors.map((error) => ({
    rowNumber: error.rowNumber ?? (typeof error.row === 'number' ? error.row + 1 : 0),
    field: error.field ?? 'row',
    code:
      error.code === 'required' || error.code === 'invalid_number' || error.code === 'duplicate_record'
        ? error.code
        : 'required',
    message: getImportErrorMessage(error),
    rawValue: error.rawValue ?? error.data ?? null,
  }))
}

void mapImportErrors

function mapBatch(batch: {
  id: string
  entityType: 'chemical' | 'equipment'
  source: 'manual' | 'excel'
  fileName: string | null
  status: 'completed' | 'partial_failed' | 'failed'
  totalCount: number
  successCount: number
  failureCount: number
  createdAt: string
  importedBy: { id: string; name: string; type: string }
  importedRecordIds: string[]
  generatedEventCount: number
  errors: Array<{
    rowNumber?: number
    row?: number
    field?: string
    code?: string
    message?: string
    error?: string
    rawValue?: unknown
    data?: unknown
  }>
}): ImportBatchRecord {
  return {
    id: batch.id,
    entityType: batch.entityType,
    source: batch.source,
    fileName: batch.fileName,
    status: batch.status,
    totalCount: batch.totalCount,
    successCount: batch.successCount,
    failureCount: batch.failureCount,
    createdAt: batch.createdAt,
    importedBy: batch.importedBy.name,
    importedRecordIds: batch.importedRecordIds,
    generatedEventCount: batch.generatedEventCount,
    errors: mapReadableImportErrors(batch.errors),
  }
}

function mapChemical(record: {
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
}): ChemicalImportRecord {
  return {
    id: record.id,
    name: record.name,
    casNumber: record.casNumber ?? '',
    category: record.category ?? '',
    spec: record.spec ?? '',
    currentQuantity: record.currentQuantity,
    batchNumber: '',
    openedAt: '',
    expiryDate: '',
    threshold: record.threshold,
    status: record.status,
    ownerName: record.ownerName ?? '',
    updatedAt: record.updatedAt,
    imageDataUrl: record.imageDataUrl ?? '',
    remark: record.remark ?? '',
  }
}

function mapEquipment(record: {
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
}): EquipmentImportRecord {
  return {
    id: record.id,
    name: record.name,
    vendor: record.vendor ?? '',
    model: record.model ?? '',
    status: record.status,
    labName: record.labName ?? '',
    ownerName: record.ownerName ?? '',
    lastMaintenanceAt: record.lastMaintenanceAt ?? '',
    updatedAt: record.updatedAt,
    imageDataUrl: record.imageDataUrl ?? '',
    remark: record.remark ?? '',
  }
}

function mapTask(task: AITaskDTO): AITask {
  return {
    id: task.id,
    type: normalizeTaskType(task.type),
    title: task.title,
    summary: task.summary,
    status: task.status,
    priority: task.priority,
    riskLevel: task.riskLevel,
    assignee: (task.assigneeRole ?? task.assigneeName ?? 'AI 员工') as AIAssignee,
    sourceType: task.sourceType,
    sourceId: task.sourceId,
    sourceName: task.sourceName,
    dueAt: task.dueAt ?? task.updatedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    recommendation: task.recommendation,
    evidence: Array.isArray(task.metadata.evidence)
      ? task.metadata.evidence
          .map((item) =>
            typeof item === 'string'
              ? item
              : typeof item === 'object' && item && 'label' in item
                ? String(item.label)
                : null,
          )
          .filter((item): item is string => Boolean(item))
      : undefined,
      requiresApproval: task.requiresApproval,
      reminderCount: typeof task.metadata.slaReminderCount === 'number' ? task.metadata.slaReminderCount : 0,
      slaStatus: task.metadata.slaEscalated === true ? 'escalated' : undefined,
      metadata: task.metadata,
  }
}

function mapApproval(approval: AIApprovalDTO): AIApproval {
  return {
    id: approval.id,
    taskId: approval.taskId,
    title: approval.title,
    reason: approval.reason,
    status: approval.status,
    riskLevel: approval.riskLevel,
    createdAt: approval.createdAt,
    updatedAt: approval.updatedAt,
    comment: approval.comment ?? undefined,
  }
}

function mapEvent(event: AIEventDTO): AIEvent {
  return {
    id: event.id,
    type: event.type,
    title: event.title,
    summary: event.summary,
    priority: event.priority,
    riskLevel: event.riskLevel,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    sourceName: event.sourceName,
    suggestedTaskType:
      event.type === 'low_stock'
        ? 'chemical_purchase'
        : event.type === 'maintenance_overdue'
          ? 'equipment_maintenance'
          : 'equipment_repair',
    createdAt: event.createdAt,
    evidence: event.evidence.map((item) => `${item.label}: ${item.value}`),
    metadata: event.metadata,
  }
}

function normalizeTaskType(type: AITaskDTO['type']): AITask['type'] {
  if (type === 'restock') return 'chemical_purchase'
  if (type === 'maintenance' || type === 'anomaly_review') return 'equipment_maintenance'
  if (type === 'equipment_repair') return 'equipment_repair'
  return type
}

function mapActionToLog(action: AITaskActionDTO): AIActivityLog {
  const actionLabelMap: Record<AITaskActionDTO['actionType'], string> = {
    task_created: '创建任务',
    task_assigned: '重新指派',
    task_status_changed: '更新任务状态',
    task_closed: '关闭任务',
    approval_requested: '发起审批',
    approval_processed: '处理审批',
    sla_reminder_sent: '发送催办',
    task_escalated: '任务升级',
    report_generated: '生成报告',
    report_delivery_requested: '发起报告发送',
    report_delivery_succeeded: '报告发送成功',
    report_delivery_failed: '报告发送失败',
    memory_upserted: '写入记忆',
  }
  const actorType = action.actor.type === 'agent' ? 'ai' : action.actor.type === 'user' ? 'user' : 'system'

  return {
    id: action.id,
    timestamp: action.createdAt,
    action: actionLabelMap[action.actionType],
    detail: action.detail,
    actorType,
    actorName: action.actor.name,
    taskId: action.taskId ?? undefined,
    approvalId: action.approvalId ?? undefined,
  }
}

function buildReportSections(report: AIReportDTO): AIReport['sections'] {
  const sections = Array.isArray(report.metadata.sections) ? report.metadata.sections : []
  const metadataSections = sections
    .map((section) => {
      if (!section || typeof section !== 'object') return null
      const item = section as { title?: unknown; content?: unknown }
      return {
        title: String(item.title ?? '章节'),
        content: String(item.content ?? ''),
      }
    })
    .filter((section): section is NonNullable<typeof section> => Boolean(section))

  if (metadataSections.length > 0) {
    return metadataSections
  }

  return [
    { title: '摘要', content: report.summary },
    { title: '重点条目', content: report.highlights.join('；') },
  ]
}

function mapReport(report: AIReportDTO): AIReport {
  return {
    id: report.id,
    type: report.type,
    title: report.title,
    createdAt: report.createdAt,
      summary: report.summary,
      highlights: report.highlights,
      sections: buildReportSections(report),
      metadata: report.metadata,
    }
  }

function mapDeliveryMapping(mapping: {
  id: string
  scopeType: 'lab' | 'department' | 'global'
  scopeId: string | null
  scopeName: string
  recipientName: string
  recipientEmail: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}): SupervisorEmailMapping {
  return { ...mapping }
}

function mapDeliveryConfig(config: {
  id: string
  reportType: AIReport['type']
  scopeType: 'lab' | 'department' | 'global'
  scopeId: string | null
  scopeName: string
  channel: 'email'
  enabled: boolean
  createdAt: string
  updatedAt: string
}): ReportDeliveryConfig {
  return { ...config }
}

function mapDeliveryRecord(record: {
  id: string
  reportId: string
  reportTitle: string
  reportType: AIReport['type']
  recipientName: string
  recipientEmail: string
  channel: 'email'
  status: 'success' | 'failed'
  errorMessage: string | null
  triggeredBy: { id: string; name: string; type: 'system' | 'user' | 'agent' | 'tool' }
  triggerMode: 'manual' | 'auto'
  sentAt: string
  createdAt: string
}): ReportDeliveryRecord {
  return { ...record }
}

function buildTaskTransition(task: AITask, nextStatus: AITaskStatus): TaskTransitionName | null {
  if (task.status === nextStatus) return null
  if (task.status === 'open' && nextStatus === 'in_progress') return 'start_progress'
  if (task.status === 'in_progress' && nextStatus === 'pending_approval') return 'request_approval'
  if (task.status === 'pending_approval' && nextStatus === 'open') return 'resume_after_info'
  if (task.status === 'pending_approval' && nextStatus === 'in_progress') return 'approve_completion'
  if (task.status === 'in_progress' && nextStatus === 'done') return 'complete'
  if (task.status === 'done' && nextStatus === 'closed') return 'close'
  if (task.status === 'closed' && nextStatus === 'open') return 'reopen'
  return null
}

function buildApprovalDecision(status: AIApproval['status']): ApprovalDecision {
  if (status === 'approved') return 'approve'
  if (status === 'rejected') return 'reject'
  return 'request_info'
}

async function buildActivityLogs(tasks: AITaskDTO[]): Promise<AIActivityLog[]> {
  const actionGroups = await Promise.all(tasks.map((task) => gateway.getTaskActions(task.id)))
  const logs = actionGroups.flatMap((actions) => actions.map(mapActionToLog))
  const uniqueLogs = new Map<string, AIActivityLog>()
  logs.forEach((log) => uniqueLogs.set(log.id, log))
  return [...uniqueLogs.values()].sort((left, right) => right.timestamp.localeCompare(left.timestamp))
}

export interface LiveAIStateSnapshot {
  events: AIEvent[]
  tasks: AITask[]
  approvals: AIApproval[]
  reports: AIReport[]
  activityLogs: AIActivityLog[]
  reportDeliveryMappings: SupervisorEmailMapping[]
  reportDeliveryConfigs: ReportDeliveryConfig[]
  reportDeliveryRecords: ReportDeliveryRecord[]
}

async function readLiveAIState(): Promise<LiveAIStateSnapshot> {
  const settings = await gateway.getSettings()
  const [taskDTOs, approvalDTOs, reportDTOs, eventDTOs, mappings, configs, records] = await Promise.all([
    gateway.listTasks(),
    gateway.listApprovals(),
    gateway.listReports(),
    gateway.inspectRuleEvents(new Date().toISOString(), settings.thresholds.maintenanceOverdueDays),
    gateway.listReportDeliveryMappings(),
    gateway.listReportDeliveryConfigs(),
    gateway.listReportDeliveryRecords(),
  ])

  return {
    events: eventDTOs.map(mapEvent).sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    tasks: taskDTOs.map(mapTask),
    approvals: approvalDTOs.map(mapApproval),
    reports: reportDTOs.map(mapReport),
    activityLogs: await buildActivityLogs(taskDTOs),
    reportDeliveryMappings: mappings.map(mapDeliveryMapping),
    reportDeliveryConfigs: configs.map(mapDeliveryConfig),
    reportDeliveryRecords: records.map(mapDeliveryRecord),
  }
}

export const aiAppClient = {
  async getSettings() {
    return await gateway.getSettings()
  },
  async updateSettings(patch: Partial<AISettings>) {
    return await gateway.updateSettings(patch)
  },
  async listChemicals(options?: InventoryListOptions) {
    return (await gateway.listChemicals(options)).map(mapChemical)
  },
  async deleteChemical(chemicalId: string) {
    await gateway.deleteChemical(chemicalId)
  },
  async listEquipment(options?: InventoryListOptions) {
    return (await gateway.listEquipment(options)).map(mapEquipment)
  },
  async deleteEquipment(equipmentId: string) {
    await gateway.deleteEquipment(equipmentId)
  },
  async listImportBatches(entityType?: 'chemical' | 'equipment') {
    return (await gateway.listImportBatches(entityType ? { entityType } : undefined)).map(mapBatch)
  },
  async importChemicals(rows: ChemicalImportRecord[], source: 'manual' | 'excel', fileName: string | null, importedBy: string) {
    const response = await gateway.importChemicals(rows, source, fileName, importedBy)
    return {
      batch: mapBatch(response.batch),
      records: response.records.map(mapChemical),
    }
  },
  async importEquipment(rows: EquipmentImportRecord[], source: 'manual' | 'excel', fileName: string | null, importedBy: string) {
    const response = await gateway.importEquipment(rows, source, fileName, importedBy)
    return {
      batch: mapBatch(response.batch),
      records: response.records.map(mapEquipment),
    }
  },
  async createInventoryOperation(operation: {
    entityType: 'chemical' | 'equipment'
    entityId: string
    operationType: 'inbound' | 'outbound'
    quantity: number
    unit: string
    operator: { id: string; name: string; type: string }
    reason: string
    operationDate?: string
    metadata: Record<string, unknown>
  }) {
    return await gateway.createInventoryOperation(operation)
  },
  async listInventoryTransactions(filters?: {
    entityType?: 'chemical' | 'equipment'
    operationType?: 'inbound' | 'outbound'
    entityId?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  }) {
    return await gateway.listInventoryTransactions(filters)
  },
  async getAIState() {
    return await readLiveAIState()
  },
  async exportReportPdf(reportId: string) {
    return await gateway.exportReportPdf(reportId)
  },
  async deleteReport(reportId: string) {
    await gateway.deleteReport(reportId)
  },
  async createTaskFromEvent(eventId: string) {
    return await gateway.executeRuleEvent(eventId, getCurrentActor())
  },
  async prepareAutoPurchase(taskId: string) {
    return await gateway.prepareAutoPurchase(taskId, getCurrentActor())
  },
  async confirmCompletionReport(taskId: string, report: CompletionReportInput) {
    await gateway.confirmCompletionReport(taskId, report, getCurrentActor())
  },
  async assignTask(taskId: string, assignee: AIAssignee) {
    const roleIdMap: Record<AIAssignee, string> = {
      库管: 'warehouse-manager',
      采购: 'buyer',
      设备管理员: 'equipment-manager',
      实验室管理员: 'lab-manager',
      'AI 员工': 'ai-operator',
    }

    await gateway.assignTask(taskId, roleIdMap[assignee], assignee, assignee, getCurrentActor())
  },
  async updateTaskStatus(task: AITask, nextStatus: AITaskStatus) {
    const transition = buildTaskTransition(task, nextStatus)
    if (!transition) return
    await gateway.updateTaskStatus(task.id, transition, `Frontend updated task to ${nextStatus}.`, getCurrentActor())
  },
  async createApprovalForTask(task: AITask) {
    const existingPending = (await readLiveAIState()).approvals.find(
      (approval) => approval.taskId === task.id && approval.status === 'pending',
    )
    if (existingPending) return existingPending.id
    return await gateway.createApprovalForTask(task.id, `${task.title} 审批`, task.recommendation, task.riskLevel, getCurrentActor())
  },
  async resolveApproval(approvalId: string, status: AIApproval['status'], comment?: string) {
    await gateway.processApproval(
      approvalId,
      buildApprovalDecision(status),
      comment?.trim() || 'Frontend approval decision.',
      getCurrentActor(),
    )
  },
  async generateReport(type: AIReport['type']) {
    const actor = getCurrentActor()
    const response = await gateway.generateReport(type, new Date().toISOString())
    if (
      response?.report?.id &&
      !response.deliveryRecords?.some(record => record.status === 'success')
    ) {
      await gateway.sendReport(response.report.id, actor)
    }
  },
  async saveReportDeliveryMapping(
    input: Omit<SupervisorEmailMapping, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ) {
    return mapDeliveryMapping(await gateway.saveReportDeliveryMapping(input, id))
  },
  async saveReportDeliveryConfig(
    input: Omit<ReportDeliveryConfig, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ) {
    return mapDeliveryConfig(await gateway.saveReportDeliveryConfig(input, id))
  },
  async sendReport(reportId: string) {
    return (await gateway.sendReport(reportId, getCurrentActor())).map(mapDeliveryRecord)
  },
  async getAnalysisSummary(windowDays = 30) {
    return await gateway.getAnalysisSummary(windowDays)
  },
}
