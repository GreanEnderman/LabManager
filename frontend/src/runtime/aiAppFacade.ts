/**
 * @deprecated Development and testing only - DO NOT USE IN PRODUCTION
 *
 * This file directly imports from the TypeScript backend (backend/src),
 * which violates M-02 migration rule (TS Prototype Backend Freeze).
 *
 * Production code MUST use httpAiGateway via getAiGateway().
 * This file is excluded from TypeScript compilation and should only be
 * used in local development for rapid prototyping.
 *
 * See: docs/frontend-ai-runtime-boundary.md
 */

/* eslint-disable no-restricted-imports */
import type {
  AIApprovalDTO,
  AIEventDTO,
  AIReportDTO,
  AITaskActionDTO,
  AITaskDTO,
} from '../../../backend/src/contracts/shared'
import type { ApprovalDecision } from '../../../backend/src/domain/approval-state-machine'
import type { TaskTransitionName } from '../../../backend/src/domain/task-state-machine'
import type { AIGateway, InventoryListOptions } from './aiGateway'
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
  AISettings,
  AITask,
  AITaskStatus,
} from '../ai/types'

const gateway: AIGateway = getAiGateway()

function getCurrentActor() {
  return {
    id: 'frontend-user',
    name: '前端联调',
    type: 'user' as const,
  }
}

function mapImportErrors(errors: Array<{ rowNumber: number; field: string; code: string; message: string; rawValue: unknown }>): ImportErrorItem[] {
  return errors.map((error) => ({
    rowNumber: error.rowNumber,
    field: error.field,
    code:
      error.code === 'required' || error.code === 'invalid_number' || error.code === 'duplicate_record'
        ? error.code
        : 'required',
    message: error.message,
    rawValue: error.rawValue,
  }))
}

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
  errors: Array<{ rowNumber: number; field: string; code: string; message: string; rawValue: unknown }>
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
    errors: mapImportErrors(batch.errors),
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
  }
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
}

async function readLiveAIState(): Promise<LiveAIStateSnapshot> {
  const settings = await gateway.getSettings()
  const [taskDTOs, approvalDTOs, reportDTOs, eventDTOs] = await Promise.all([
    gateway.listTasks(),
    gateway.listApprovals(),
    gateway.listReports(),
    gateway.inspectRuleEvents(new Date().toISOString(), settings.thresholds.maintenanceOverdueDays),
  ])

  return {
    events: eventDTOs.map(mapEvent).sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    tasks: taskDTOs.map(mapTask),
    approvals: approvalDTOs.map(mapApproval),
    reports: reportDTOs.map(mapReport),
    activityLogs: await buildActivityLogs(taskDTOs),
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
  async listEquipment(options?: InventoryListOptions) {
    return (await gateway.listEquipment(options)).map(mapEquipment)
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
  async getAIState() {
    return await readLiveAIState()
  },
  async createTaskFromEvent(eventId: string) {
    return await gateway.executeRuleEvent(eventId, getCurrentActor())
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
    return gateway.createApprovalForTask(task.id, `${task.title} 审批`, task.recommendation, task.riskLevel, getCurrentActor())
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
    await gateway.generateReport(type, new Date().toISOString())
  },
}
