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
import { createAIApplicationServices, type AIApplicationServices } from '../../../backend/src'
import type {
  AIApprovalDTO,
  AIEventDTO,
  AIReportDTO,
  AITaskActionDTO,
  AITaskDTO,
} from '../../../backend/src/contracts/shared'
import type { ApprovalDecision } from '../../../backend/src/domain/approval-state-machine'
import type { TaskTransitionName } from '../../../backend/src/domain/task-state-machine'
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

let cachedServices: AIApplicationServices | null = null

function getServices() {
  if (!cachedServices) {
    cachedServices = createAIApplicationServices()
  }

  return cachedServices
}

function getCurrentActor() {
  return {
    id: 'frontend-user',
    name: '前端联调',
    type: 'user' as const,
  }
}

function mapSettings() {
  const settings = getServices().getSystemSettings()
  return {
    thresholds: settings.thresholds,
    approvalStrategy: settings.approvalStrategy,
    sla: settings.sla,
    emailDelivery: {
      smtpHost: null,
      smtpPort: 587,
      smtpUser: null,
      smtpPassword: null,
      smtpFrom: null,
      smtpUseSsl: false,
      supervisorReportBaseUrl: null,
      passwordConfigured: false,
    },
    updatedAt: settings.updatedAt,
  } satisfies AISettings
}

function mapImportErrors(errors: Array<{
  rowNumber: number
  field: string
  code: string
  message: string
  rawValue: unknown
}>): ImportErrorItem[] {
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
  labName: string | null
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
    threshold: record.threshold,
    status: record.status,
    labName: record.labName ?? '',
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

  const actorType =
    action.actor.type === 'agent' ? 'ai' : action.actor.type === 'user' ? 'user' : 'system'

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
  return [
    {
      title: '摘要',
      content: report.summary,
    },
    {
      title: '重点条目',
      content: report.highlights.join('；'),
    },
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

function buildTaskTransition(task: AITask, nextStatus: AITaskStatus): TaskTransitionName | null {
  if (task.status === nextStatus) {
    return null
  }

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

function buildRuleEvents() {
  const services = getServices()
  const settings = services.getSystemSettings()

  return services
    .inspectRules({
      input: {
        chemicals: services.listChemicals().map((chemical) => ({
          id: chemical.id,
          name: chemical.name,
          totalQuantity: chemical.currentQuantity,
          threshold: chemical.threshold,
        })),
        equipment: services.listEquipment().map((equipment) => ({
          id: equipment.id,
          name: equipment.name,
          status: equipment.status,
          lastMaintenanceAt: equipment.lastMaintenanceAt,
        })),
      },
      config: {
        now: new Date().toISOString(),
        maintenanceOverdueDays: settings.thresholds.maintenanceOverdueDays,
      },
    })
    .items.map((item) => item.event)
}

function buildActivityLogs(tasks: AITaskDTO[]): AIActivityLog[] {
  const logs = tasks.flatMap((task) => getServices().getTaskDetail(task.id).actions.map(mapActionToLog))
  const uniqueLogs = new Map<string, AIActivityLog>()
  logs.forEach((log) => {
    uniqueLogs.set(log.id, log)
  })
  return [...uniqueLogs.values()].sort((left, right) => right.timestamp.localeCompare(left.timestamp))
}

export interface LiveAIStateSnapshot {
  events: AIEvent[]
  tasks: AITask[]
  approvals: AIApproval[]
  reports: AIReport[]
  activityLogs: AIActivityLog[]
}

function readLiveAIState(): LiveAIStateSnapshot {
  const services = getServices()
  const taskDTOs = services.listTasks()
  const approvalDTOs = services.listApprovals()
  const reportDTOs = services.listReports()
  const eventDTOs = buildRuleEvents()

  return {
    events: eventDTOs.map(mapEvent).sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    tasks: taskDTOs.map(mapTask),
    approvals: approvalDTOs.map(mapApproval),
    reports: reportDTOs.map(mapReport),
    activityLogs: buildActivityLogs(taskDTOs),
  }
}

export const aiAppClient = {
  getSettings() {
    return mapSettings()
  },
  updateSettings(patch: Partial<AISettings>) {
    const response = getServices().updateSystemSettings({
      thresholds: patch.thresholds,
      approvalStrategy: patch.approvalStrategy,
      sla: patch.sla,
    })

    return {
      thresholds: response.settings.thresholds,
      approvalStrategy: response.settings.approvalStrategy,
      sla: response.settings.sla,
      emailDelivery: patch.emailDelivery ?? {
        smtpHost: null,
        smtpPort: 587,
        smtpUser: null,
        smtpPassword: null,
        smtpFrom: null,
        smtpUseSsl: false,
        supervisorReportBaseUrl: null,
        passwordConfigured: false,
      },
      updatedAt: response.settings.updatedAt,
    } satisfies AISettings
  },
  listChemicals() {
    return getServices().listChemicals().map(mapChemical)
  },
  listEquipment() {
    return getServices().listEquipment().map(mapEquipment)
  },
  listImportBatches(entityType?: 'chemical' | 'equipment') {
    return getServices().listImportBatches(entityType ? { entityType } : undefined).map((batch) => mapBatch(batch))
  },
  importChemicals(rows: ChemicalImportRecord[], source: 'manual' | 'excel', fileName: string | null, importedBy: string) {
    const response = getServices().importChemicals({
      source,
      fileName,
      importedBy: {
        id: importedBy,
        name: importedBy,
        type: 'user',
      },
      rows: rows.map((row) => ({
          recordId: row.id,
          name: row.name,
          casNumber: row.casNumber || null,
          category: row.category,
        spec: row.spec,
        currentQuantity: row.currentQuantity,
        threshold: row.threshold,
        status: row.status,
        labName: row.labName,
        ownerName: row.ownerName,
        updatedAt: row.updatedAt || null,
        imageDataUrl: row.imageDataUrl || null,
        remark: row.remark,
      })),
    })

    return {
      batch: mapBatch(response.batch),
      records: response.records.map(mapChemical),
    }
  },
  importEquipment(rows: EquipmentImportRecord[], source: 'manual' | 'excel', fileName: string | null, importedBy: string) {
    const response = getServices().importEquipment({
      source,
      fileName,
      importedBy: {
        id: importedBy,
        name: importedBy,
        type: 'user',
      },
      rows: rows.map((row) => ({
        recordId: row.id,
        name: row.name,
        vendor: row.vendor,
        model: row.model,
        status: row.status,
        labName: row.labName,
        ownerName: row.ownerName,
        lastMaintenanceAt: row.lastMaintenanceAt || null,
        updatedAt: row.updatedAt || null,
        imageDataUrl: row.imageDataUrl || null,
        remark: row.remark,
      })),
    })

    return {
      batch: mapBatch(response.batch),
      records: response.records.map(mapEquipment),
    }
  },
  getAIState() {
    return readLiveAIState()
  },
  async createTaskFromEvent(eventId: string) {
    const event = buildRuleEvents().find((item) => item.id === eventId)
    if (!event) return ''

    const response = await getServices().executeRuleEvent({
      runId: `frontend-run-${event.id}`,
      actor: getCurrentActor(),
      event,
    })

    return response.state.output?.taskId ?? response.state.context.existingOpenTask?.id ?? ''
  },
  assignTask(taskId: string, assignee: AIAssignee) {
    const roleIdMap: Record<AIAssignee, string> = {
      库管: 'warehouse-manager',
      采购: 'buyer',
      设备管理员: 'equipment-manager',
      实验室管理员: 'lab-manager',
      'AI 员工': 'ai-operator',
    }

    getServices().assignTask(
      taskId,
      {
        assigneeId: roleIdMap[assignee],
        assigneeName: assignee,
        assigneeRole: assignee,
      },
      getCurrentActor(),
    )
  },
  updateTaskStatus(task: AITask, nextStatus: AITaskStatus) {
    const transition = buildTaskTransition(task, nextStatus)
    if (!transition) return

    getServices().updateTaskStatus(
      task.id,
      {
        transition,
        detail: `Frontend updated task to ${nextStatus}.`,
      },
      getCurrentActor(),
    )
  },
  createApprovalForTask(task: AITask) {
    const existingPending = getServices().listApprovals({ status: 'pending' }).find((approval) => approval.taskId === task.id)
    if (existingPending) return existingPending.id

    const taskDetail = getServices().getTaskDetail(task.id)
    if (taskDetail.task.status !== 'pending_approval') {
      getServices().updateTaskStatus(
        task.id,
        {
          transition: 'request_approval',
          detail: 'Frontend requested approval.',
        },
        getCurrentActor(),
      )
    }

    const approval = getServices().createApproval(
      {
        taskId: task.id,
        title: `${task.title} 审批`,
        reason: task.recommendation,
        riskLevel: task.riskLevel,
      },
      getCurrentActor(),
    )

    return approval.approval.id
  },
  resolveApproval(approvalId: string, status: AIApproval['status'], comment?: string) {
    getServices().processApproval(
      approvalId,
      {
        decision: buildApprovalDecision(status),
        comment: comment?.trim() || 'Frontend approval decision.',
      },
      getCurrentActor(),
    )
  },
  async generateReport(type: AIReport['type']) {
    await getServices().generateReport({
      type,
      now: new Date().toISOString(),
    })
  },
}
