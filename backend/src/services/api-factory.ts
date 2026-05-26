import type {
  AssignTaskRequest,
  CreateApprovalRequest,
  CreateTaskRequest,
  ListApprovalsQuery,
  ListTasksQuery,
  ProcessApprovalRequest,
  UpdateTaskStatusRequest,
} from '../contracts/api'
import type {
  AssignTaskResponse,
  CreateApprovalResponse,
  CreateTaskResponse,
  ProcessApprovalResponse,
  TaskDetailDTO,
  UpdateTaskStatusResponse,
} from '../contracts/responses'
import type { AuditActor } from '../domain/types'
import type { AuthAuditEvent } from './auth-audit'
import { systemClock } from './clock'
import { createIncrementalIdGenerator } from './id-generator'
import { ActivityLogService } from './activity-log-service'
import { ApprovalService } from './approval-service'
import { ImportService } from './import-service'
import { ReportDeliveryService } from './report-delivery-service'
import { RuleEngineService } from './rule-engine-service'
import { ReportService } from './report-service'
import { SettingsService } from './settings-service'
import { SLAService } from './sla-service'
import { createInMemoryAIDataStore } from './store'
import { TaskService } from './task-service'
import type {
  AuthenticatedUserDTO,
  AIEventDTO,
  DeleteReportResponse,
  DomainContextDTO,
  ExecuteReportingAgentRequest,
  ExecuteReportingAgentResponse,
  ExecuteRuleEventRequest,
  ExecuteRuleEventResponse,
  ExecuteTaskTrackingAgentRequest,
  ExecuteTaskTrackingAgentResponse,
  ExecuteTaskSLARequest,
  ExecuteTaskSLAResponse,
  EquipmentAssetDTO,
  ExportReportPdfResponse,
  GenerateReportRequest,
  GenerateReportResponse,
  ChemicalInventoryDTO,
  ImportBatchDetailDTO,
  ImportChemicalsRequest,
  ImportChemicalsResponse,
  ImportEquipmentRequest,
  ImportEquipmentResponse,
  InspectRulesRequest,
  InspectRulesResponse,
  InspectTaskSLARequest,
  InspectTaskSLAResponse,
  LoginRequest,
  LoginResponse,
  ListImportBatchesQuery,
  ListReportDeliveryConfigsQuery,
  ListReportDeliveryRecordsQuery,
  ListReportsQuery,
  ListSupervisorEmailMappingsQuery,
  ReportDeliveryConfigDTO,
  ReportDeliveryRecordDTO,
  RuleEvaluationRequest,
  SendReportRequest,
  SendReportResponse,
  SupervisorEmailMappingDTO,
  SystemSettingsDTO,
  UpsertReportDeliveryConfigRequest,
  UpsertSupervisorEmailMappingRequest,
  UpdateSystemSettingsRequest,
  UpdateSystemSettingsResponse,
} from '../contracts/shared'
import type { AppCapability } from '../domain/authz'
import { loadAppConfig } from './app-config'
import { AuthService } from './auth-service'
import { StubEmailSender, type EmailSender } from './email-sender'
import { createLLMService, type RecommendationBundle, type RecommendationResult } from './llm-service'
import { ReportExportService } from './report-export-service'
import { InMemoryAIRepository, type AIRepository } from './repositories'
import type { AIDataStore } from './store'

export interface AIApplicationServiceOptions {
  config?: ReturnType<typeof loadAppConfig>
  repository?: AIRepository
  emailSender?: EmailSender
}

export interface AIApplicationServices {
  initialize(): Promise<void>
  flushPersistence(): Promise<void>
  login(request: LoginRequest): LoginResponse
  authenticate(authorizationHeader?: string): AuthenticatedUserDTO | null
  recordForbiddenAction(user: AuthenticatedUserDTO, capability: AppCapability, metadata?: Record<string, unknown>): void
  listAuthAuditEvents(): AuthAuditEvent[]
  listChemicals(): ChemicalInventoryDTO[]
  listEquipment(): EquipmentAssetDTO[]
  listTasks(query?: ListTasksQuery): ReturnType<TaskService['listTasks']>
  getTaskDetail(taskId: string): TaskDetailDTO
  createTask(request: CreateTaskRequest, actor: AuditActor): CreateTaskResponse
  assignTask(taskId: string, request: AssignTaskRequest, actor: AuditActor): AssignTaskResponse
  updateTaskStatus(taskId: string, request: UpdateTaskStatusRequest, actor: AuditActor): UpdateTaskStatusResponse
  listApprovals(query?: ListApprovalsQuery): ReturnType<ApprovalService['listApprovals']>
  createApproval(request: CreateApprovalRequest, actor: AuditActor): CreateApprovalResponse
  processApproval(approvalId: string, request: ProcessApprovalRequest, actor: AuditActor): ProcessApprovalResponse
  listReports(query?: ListReportsQuery): ReturnType<ReportService['listReports']>
  generateReport(request: GenerateReportRequest): Promise<GenerateReportResponse>
  deleteReport(reportId: string): DeleteReportResponse
  exportReportPdf(reportId: string): Promise<ExportReportPdfResponse>
  listSupervisorEmailMappings(query?: ListSupervisorEmailMappingsQuery): SupervisorEmailMappingDTO[]
  saveSupervisorEmailMapping(request: UpsertSupervisorEmailMappingRequest, mappingId?: string): SupervisorEmailMappingDTO
  listReportDeliveryConfigs(query?: ListReportDeliveryConfigsQuery): ReportDeliveryConfigDTO[]
  saveReportDeliveryConfig(request: UpsertReportDeliveryConfigRequest, configId?: string): ReportDeliveryConfigDTO
  listReportDeliveryRecords(query?: ListReportDeliveryRecordsQuery): ReportDeliveryRecordDTO[]
  sendReport(request: SendReportRequest): Promise<SendReportResponse>
  getSystemSettings(): SystemSettingsDTO
  updateSystemSettings(request: UpdateSystemSettingsRequest): UpdateSystemSettingsResponse
  inspectRules(request: InspectRulesRequest): InspectRulesResponse
  evaluateRuleEvent(request: RuleEvaluationRequest): ReturnType<RuleEngineService['evaluateEvent']>
  executeRuleEvent(request: ExecuteRuleEventRequest): Promise<ExecuteRuleEventResponse>
  executeReportingAgent(request: ExecuteReportingAgentRequest): Promise<ExecuteReportingAgentResponse>
  executeTaskTrackingAgent(request: ExecuteTaskTrackingAgentRequest): ExecuteTaskTrackingAgentResponse
  generateRecommendationBundle(event: AIEventDTO, context: DomainContextDTO, fallback: RecommendationBundle): Promise<RecommendationResult>
  inspectTaskSLA(request: InspectTaskSLARequest): InspectTaskSLAResponse
  executeTaskSLA(request: ExecuteTaskSLARequest): ExecuteTaskSLAResponse
  importChemicals(request: ImportChemicalsRequest): ImportChemicalsResponse
  importEquipment(request: ImportEquipmentRequest): ImportEquipmentResponse
  listImportBatches(query?: ListImportBatchesQuery): ReturnType<ImportService['listImportBatches']>
  getImportBatchDetail(batchId: string): ImportBatchDetailDTO
}

export function createAIApplicationServices(options: AIApplicationServiceOptions = {}): AIApplicationServices {
  const config = options.config ?? loadAppConfig()
  const store: AIDataStore = createInMemoryAIDataStore()
  const repository: AIRepository = options.repository ?? new InMemoryAIRepository(store)
  const emailSender = options.emailSender ?? new StubEmailSender()
  const llmService = createLLMService(config)
  const idGenerator = createIncrementalIdGenerator()
  const authService = new AuthService({
    store: repository,
    idGenerator,
    clock: systemClock,
    config,
  })
  const activityLogs = new ActivityLogService(repository)
  const taskService = new TaskService({
    store: repository,
    activityLogs,
    idGenerator,
    clock: systemClock,
  })
  const approvalService = new ApprovalService({
    store: repository,
    activityLogs,
    idGenerator,
    clock: systemClock,
  })
  const slaService = new SLAService({
    store: repository,
    activityLogs,
    idGenerator,
  })
  const ruleEngine = new RuleEngineService({
    services: {
      listTasks: (query) => taskService.listTasks(query),
      createTask: (request, actor) => taskService.createTask(request, actor),
      updateTaskStatus: (taskId, request, actor) => taskService.updateTaskStatus(taskId, request, actor),
      createApproval: (request, actor) => approvalService.createApproval(request, actor),
      inspectTaskSLA: (request) => slaService.inspect(request),
      executeTaskSLA: (request) => slaService.execute(request),
      generateReport: (request) => reportService.generateReport(request),
      generateRecommendationBundle: (event, context, fallback) => llmService.generateRecommendationBundle(event, context, fallback),
    },
  })
  const reportService = new ReportService({
    store: repository,
    idGenerator,
    clock: systemClock,
    llm: llmService,
  })
  const reportExportService = new ReportExportService({
    repository,
  })
  const reportDeliveryService = new ReportDeliveryService({
    repository,
    idGenerator,
    clock: systemClock,
    activityLogs,
    emailSender,
    exportReportPdf: (reportId) => reportExportService.exportPdf(reportId),
  })
  const settingsService = new SettingsService({
    store: repository,
    clock: systemClock,
  })
  const importService = new ImportService({
    store: repository,
    idGenerator,
    clock: systemClock,
    getSettings: () => settingsService.getSettings(),
    inspectRules: (request) => ruleEngine.inspectRules({
      input: {
        chemicals: request.chemicals,
        equipment: request.equipment,
      },
      config: request.config,
    }),
  })

  return {
    initialize: async () => undefined,
    flushPersistence: async () => undefined,
    login: (request) => authService.login(request),
    authenticate: (authorizationHeader) => authService.authenticate(authorizationHeader),
    recordForbiddenAction: (user, capability, metadata) => authService.recordForbiddenAction(user, capability, metadata),
    listAuthAuditEvents: () => authService.listAuditEvents(),
    listChemicals: () => importService.listChemicals(),
    listEquipment: () => importService.listEquipment(),
    listTasks: (query) => taskService.listTasks(query),
    getTaskDetail: (taskId) => taskService.getTaskDetail(taskId),
    createTask: (request, actor) => taskService.createTask(request, actor),
    assignTask: (taskId, request, actor) => taskService.assignTask(taskId, request, actor),
    updateTaskStatus: (taskId, request, actor) => taskService.updateTaskStatus(taskId, request, actor),
    listApprovals: (query) => approvalService.listApprovals(query),
    createApproval: (request, actor) => approvalService.createApproval(request, actor),
    processApproval: (approvalId, request, actor) => approvalService.processApproval(approvalId, request, actor),
    listReports: (query) => reportService.listReports(query),
    generateReport: (request) => reportService.generateReport(request),
    deleteReport: (reportId) => reportService.deleteReport(reportId),
    exportReportPdf: (reportId) => reportExportService.exportPdf(reportId),
    listSupervisorEmailMappings: (query) => reportDeliveryService.listMappings(query),
    saveSupervisorEmailMapping: (request, mappingId) => reportDeliveryService.saveMapping(request, mappingId),
    listReportDeliveryConfigs: (query) => reportDeliveryService.listConfigs(query),
    saveReportDeliveryConfig: (request, configId) => reportDeliveryService.saveConfig(request, configId),
    listReportDeliveryRecords: (query) => reportDeliveryService.listRecords(query),
    sendReport: async (request) => reportDeliveryService.sendReport(request),
    getSystemSettings: () => settingsService.getSettings(),
    updateSystemSettings: (request) => settingsService.updateSettings(request),
    inspectRules: (request) => ruleEngine.inspectRules(request),
    evaluateRuleEvent: (request) => ruleEngine.evaluateEvent(request),
    executeRuleEvent: (request) => ruleEngine.executeRuleEvent(request),
    executeReportingAgent: (request) => ruleEngine.executeReportingAgent(request),
    executeTaskTrackingAgent: (request) => ruleEngine.executeTaskTrackingAgent(request),
    generateRecommendationBundle: (event, context, fallback) => llmService.generateRecommendationBundle(event, context, fallback),
    inspectTaskSLA: (request) => slaService.inspect(request),
    executeTaskSLA: (request) => slaService.execute(request),
    importChemicals: (request) => importService.importChemicals(request),
    importEquipment: (request) => importService.importEquipment(request),
    listImportBatches: (query) => importService.listImportBatches(query),
    getImportBatchDetail: (batchId) => importService.getImportBatchDetail(batchId),
  }
}
