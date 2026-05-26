import type {
  ApiEnvelope,
  AIApprovalDTO,
  AIEventDTO,
  AIReportDTO,
  LoginResponse,
  ReportDeliveryConfigDTO,
  ReportDeliveryRecordDTO,
  SupervisorEmailMappingDTO,
  AITaskActionDTO,
  AITaskDTO,
  ChemicalInventoryDTO,
  EquipmentAssetDTO,
  ImportBatchDTO,
} from '../../../backend/src/contracts/shared'
import type { AIGateway, CompletionReportInput, GatewayActor, ImportBatchFilters } from './aiGateway'
import type { InventoryTransaction } from './aiGateway'
import type { AIAnalysisSummary, AISettings } from '../ai/types'
import type { ChemicalImportRecord, EquipmentImportRecord } from '../imports/types'
import type { ApprovalDecision } from '../../../backend/src/domain/approval-state-machine'
import type { TaskTransitionName } from '../../../backend/src/domain/task-state-machine'
import { getAuthErrorMessage, getAuthInvalidationReason } from './httpErrorPresentation'
import {
  markHttpAuthInvalidated,
  readHttpAuthInvalidationReason,
  readHttpAuthToken,
  resetHttpAuthInvalidation,
  writeHttpAuthSession,
} from './httpAuthSession'

class HttpRequestError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'HttpRequestError'
    this.status = status
    this.code = code
  }
}

function getBaseUrl() {
  return import.meta.env.VITE_AI_API_BASE_URL?.trim() || '/api/ai'
}

function withQuery(path: string, query?: Record<string, string | undefined>) {
  if (!query) return path
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  const suffix = search.toString()
  return suffix ? `${path}?${suffix}` : path
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const authorization = await getAuthorizationHeader()
  const response = await fetch(`${getBaseUrl()}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    let message = `HTTP ${response.status} when requesting ${path}.`
    let code = 'http_error'

    try {
      const payload = (await response.json()) as ApiEnvelope<null>
      if (payload.error?.code) {
        code = payload.error.code
      }
      if (payload.error?.message) {
        message = payload.error.message
      }
    } catch {
      // Ignore malformed error payloads and keep the fallback message.
    }

    const invalidationReason = getAuthInvalidationReason(response.status, path)
    if (invalidationReason) {
      markHttpAuthInvalidated(invalidationReason)
    }

    throw new HttpRequestError(response.status, code, getAuthErrorMessage(response.status, code, message))
  }

  const payload = (await response.json()) as ApiEnvelope<T>
  return payload.data
}

async function getAuthorizationHeader() {
  let token = readHttpAuthToken()

  if (!token && !readHttpAuthInvalidationReason()) {
    token = await loginWithBootstrapUser()
  }

  return token ? `Bearer ${token}` : undefined
}

async function loginWithBootstrapUser() {
  const username = import.meta.env.VITE_AI_HTTP_USERNAME?.trim()
  const password = import.meta.env.VITE_AI_HTTP_PASSWORD?.trim()

  if (!username || !password) {
    return null
  }

  const response = await fetch(`${getBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
    }),
  })

  if (!response.ok) {
    const invalidationReason = getAuthInvalidationReason(response.status, '/auth/login')
    if (invalidationReason) {
      markHttpAuthInvalidated(invalidationReason)
    }

    throw new HttpRequestError(
      response.status,
      'login_failed',
      getAuthErrorMessage(response.status, 'login_failed', 'HTTP authentication bootstrap failed.'),
    )
  }

  const payload = (await response.json()) as ApiEnvelope<LoginResponse>
  resetHttpAuthInvalidation()
  writeHttpAuthSession(payload.data.token, payload.data.user)
  return payload.data.token
}

export const httpAiGateway: AIGateway = {
  async getSettings() {
    return requestJson<AISettings>('/settings')
  },
  async updateSettings(patch: Partial<AISettings>) {
    const response = await requestJson<{ settings: AISettings }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    return response.settings
  },
  async listChemicals() {
    return requestJson<ChemicalInventoryDTO[]>('/chemicals')
  },
  async deleteChemical(chemicalId: string) {
    await requestJson<{ deletedChemicalId: string }>(`/chemicals/${encodeURIComponent(chemicalId)}`, {
      method: 'DELETE',
    })
  },
  async listEquipment() {
    return requestJson<EquipmentAssetDTO[]>('/equipment')
  },
  async deleteEquipment(equipmentId: string) {
    await requestJson<{ deletedEquipmentId: string }>(`/equipment/${encodeURIComponent(equipmentId)}`, {
      method: 'DELETE',
    })
  },
  async listImportBatches(filters?: ImportBatchFilters) {
    return requestJson<ImportBatchDTO[]>(
      withQuery('/import-batches', filters as Record<string, string | undefined> | undefined),
    )
  },
  async importChemicals(rows: ChemicalImportRecord[], source: 'manual' | 'excel', fileName: string | null, importedBy: string) {
    return requestJson<{ batch: ImportBatchDTO; records: ChemicalInventoryDTO[] }>('/imports/chemicals', {
      method: 'POST',
      body: JSON.stringify({
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
      }),
    })
  },
  async importEquipment(rows: EquipmentImportRecord[], source: 'manual' | 'excel', fileName: string | null, importedBy: string) {
    return requestJson<{ batch: ImportBatchDTO; records: EquipmentAssetDTO[] }>('/imports/equipment', {
      method: 'POST',
      body: JSON.stringify({
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
      }),
    })
  },
  async createInventoryOperation(operation: {
    entityType: 'chemical' | 'equipment'
    entityId: string
    operationType: 'inbound' | 'outbound'
    quantity: number
    unit: string
    operator: { id: string; name: string; type: string }
    reason: string
    metadata: Record<string, any>
  }) {
    return requestJson<{
      operation: {
        id: string
        entityType: string
        entityId: string
        entityName: string
        operationType: string
        quantity: number
        unit: string
        operatorName: string
        reason: string | null
        operationDate: string
        metadata: Record<string, any>
      }
      updatedEntity: {
        id: string
        currentQuantity: number
        previousQuantity: number
      }
    }>('/inventory/operations', {
      method: 'POST',
      body: JSON.stringify({
        entityType: operation.entityType,
        entityId: operation.entityId,
        operationType: operation.operationType,
        quantity: operation.quantity,
        unit: operation.unit,
        operator: operation.operator,
        reason: operation.reason,
        metadata: operation.metadata,
      }),
    })
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
    return requestJson<InventoryTransaction[]>(
      withQuery('/inventory/transactions', {
        entity_type: filters?.entityType,
        operation_type: filters?.operationType,
        entity_id: filters?.entityId,
        start_date: filters?.startDate,
        end_date: filters?.endDate,
        limit: filters?.limit?.toString(),
        offset: filters?.offset?.toString(),
      }),
    )
  },
  async inspectRuleEvents(now: string, maintenanceOverdueDays: number): Promise<AIEventDTO[]> {
    const [chemicals, equipment] = await Promise.all([this.listChemicals(), this.listEquipment()])
    const response = await requestJson<{ items: Array<{ event: AIEventDTO }> }>('/rules/inspect', {
      method: 'POST',
      body: JSON.stringify({
        input: {
          chemicals: chemicals.map((chemical) => ({
            id: chemical.id,
            name: chemical.name,
            totalQuantity: chemical.currentQuantity,
            threshold: chemical.threshold,
          })),
          equipment: equipment.map((item) => ({
            id: item.id,
            name: item.name,
            status: item.status,
            lastMaintenanceAt: item.lastMaintenanceAt,
          })),
        },
        config: {
          now,
          maintenanceOverdueDays,
        },
      }),
    })
    return response.items.map((item) => item.event)
  },
  async listTasks() {
    return requestJson<AITaskDTO[]>('/tasks')
  },
  async getTaskActions(taskId: string) {
    const response = await requestJson<{ task: AITaskDTO; approval: AIApprovalDTO | null; actions: AITaskActionDTO[] }>(`/tasks/${taskId}`)
    return response.actions
  },
  async listApprovals() {
    return requestJson<AIApprovalDTO[]>('/approvals')
  },
  async listReports() {
    return requestJson<AIReportDTO[]>('/reports')
  },
  async deleteReport(reportId: string) {
    await requestJson<{ deletedReportId: string }>(`/reports/${reportId}`, {
      method: 'DELETE',
    })
  },
  async exportReportPdf(reportId: string) {
    return requestJson<{ fileName: string; mimeType: 'application/pdf'; contentBase64: string }>(`/reports/${reportId}/pdf`)
  },
  async listReportDeliveryMappings() {
    return requestJson<SupervisorEmailMappingDTO[]>('/report-delivery/mappings')
  },
  async saveReportDeliveryMapping(input, id) {
    return requestJson<SupervisorEmailMappingDTO>(id ? `/report-delivery/mappings/${id}` : '/report-delivery/mappings', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(input),
    })
  },
  async listReportDeliveryConfigs() {
    return requestJson<ReportDeliveryConfigDTO[]>('/report-delivery/configs')
  },
  async saveReportDeliveryConfig(input, id) {
    return requestJson<ReportDeliveryConfigDTO>(id ? `/report-delivery/configs/${id}` : '/report-delivery/configs', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(input),
    })
  },
  async listReportDeliveryRecords() {
    return requestJson<ReportDeliveryRecordDTO[]>('/report-delivery/records')
  },
  async sendReport(reportId: string, actor: GatewayActor) {
    const response = await requestJson<{ records: ReportDeliveryRecordDTO[] }>('/report-delivery/send', {
      method: 'POST',
      body: JSON.stringify({ reportId, actor }),
    })
    return response.records
  },
  async getAnalysisSummary(windowDays = 30) {
    return requestJson<AIAnalysisSummary>(withQuery('/analysis/summary', { windowDays: String(windowDays) }))
  },
  async executeRuleEvent(eventId: string, actor: GatewayActor) {
    const settings = await this.getSettings()
    const event = (await this.inspectRuleEvents(new Date().toISOString(), settings.thresholds.maintenanceOverdueDays)).find((item) => item.id === eventId)
    if (!event) return ''
    const response = await requestJson<{ state: { output?: { taskId?: string }; context: { existingOpenTask?: { id: string } | null } } }>('/rules/execute', {
      method: 'POST',
      body: JSON.stringify({
        runId: `frontend-run-${eventId}`,
        actor,
        event,
      }),
    })
    return response.state.output?.taskId ?? response.state.context.existingOpenTask?.id ?? ''
  },
  async prepareAutoPurchase(taskId: string, actor: GatewayActor) {
    return requestJson<{
      status: 'reserved' | 'submitted'
      message: string
      taskId: string
      purchaseRequestId: string | null
    }>(`/tasks/${taskId}/auto-purchase/prepare`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    })
  },
  async confirmCompletionReport(taskId: string, report: CompletionReportInput, actor: GatewayActor) {
    await requestJson(`/tasks/${taskId}/completion-report`, {
      method: 'POST',
      body: JSON.stringify({ ...report, actor }),
    })
  },
  async assignTask(taskId: string, assigneeId: string, assigneeName: string, assigneeRole: string, actor: GatewayActor) {
    await requestJson(`/tasks/${taskId}/assignee`, {
      method: 'PATCH',
      body: JSON.stringify({ assigneeId, assigneeName, assigneeRole, actor }),
    })
  },
  async updateTaskStatus(taskId: string, transition: TaskTransitionName, detail: string, actor: GatewayActor) {
    await requestJson(`/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ transition, detail, actor }),
    })
  },
  async createApprovalForTask(
    taskId: string,
    title: string,
    reason: string,
    riskLevel: AIApprovalDTO['riskLevel'],
    actor: GatewayActor,
  ) {
    const detail = await requestJson<{ task: AITaskDTO; approval: AIApprovalDTO | null; actions: AITaskActionDTO[] }>(`/tasks/${taskId}`)
    if (detail.task.status !== 'pending_approval') {
      await this.updateTaskStatus(taskId, 'request_approval', 'Frontend requested approval.', actor)
    }
    const response = await requestJson<{ approval: AIApprovalDTO }>('/approvals', {
      method: 'POST',
      body: JSON.stringify({ taskId, title, reason, riskLevel, actor }),
    })
    return response.approval.id
  },
  async processApproval(approvalId: string, decision: ApprovalDecision, comment: string, actor: GatewayActor) {
    await requestJson(`/approvals/${approvalId}/process`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, comment, actor }),
    })
  },
  async generateReport(type, now: string) {
    return await requestJson('/reports/generate', {
      method: 'POST',
      body: JSON.stringify({ type, now }),
    })
  },
}

export async function probeHttpAiGateway() {
  return requestJson<{
    tasks?: AITaskDTO[]
    approvals?: AIApprovalDTO[]
    reports?: AIReportDTO[]
    chemicals?: ChemicalInventoryDTO[]
    equipment?: EquipmentAssetDTO[]
    importBatches?: ImportBatchDTO[]
  }>('/health')
}
