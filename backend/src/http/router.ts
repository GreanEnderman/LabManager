import type {
  ApiErrorDTO,
  AuthenticatedUserDTO,
  ApiEnvelope,
  AssignTaskRequest,
  CreateApprovalRequest,
  ExecuteReportingAgentRequest,
  ExecuteRuleEventRequest,
  ExecuteTaskTrackingAgentRequest,
  GenerateReportRequest,
  ImportChemicalsRequest,
  ImportEquipmentRequest,
  InspectRulesRequest,
  ListApprovalsQuery,
  ListImportBatchesQuery,
  LoginRequest,
  ListReportDeliveryConfigsQuery,
  ListReportDeliveryRecordsQuery,
  ListReportsQuery,
  ListSupervisorEmailMappingsQuery,
  ListTasksQuery,
  ProcessApprovalRequest,
  SendReportRequest,
  UpsertReportDeliveryConfigRequest,
  UpsertSupervisorEmailMappingRequest,
  UpdateSystemSettingsRequest,
  UpdateTaskStatusRequest,
} from '../contracts/shared'
import type { AppCapability } from '../domain/authz'
import type { AIApplicationServices } from '../services/api-factory'
import { EntityNotFoundError, ForbiddenError, PasswordPolicyError, TooManyRequestsError, UnauthorizedError, ValidationError } from '../services/errors'

export interface HttpRequestLike {
  method: string
  path: string
  query?: Record<string, string | undefined>
  body?: unknown
  headers?: Record<string, string | undefined>
}

export interface HttpResponseLike<T = unknown> {
  status: number
  body: ApiEnvelope<T>
}

interface RouteMatch {
  taskId?: string
  approvalId?: string
  mappingId?: string
  configId?: string
  reportId?: string
}

function ok<T>(data: T): HttpResponseLike<T> {
  return {
    status: 200,
    body: { data },
  }
}

function created<T>(data: T): HttpResponseLike<T> {
  return {
    status: 201,
    body: { data },
  }
}

function buildError(code: string, message: string, details?: Record<string, unknown>): ApiErrorDTO {
  return { code, message, ...(details ? { details } : {}) }
}

function toErrorResponse(error: unknown): HttpResponseLike<null> {
  if (error instanceof EntityNotFoundError) {
    return {
      status: 404,
      body: {
        data: null,
        error: buildError('not_found', error.message),
      },
    }
  }

  if (error instanceof PasswordPolicyError) {
    return {
      status: 422,
      body: {
        data: null,
        error: buildError(error.code, error.message),
      },
    }
  }

  if (error instanceof ValidationError) {
    return {
      status: 400,
      body: {
        data: null,
        error: buildError(error.code, error.message),
      },
    }
  }

  if (error instanceof UnauthorizedError) {
    return {
      status: 401,
      body: {
        data: null,
        error: buildError('unauthorized', error.message),
      },
    }
  }

  if (error instanceof ForbiddenError) {
    return {
      status: 403,
      body: {
        data: null,
        error: buildError('forbidden', error.message),
      },
    }
  }

  if (error instanceof TooManyRequestsError) {
    return {
      status: 429,
      body: {
        data: null,
        error: buildError(error.code, error.message),
      },
    }
  }

  if (error instanceof Error) {
    return {
      status: 500,
      body: {
        data: null,
        error: {
          code: 'internal_error',
          message: error.message,
        },
      },
    }
  }

  return {
    status: 500,
    body: {
      data: null,
      error: {
        code: 'internal_error',
        message: 'Unknown server error.',
      },
    },
  }
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function parseListTasksQuery(query: HttpRequestLike['query']): ListTasksQuery {
  const source = query ?? {}
  return {
    status: source.status as ListTasksQuery['status'],
    type: source.type as ListTasksQuery['type'],
    priority: source.priority as ListTasksQuery['priority'],
    sourceType: source.sourceType as ListTasksQuery['sourceType'],
    assigneeId: source.assigneeId,
  }
}

function parseListApprovalsQuery(query: HttpRequestLike['query']): ListApprovalsQuery {
  const source = query ?? {}
  return {
    status: source.status as ListApprovalsQuery['status'],
    riskLevel: source.riskLevel as ListApprovalsQuery['riskLevel'],
    reviewerId: source.reviewerId,
  }
}

function parseListReportsQuery(query: HttpRequestLike['query']): ListReportsQuery {
  const source = query ?? {}
  return {
    type: source.type as ListReportsQuery['type'],
  }
}

function parseListImportBatchesQuery(query: HttpRequestLike['query']): ListImportBatchesQuery {
  const source = query ?? {}
  return {
    entityType: source.entityType as ListImportBatchesQuery['entityType'],
    status: source.status as ListImportBatchesQuery['status'],
  }
}

function parseListSupervisorEmailMappingsQuery(query: HttpRequestLike['query']): ListSupervisorEmailMappingsQuery {
  const source = query ?? {}
  return {
    scopeType: source.scopeType as ListSupervisorEmailMappingsQuery['scopeType'],
    enabled: source.enabled as ListSupervisorEmailMappingsQuery['enabled'],
  }
}

function parseListReportDeliveryConfigsQuery(query: HttpRequestLike['query']): ListReportDeliveryConfigsQuery {
  const source = query ?? {}
  return {
    reportType: source.reportType as ListReportDeliveryConfigsQuery['reportType'],
    enabled: source.enabled as ListReportDeliveryConfigsQuery['enabled'],
  }
}

function parseListReportDeliveryRecordsQuery(query: HttpRequestLike['query']): ListReportDeliveryRecordsQuery {
  const source = query ?? {}
  return {
    reportType: source.reportType as ListReportDeliveryRecordsQuery['reportType'],
    status: source.status as ListReportDeliveryRecordsQuery['status'],
  }
}

function matchPath(path: string): RouteMatch | null {
  const taskDetail = path.match(/^\/api\/ai\/tasks\/([^/]+)$/)
  if (taskDetail) return { taskId: taskDetail[1] }

  const taskStatus = path.match(/^\/api\/ai\/tasks\/([^/]+)\/status$/)
  if (taskStatus) return { taskId: taskStatus[1] }

  const taskAssignee = path.match(/^\/api\/ai\/tasks\/([^/]+)\/assignee$/)
  if (taskAssignee) return { taskId: taskAssignee[1] }

  const approvalProcess = path.match(/^\/api\/ai\/approvals\/([^/]+)\/process$/)
  if (approvalProcess) return { approvalId: approvalProcess[1] }

  const mapping = path.match(/^\/api\/ai\/report-delivery\/mappings\/([^/]+)$/)
  if (mapping) return { mappingId: mapping[1] }

  const config = path.match(/^\/api\/ai\/report-delivery\/configs\/([^/]+)$/)
  if (config) return { configId: config[1] }

  const reportDetail = path.match(/^\/api\/ai\/reports\/([^/]+)$/)
  if (reportDetail) return { reportId: reportDetail[1] }

  const reportPdf = path.match(/^\/api\/ai\/reports\/([^/]+)\/pdf$/)
  if (reportPdf) return { reportId: reportPdf[1] }

  return null
}

export function createAIHttpRouter(services: AIApplicationServices) {
  function requireUser(user: AuthenticatedUserDTO | null) {
    if (!user) {
      throw new UnauthorizedError()
    }

    return user
  }

  function requireCapability(user: AuthenticatedUserDTO | null, capability: AppCapability) {
    const authenticated = requireUser(user)
    if (!authenticated.capabilities.includes(capability)) {
      services.recordForbiddenAction(authenticated, capability, {
        boundary: 'http_route',
      })
      throw new ForbiddenError()
    }

    return authenticated
  }

  return {
    async handle(request: HttpRequestLike): Promise<HttpResponseLike> {
      try {
        const query = request.query ?? {}
        const body = asRecord(request.body)
        const matched = matchPath(request.path)
        const authenticatedUser = services.authenticate(request.headers?.authorization)
        const persist = async <T>(response: HttpResponseLike<T>) => {
          await services.flushPersistence()
          return response
        }

        if (request.method === 'GET' && request.path === '/api/ai/health') {
          return ok({
            status: 'ok',
            timestamp: new Date().toISOString(),
          })
        }

        if (request.method === 'POST' && request.path === '/api/ai/auth/login') {
          return created(services.login(body as unknown as LoginRequest))
        }

        if (request.method === 'GET' && request.path === '/api/ai/auth/me') {
          return ok(requireUser(authenticatedUser))
        }

        if (request.method === 'GET' && request.path === '/api/ai/settings') {
          requireCapability(authenticatedUser, 'settings:read')
          return ok(services.getSystemSettings())
        }

        if (request.method === 'PATCH' && request.path === '/api/ai/settings') {
          requireCapability(authenticatedUser, 'settings:update')
          return persist(ok(services.updateSystemSettings(body as UpdateSystemSettingsRequest)))
        }

        if (request.method === 'GET' && request.path === '/api/ai/chemicals') {
          requireCapability(authenticatedUser, 'chemicals:read')
          return ok(services.listChemicals())
        }

        if (request.method === 'GET' && request.path === '/api/ai/equipment') {
          requireCapability(authenticatedUser, 'equipment:read')
          return ok(services.listEquipment())
        }

        if (request.method === 'GET' && request.path === '/api/ai/import-batches') {
          requireCapability(authenticatedUser, 'imports:read')
          return ok(services.listImportBatches(parseListImportBatchesQuery(query)))
        }

        if (request.method === 'POST' && request.path === '/api/ai/imports/chemicals') {
          requireCapability(authenticatedUser, 'imports:create')
          return persist(created(services.importChemicals(body as unknown as ImportChemicalsRequest)))
        }

        if (request.method === 'POST' && request.path === '/api/ai/imports/equipment') {
          requireCapability(authenticatedUser, 'imports:create')
          return persist(created(services.importEquipment(body as unknown as ImportEquipmentRequest)))
        }

        if (request.method === 'GET' && request.path === '/api/ai/tasks') {
          requireCapability(authenticatedUser, 'tasks:read')
          return ok(services.listTasks(parseListTasksQuery(query)))
        }

        if (request.method === 'GET' && matched?.taskId && request.path === `/api/ai/tasks/${matched.taskId}`) {
          requireCapability(authenticatedUser, 'tasks:read')
          return ok(services.getTaskDetail(matched.taskId))
        }

        if (request.method === 'PATCH' && matched?.taskId && request.path === `/api/ai/tasks/${matched.taskId}/status`) {
          const user = requireCapability(authenticatedUser, 'tasks:write')
          return persist(ok(
            services.updateTaskStatus(
              matched.taskId,
              body as unknown as UpdateTaskStatusRequest,
              { id: user.id, name: user.name, type: 'user' },
            ),
          ))
        }

        if (request.method === 'PATCH' && matched?.taskId && request.path === `/api/ai/tasks/${matched.taskId}/assignee`) {
          const user = requireCapability(authenticatedUser, 'tasks:write')
          return persist(ok(
            services.assignTask(
              matched.taskId,
              body as unknown as AssignTaskRequest,
              { id: user.id, name: user.name, type: 'user' },
            ),
          ))
        }

        if (request.method === 'GET' && request.path === '/api/ai/approvals') {
          requireCapability(authenticatedUser, 'approvals:read')
          return ok(services.listApprovals(parseListApprovalsQuery(query)))
        }

        if (request.method === 'POST' && request.path === '/api/ai/approvals') {
          const user = requireCapability(authenticatedUser, 'approvals:write')
          return persist(created(
            services.createApproval(body as unknown as CreateApprovalRequest, { id: user.id, name: user.name, type: 'user' }),
          ))
        }

        if (
          request.method === 'PATCH' &&
          matched?.approvalId &&
          request.path === `/api/ai/approvals/${matched.approvalId}/process`
        ) {
          const user = requireCapability(authenticatedUser, 'approvals:write')
          return persist(ok(
            services.processApproval(
              matched.approvalId,
              body as unknown as ProcessApprovalRequest,
              { id: user.id, name: user.name, type: 'user' },
            ),
          ))
        }

        if (request.method === 'GET' && request.path === '/api/ai/reports') {
          requireCapability(authenticatedUser, 'reports:read')
          return ok(services.listReports(parseListReportsQuery(query)))
        }

        if (request.method === 'POST' && request.path === '/api/ai/reports/generate') {
          requireCapability(authenticatedUser, 'reports:generate')
          return persist(created(await services.generateReport(body as unknown as GenerateReportRequest)))
        }

        if (request.method === 'DELETE' && matched?.reportId && request.path === `/api/ai/reports/${matched.reportId}`) {
          requireCapability(authenticatedUser, 'reports:delete')
          return persist(ok(services.deleteReport(matched.reportId)))
        }

        if (request.method === 'GET' && matched?.reportId && request.path === `/api/ai/reports/${matched.reportId}/pdf`) {
          requireCapability(authenticatedUser, 'reports:read')
          return ok(await services.exportReportPdf(matched.reportId))
        }

        if (request.method === 'GET' && request.path === '/api/ai/report-delivery/mappings') {
          requireCapability(authenticatedUser, 'report_delivery:read')
          return ok(services.listSupervisorEmailMappings(parseListSupervisorEmailMappingsQuery(query)))
        }

        if (request.method === 'POST' && request.path === '/api/ai/report-delivery/mappings') {
          requireCapability(authenticatedUser, 'report_delivery:manage')
          return persist(created(services.saveSupervisorEmailMapping(body as unknown as UpsertSupervisorEmailMappingRequest)))
        }

        if (
          request.method === 'PATCH' &&
          matched?.mappingId &&
          request.path === `/api/ai/report-delivery/mappings/${matched.mappingId}`
        ) {
          requireCapability(authenticatedUser, 'report_delivery:manage')
          return persist(ok(
            services.saveSupervisorEmailMapping(body as unknown as UpsertSupervisorEmailMappingRequest, matched.mappingId),
          ))
        }

        if (request.method === 'GET' && request.path === '/api/ai/report-delivery/configs') {
          requireCapability(authenticatedUser, 'report_delivery:read')
          return ok(services.listReportDeliveryConfigs(parseListReportDeliveryConfigsQuery(query)))
        }

        if (request.method === 'POST' && request.path === '/api/ai/report-delivery/configs') {
          requireCapability(authenticatedUser, 'report_delivery:manage')
          return persist(created(services.saveReportDeliveryConfig(body as unknown as UpsertReportDeliveryConfigRequest)))
        }

        if (
          request.method === 'PATCH' &&
          matched?.configId &&
          request.path === `/api/ai/report-delivery/configs/${matched.configId}`
        ) {
          requireCapability(authenticatedUser, 'report_delivery:manage')
          return persist(ok(
            services.saveReportDeliveryConfig(body as unknown as UpsertReportDeliveryConfigRequest, matched.configId),
          ))
        }

        if (request.method === 'GET' && request.path === '/api/ai/report-delivery/records') {
          requireCapability(authenticatedUser, 'report_delivery:read')
          return ok(services.listReportDeliveryRecords(parseListReportDeliveryRecordsQuery(query)))
        }

        if (request.method === 'POST' && request.path === '/api/ai/report-delivery/send') {
          requireCapability(authenticatedUser, 'report_delivery:manage')
          return persist(created(await services.sendReport(body as unknown as SendReportRequest)))
        }

        if (request.method === 'POST' && request.path === '/api/ai/rules/inspect') {
          requireCapability(authenticatedUser, 'rules:inspect')
          return ok(services.inspectRules(body as unknown as InspectRulesRequest))
        }

        if (request.method === 'POST' && request.path === '/api/ai/rules/execute') {
          requireCapability(authenticatedUser, 'rules:execute')
          return persist(created(await services.executeRuleEvent(body as unknown as ExecuteRuleEventRequest)))
        }

        if (request.method === 'POST' && request.path === '/api/ai/agents/task-tracking/execute') {
          requireCapability(authenticatedUser, 'agents:execute')
          return persist(created(services.executeTaskTrackingAgent(body as unknown as ExecuteTaskTrackingAgentRequest)))
        }

        if (request.method === 'POST' && request.path === '/api/ai/agents/reporting/execute') {
          requireCapability(authenticatedUser, 'agents:execute')
          return persist(created(await services.executeReportingAgent(body as unknown as ExecuteReportingAgentRequest)))
        }

        return {
          status: 404,
          body: {
            data: null,
            error: {
              code: 'route_not_found',
              message: `No route matched ${request.method} ${request.path}.`,
            },
          },
        }
      } catch (error) {
        return toErrorResponse(error)
      }
    },
  }
}
