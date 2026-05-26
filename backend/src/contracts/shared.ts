import type {
  AIActionType,
  AIApprovalStatus,
  AuditActor,
  AIEventType,
  AIEvidenceItem,
  AIPriority,
  AIReportType,
  DeliveryScopeType,
  AIRiskLevel,
  ReportDeliveryChannel,
  ReportDeliveryStatus,
  AISourceType,
  AITaskStatus,
  AITaskType,
  ActionReasonCode,
  UserRole,
} from '../domain/types'
import type { AppCapability } from '../domain/authz'
import type { ApprovalDecision } from '../domain/approval-state-machine'
import type { TaskTransitionName } from '../domain/task-state-machine'

// Canonical shared DTO definitions live here. Other contract files may only
// re-export these types; they must not redefine shared transport semantics.
export interface PaginationMeta {
  total: number
}

export interface ApiErrorDTO {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ApiEnvelope<T> {
  data: T
  meta?: PaginationMeta
  error?: ApiErrorDTO
}

export interface AuthenticatedUserDTO {
  id: string
  username: string
  name: string
  role: UserRole
  capabilities: AppCapability[]
}

export interface AIEventDTO {
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

export interface AITaskDTO {
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

export interface AIApprovalDTO {
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

export interface AITaskActionDTO {
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

export interface AIReportDTO {
  id: string
  type: AIReportType
  title: string
  summary: string
  highlights: string[]
  createdAt: string
  metadata: Record<string, unknown>
}

export interface SupervisorEmailMappingDTO {
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

export interface ReportDeliveryConfigDTO {
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

export interface ReportDeliveryRecordDTO {
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
  triggerMode: 'manual'
  sentAt: string
  createdAt: string
}

export interface ChemicalInventoryDTO {
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
  metadata: Record<string, unknown>
}

export interface EquipmentAssetDTO {
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

export interface ImportErrorDTO {
  rowNumber: number
  field: string
  code: string
  message: string
  rawValue: unknown
}

export interface ImportBatchDTO {
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
  errors: ImportErrorDTO[]
  metadata: Record<string, unknown>
}

export interface DomainContextDTO {
  chemical?: {
    currentStock?: number
    threshold?: number
    recentMovements?: Array<Record<string, unknown>>
  }
  equipment?: {
    status?: string
    lastMaintenanceAt?: string | null
    overdueDays?: number
    recentMaintenance?: Array<Record<string, unknown>>
  }
  existingOpenTask?: {
    id: string
    status: AITaskStatus
    assigneeId?: string | null
    assigneeName?: string | null
  } | null
  relatedApproval?: {
    id: string
    status: AIApprovalStatus
  } | null
}

export interface DecisionStateDTO {
  isValidEvent: boolean
  dedupeHit: boolean
  route: 'inventory' | 'maintenance' | 'fault' | 'ignore' | null
  requiresApproval: boolean
  shouldCreateTask: boolean
  shouldNotifyOnly: boolean
  reasonCodes: ActionReasonCode[]
}

export interface SupervisorDecisionDTO {
  handler: 'inventory_handler' | 'maintenance_handler' | 'fault_handler' | 'notify_only' | 'ignore'
  queue: 'urgent' | 'priority' | 'routine' | 'background'
  reason: string
  escalationTarget: 'lab_manager' | 'equipment_manager' | 'buyer' | 'supervisor' | null
}

export interface HandlerResultDTO {
  handler: SupervisorDecisionDTO['handler']
  summary: string
  suggestedAssigneeRole?: string
  followUpActions: string[]
  metadata?: Record<string, unknown>
}

export interface TaskDraftDTO {
  type: Exclude<AITaskType, 'report'>
  title: string
  summary: string
  recommendation: string
  priority: AIPriority
  riskLevel: AIRiskLevel
  assigneeRole: string
  sourceType: Extract<AISourceType, 'chemical' | 'equipment'>
  sourceId: string
  dueAt: string | null
}

export interface ApprovalDraftDTO {
  title: string
  reason: string
  riskLevel: AIRiskLevel
  targetType: 'task'
  targetTempRef: string
}

export interface ToolExecutionRecordDTO {
  toolName: string
  success: boolean
  output: Record<string, unknown>
}

export interface ActivityDraftDTO {
  actionType: AIActionType
  reasonCodes: ActionReasonCode[]
  detail: string
  taskId?: string
  approvalId?: string
}

export interface GraphOutputDTO {
  status: 'task_created' | 'approval_created' | 'ignored' | 'failed'
  taskId?: string
  approvalId?: string
  summary: string
}

export interface GraphErrorDTO {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface LabAgentStateDTO {
  runId: string
  now: string
  actor: AuditActor
  event: AIEventDTO | null
  context: DomainContextDTO
  decision: DecisionStateDTO
  supervisor: SupervisorDecisionDTO | null
  handlerResult: HandlerResultDTO | null
  taskDraft: TaskDraftDTO | null
  approvalDraft: ApprovalDraftDTO | null
  toolResults: ToolExecutionRecordDTO[]
  logs: ActivityDraftDTO[]
  output: GraphOutputDTO | null
  errors: GraphErrorDTO[]
}

export interface ListTasksQuery {
  status?: AITaskStatus
  type?: AITaskType
  priority?: AIPriority
  sourceType?: AISourceType
  assigneeId?: string
}

export interface CreateTaskRequest {
  eventId: string | null
  type: AITaskType
  title: string
  summary: string
  recommendation: string
  priority: AIPriority
  riskLevel: AIRiskLevel
  sourceType: AISourceType
  sourceId: string
  sourceName: string
  assigneeId?: string | null
  assigneeName?: string | null
  assigneeRole?: string | null
  requiresApproval: boolean
  dueAt?: string | null
  evidence?: AIEvidenceItem[]
  metadata?: Record<string, unknown>
}

export interface AssignTaskRequest {
  assigneeId: string
  assigneeName: string
  assigneeRole: string
}

export interface UpdateTaskStatusRequest {
  transition: TaskTransitionName
  detail: string
}

export interface ListApprovalsQuery {
  status?: AIApprovalStatus
  riskLevel?: AIRiskLevel
  reviewerId?: string
}

export interface CreateApprovalRequest {
  taskId: string
  title: string
  reason: string
  riskLevel: AIRiskLevel
  metadata?: Record<string, unknown>
}

export interface ProcessApprovalRequest {
  decision: ApprovalDecision
  comment: string
}

export interface RuleEvaluationRequest {
  event: AIEventDTO
  context: DomainContextDTO
}

export interface RuleEvaluationResponse {
  decision: DecisionStateDTO
}

export interface RuleInspectionItemDTO {
  event: AIEventDTO
  context: DomainContextDTO
  decision: DecisionStateDTO
  duplicateTaskId: string | null
}

export interface InspectRulesRequest {
  input: {
    chemicals?: Array<{
      id: string
      name: string
      totalQuantity: number
      threshold: number
    }>
    equipment?: Array<{
      id: string
      name: string
      status: string
      lastMaintenanceAt: string | null
    }>
  }
  config: {
    now: string
    maintenanceOverdueDays: number
  }
  contextBySource?: Record<string, DomainContextDTO>
}

export interface InspectRulesResponse {
  items: RuleInspectionItemDTO[]
}

export interface ExecuteRuleEventRequest {
  runId: string
  actor: AuditActor
  event: AIEventDTO
}

export interface ExecuteRuleEventResponse {
  state: LabAgentStateDTO
}

export interface TaskSLAConfigDTO {
  openMinutes: number
  inProgressMinutes: number
  pendingApprovalMinutes: number
  reminderIntervalMinutes: number
  maxReminderCountBeforeEscalation: number
}

export interface TaskSLAInspectionItemDTO {
  task: AITaskDTO
  overdueMinutes: number
  thresholdMinutes: number
  reminderCount: number
  shouldRemind: boolean
  shouldEscalate: boolean
}

export interface InspectTaskSLARequest {
  now: string
  config: TaskSLAConfigDTO
}

export interface InspectTaskSLAResponse {
  items: TaskSLAInspectionItemDTO[]
}

export interface ExecuteTaskSLARequest {
  now: string
  config: TaskSLAConfigDTO
  actor: AuditActor
}

export interface ExecuteTaskSLAResponse {
  reminders: AITaskActionDTO[]
  escalations: AITaskActionDTO[]
}

export interface TaskTrackingAgentStateDTO {
  runId: string
  now: string
  actor: AuditActor
  inspection: InspectTaskSLAResponse
  execution: ExecuteTaskSLAResponse
  logs: Array<{
    step: 'inspect_sla' | 'execute_sla' | 'summarize'
    detail: string
  }>
  output: {
    status: 'completed'
    reminderCount: number
    escalationCount: number
    summary: string
  }
}

export interface ExecuteTaskTrackingAgentRequest {
  runId: string
  now: string
  actor: AuditActor
  config: TaskSLAConfigDTO
}

export interface ExecuteTaskTrackingAgentResponse {
  state: TaskTrackingAgentStateDTO
}

export interface ReportingAgentStateDTO {
  runId: string
  now: string
  actor: AuditActor
  reportType: AIReportType
  report: AIReportDTO
  logs: Array<{
    step: 'generate_report' | 'summarize'
    detail: string
  }>
  output: {
    status: 'completed'
    reportId: string
    summary: string
  }
}

export interface ExecuteReportingAgentRequest {
  runId: string
  now: string
  actor: AuditActor
  type: AIReportType
}

export interface ExecuteReportingAgentResponse {
  state: ReportingAgentStateDTO
}

export interface ListReportsQuery {
  type?: AIReportType
}

export interface GenerateReportRequest {
  type: AIReportType
  now: string
}

export interface GenerateReportResponse {
  report: AIReportDTO
}

export interface ExportReportPdfResponse {
  fileName: string
  mimeType: 'application/pdf'
  contentBase64: string
}

export interface DeleteReportResponse {
  deletedReportId: string
}

export interface ListSupervisorEmailMappingsQuery {
  scopeType?: DeliveryScopeType
  enabled?: 'true' | 'false'
}

export interface UpsertSupervisorEmailMappingRequest {
  scopeType: DeliveryScopeType
  scopeId?: string | null
  scopeName: string
  recipientName: string
  recipientEmail: string
  enabled: boolean
}

export interface ListReportDeliveryConfigsQuery {
  reportType?: AIReportType
  enabled?: 'true' | 'false'
}

export interface UpsertReportDeliveryConfigRequest {
  reportType: AIReportType
  scopeType: DeliveryScopeType
  scopeId?: string | null
  scopeName: string
  channel: ReportDeliveryChannel
  enabled: boolean
}

export interface ListReportDeliveryRecordsQuery {
  reportType?: AIReportType
  status?: ReportDeliveryStatus
}

export interface SendReportRequest {
  reportId: string
  actor: AuditActor
}

export interface SendReportResponse {
  records: ReportDeliveryRecordDTO[]
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: AuthenticatedUserDTO
  expiresAt: string
}

export interface ChemicalImportRowDTO {
  recordId?: string
  name: string
  casNumber?: string | null
  category?: string | null
  spec?: string | null
  currentQuantity: number
  threshold?: number | null
  status?: string | null
  labName?: string | null
  ownerName?: string | null
  updatedAt?: string | null
  imageDataUrl?: string | null
  remark?: string | null
  metadata?: Record<string, unknown>
}

export interface EquipmentImportRowDTO {
  recordId?: string
  name: string
  vendor?: string | null
  model?: string | null
  status: string
  labName?: string | null
  ownerName?: string | null
  lastMaintenanceAt?: string | null
  updatedAt?: string | null
  imageDataUrl?: string | null
  remark?: string | null
  metadata?: Record<string, unknown>
}

export interface ImportChemicalsRequest {
  source: 'manual' | 'excel'
  fileName?: string | null
  importedBy: AuditActor
  rows: ChemicalImportRowDTO[]
  runRuleInspection?: boolean
}

export interface ImportEquipmentRequest {
  source: 'manual' | 'excel'
  fileName?: string | null
  importedBy: AuditActor
  rows: EquipmentImportRowDTO[]
  runRuleInspection?: boolean
}

export interface ImportChemicalsResponse {
  batch: ImportBatchDTO
  records: ChemicalInventoryDTO[]
}

export interface ImportEquipmentResponse {
  batch: ImportBatchDTO
  records: EquipmentAssetDTO[]
}

export interface ListImportBatchesQuery {
  entityType?: 'chemical' | 'equipment'
  status?: 'completed' | 'partial_failed' | 'failed'
}

export interface ImportBatchDetailDTO {
  batch: ImportBatchDTO
  chemicals: ChemicalInventoryDTO[]
  equipment: EquipmentAssetDTO[]
}

export interface ApprovalStrategyDTO {
  highRiskRequiresApproval: boolean
  equipmentFaultRequiresApproval: boolean
  maintenanceOverdueRequiresApproval: boolean
}

export interface ThresholdSettingsDTO {
  defaultLowStockThreshold: number
  maintenanceOverdueDays: number
  chemicalThresholdOverrides: Record<string, number>
}

export interface SystemSettingsDTO {
  thresholds: ThresholdSettingsDTO
  approvalStrategy: ApprovalStrategyDTO
  sla: TaskSLAConfigDTO
  updatedAt: string
}

export interface UpdateSystemSettingsRequest {
  thresholds?: Partial<ThresholdSettingsDTO>
  approvalStrategy?: Partial<ApprovalStrategyDTO>
  sla?: Partial<TaskSLAConfigDTO>
}

export interface UpdateSystemSettingsResponse {
  settings: SystemSettingsDTO
}

export interface TaskDetailDTO {
  task: AITaskDTO
  approval: AIApprovalDTO | null
  actions: AITaskActionDTO[]
}

export interface CreateTaskResponse {
  task: AITaskDTO
  actions: AITaskActionDTO[]
}

export interface UpdateTaskStatusResponse {
  task: AITaskDTO
  action: AITaskActionDTO
}

export interface AssignTaskResponse {
  task: AITaskDTO
  action: AITaskActionDTO
}

export interface CreateApprovalResponse {
  approval: AIApprovalDTO
  task: AITaskDTO
  actions: AITaskActionDTO[]
}

export interface ProcessApprovalResponse {
  approval: AIApprovalDTO
  task: AITaskDTO
  action: AITaskActionDTO
}

export interface BackendRouteContract {
  method: 'GET' | 'POST' | 'PATCH'
  path: string
  description: string
  responseType:
    | 'TaskDetailDTO'
    | 'CreateTaskResponse'
    | 'UpdateTaskStatusResponse'
    | 'AssignTaskResponse'
    | 'CreateApprovalResponse'
    | 'ProcessApprovalResponse'
    | 'AITaskDTO[]'
    | 'AIApprovalDTO[]'
    | 'ExecuteTaskTrackingAgentResponse'
    | 'ExecuteReportingAgentResponse'
}

export const backendRouteContracts: BackendRouteContract[] = [
  {
    method: 'GET',
    path: '/api/ai/tasks',
    description: 'Query AI task list.',
    responseType: 'AITaskDTO[]',
  },
  {
    method: 'POST',
    path: '/api/ai/tasks',
    description: 'Create AI task.',
    responseType: 'CreateTaskResponse',
  },
  {
    method: 'GET',
    path: '/api/ai/tasks/:taskId',
    description: 'Query AI task detail.',
    responseType: 'TaskDetailDTO',
  },
  {
    method: 'PATCH',
    path: '/api/ai/tasks/:taskId/status',
    description: 'Execute task status transition.',
    responseType: 'UpdateTaskStatusResponse',
  },
  {
    method: 'PATCH',
    path: '/api/ai/tasks/:taskId/assignee',
    description: 'Update task assignee.',
    responseType: 'AssignTaskResponse',
  },
  {
    method: 'GET',
    path: '/api/ai/approvals',
    description: 'Query approval list.',
    responseType: 'AIApprovalDTO[]',
  },
  {
    method: 'POST',
    path: '/api/ai/approvals',
    description: 'Create approval request.',
    responseType: 'CreateApprovalResponse',
  },
  {
    method: 'PATCH',
    path: '/api/ai/approvals/:approvalId/process',
    description: 'Process approval decision.',
    responseType: 'ProcessApprovalResponse',
  },
  {
    method: 'POST',
    path: '/api/ai/agents/task-tracking/execute',
    description: 'Execute task tracking agent for SLA inspection, reminders, and escalation.',
    responseType: 'ExecuteTaskTrackingAgentResponse',
  },
  {
    method: 'POST',
    path: '/api/ai/agents/reporting/execute',
    description: 'Execute reporting agent to generate a report and return summary output.',
    responseType: 'ExecuteReportingAgentResponse',
  },
]
