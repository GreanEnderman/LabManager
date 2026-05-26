import type {
  AIApprovalDTO,
  AIEventDTO,
  AIReportDTO,
  ReportDeliveryConfigDTO,
  ReportDeliveryRecordDTO,
  SupervisorEmailMappingDTO,
  AITaskActionDTO,
  AITaskDTO,
  ChemicalInventoryDTO,
  EquipmentAssetDTO,
  ImportBatchDTO,
} from '../../../backend/src/contracts/shared'
import type { ApprovalDecision } from '../../../backend/src/domain/approval-state-machine'
import type { TaskTransitionName } from '../../../backend/src/domain/task-state-machine'
import type { AIAnalysisSummary, AISettings } from '../ai/types'
import type { ChemicalImportRecord, EquipmentImportRecord } from '../imports/types'

export interface GatewayActor {
  id: string
  name: string
  type: 'user'
}

export interface GenerateReportResponseDTO {
  report?: AIReportDTO
  deliveryRecords?: ReportDeliveryRecordDTO[]
  deliveryStatus?: 'success' | 'failed'
}

export interface GatewayRuleEventInput {
  id: string
  name: string
  totalQuantity?: number
  threshold?: number
  status?: string
  lastMaintenanceAt?: string | null
}

export interface ImportBatchFilters {
  entityType?: 'chemical' | 'equipment'
}

export interface InventoryOperationInput {
  entityType: 'chemical' | 'equipment'
  entityId: string
  operationType: 'inbound' | 'outbound'
  quantity: number
  unit: string
  operator: { id: string; name: string; type: string }
  reason: string
  metadata: Record<string, unknown>
}

export interface CompletionReportInput {
  reportTitle: string
  reportFileName?: string | null
  reportContentType?: string | null
  reportStorageUrl?: string | null
  engineerName?: string | null
  description?: string | null
  result?: 'completed' | 'needs_follow_up' | 'failed'
  nextMaintenanceAt?: string | null
  metadata?: Record<string, unknown>
}

export interface InventoryTransactionFilters {
  entityType?: 'chemical' | 'equipment'
  operationType?: 'inbound' | 'outbound'
  entityId?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

export interface InventoryTransaction {
  id: string
  date: string
  name: string
  type: string
  quantity: string
  unit: string
  operator: string
  reason: string
}

export interface AIGateway {
  getSettings(): Promise<AISettings>
  updateSettings(patch: Partial<AISettings>): Promise<AISettings>
  listChemicals(): Promise<ChemicalInventoryDTO[]>
  deleteChemical(chemicalId: string): Promise<void>
  listEquipment(): Promise<EquipmentAssetDTO[]>
  deleteEquipment(equipmentId: string): Promise<void>
  listImportBatches(filters?: ImportBatchFilters): Promise<ImportBatchDTO[]>
  importChemicals(
    rows: ChemicalImportRecord[],
    source: 'manual' | 'excel',
    fileName: string | null,
    importedBy: string,
  ): Promise<{
    batch: ImportBatchDTO
    records: ChemicalInventoryDTO[]
  }>
  importEquipment(
    rows: EquipmentImportRecord[],
    source: 'manual' | 'excel',
    fileName: string | null,
    importedBy: string,
  ): Promise<{
    batch: ImportBatchDTO
    records: EquipmentAssetDTO[]
  }>
  createInventoryOperation(operation: InventoryOperationInput): Promise<unknown>
  listInventoryTransactions(filters?: InventoryTransactionFilters): Promise<InventoryTransaction[]>
  inspectRuleEvents(now: string, maintenanceOverdueDays: number): Promise<AIEventDTO[]>
  listTasks(): Promise<AITaskDTO[]>
  getTaskActions(taskId: string): Promise<AITaskActionDTO[]>
  listApprovals(): Promise<AIApprovalDTO[]>
  listReports(): Promise<AIReportDTO[]>
  deleteReport(reportId: string): Promise<void>
  exportReportPdf(reportId: string): Promise<{
    fileName: string
    mimeType: 'application/pdf'
    contentBase64: string
  }>
  listReportDeliveryMappings(): Promise<SupervisorEmailMappingDTO[]>
  saveReportDeliveryMapping(input: Omit<SupervisorEmailMappingDTO, 'id' | 'createdAt' | 'updatedAt'>, id?: string): Promise<SupervisorEmailMappingDTO>
  listReportDeliveryConfigs(): Promise<ReportDeliveryConfigDTO[]>
  saveReportDeliveryConfig(input: Omit<ReportDeliveryConfigDTO, 'id' | 'createdAt' | 'updatedAt'>, id?: string): Promise<ReportDeliveryConfigDTO>
  listReportDeliveryRecords(): Promise<ReportDeliveryRecordDTO[]>
  sendReport(reportId: string, actor: GatewayActor): Promise<ReportDeliveryRecordDTO[]>
  getAnalysisSummary(windowDays?: number): Promise<AIAnalysisSummary>
  executeRuleEvent(eventId: string, actor: GatewayActor): Promise<string>
  prepareAutoPurchase(taskId: string, actor: GatewayActor): Promise<{
    status: 'reserved' | 'submitted'
    message: string
    taskId: string
    purchaseRequestId: string | null
  }>
  confirmCompletionReport(taskId: string, report: CompletionReportInput, actor: GatewayActor): Promise<void>
  assignTask(taskId: string, assigneeId: string, assigneeName: string, assigneeRole: string, actor: GatewayActor): Promise<void>
  updateTaskStatus(taskId: string, transition: TaskTransitionName, detail: string, actor: GatewayActor): Promise<void>
  createApprovalForTask(taskId: string, title: string, reason: string, riskLevel: AIApprovalDTO['riskLevel'], actor: GatewayActor): Promise<string>
  processApproval(approvalId: string, decision: ApprovalDecision, comment: string, actor: GatewayActor): Promise<void>
  generateReport(type: AIReportDTO['type'], now: string): Promise<GenerateReportResponseDTO | void>
}
