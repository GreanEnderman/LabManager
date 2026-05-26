import type {
  AIEventDTO,
  ApiEnvelope,
  CreateApprovalRequest,
  CreateApprovalResponse,
  CreateTaskRequest,
  CreateTaskResponse,
  LabAgentStateDTO,
  RuleEvaluationResponse,
  TaskDraftDTO,
} from '../contracts/shared'
import type { AuditActor } from '../domain/types'
import type { AIApplicationServices } from '../services/api-factory'
import { evaluateRuleGate } from './rule-gate'
import { runFaultHandler } from './fault-handler'
import { runMaintenanceHandler } from './maintenance-handler'
import { buildApprovalDraft, buildGraphOutputSummary, buildRecommendationBundle, buildTaskDraft } from './recommendations'
import { runInventoryHandler } from './inventory-handler'
import { routeSupervisor } from './supervisor-router'

export interface GraphRunnerDependencies {
  services: AIApplicationServices
}

export interface RunEventGraphInput {
  runId: string
  actor: AuditActor
  event: AIEventDTO
}

function buildInitialState(input: RunEventGraphInput): LabAgentStateDTO {
  return {
    runId: input.runId,
    now: input.event.createdAt,
    actor: input.actor,
    event: input.event,
    context: {},
    decision: {
      isValidEvent: false,
      dedupeHit: false,
      route: null,
      requiresApproval: false,
      shouldCreateTask: false,
      shouldNotifyOnly: false,
      reasonCodes: [],
    },
    supervisor: null,
    handlerResult: null,
    taskDraft: null,
    approvalDraft: null,
    toolResults: [],
    logs: [],
    output: null,
    errors: [],
  }
}

function buildCreateTaskRequest(event: AIEventDTO, draft: TaskDraftDTO): CreateTaskRequest {
  return {
    eventId: event.id,
    type: draft.type,
    title: draft.title,
    summary: draft.summary,
    recommendation: draft.recommendation,
    priority: draft.priority,
    riskLevel: draft.riskLevel,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    sourceName: event.sourceName,
    assigneeRole: draft.assigneeRole,
    requiresApproval: draft.riskLevel === 'high',
    dueAt: draft.dueAt,
    evidence: event.evidence,
    metadata: {
      ...event.metadata,
      graphRunId: event.id,
    },
  }
}

function runSpecializedHandler(event: AIEventDTO, state: LabAgentStateDTO): TaskDraftDTO {
  if (state.supervisor?.handler === 'inventory_handler') {
    const handlerResult = runInventoryHandler(event, state.context)
    state.handlerResult = {
      handler: handlerResult.handler,
      summary: handlerResult.summary,
      suggestedAssigneeRole: handlerResult.suggestedAssigneeRole,
      followUpActions: handlerResult.followUpActions,
      metadata: handlerResult.metadata,
    }

    state.logs.push({
      actionType: 'task_created',
      reasonCodes: state.decision.reasonCodes,
      detail: `Inventory handler prepared follow-up plan: ${handlerResult.followUpActions.join(' ')}`,
    })

    return handlerResult.taskDraft
  }

  if (state.supervisor?.handler === 'maintenance_handler') {
    const handlerResult = runMaintenanceHandler(event, state.context)
    state.handlerResult = {
      handler: handlerResult.handler,
      summary: handlerResult.summary,
      suggestedAssigneeRole: handlerResult.suggestedAssigneeRole,
      followUpActions: handlerResult.followUpActions,
      metadata: handlerResult.metadata,
    }

    state.logs.push({
      actionType: 'task_created',
      reasonCodes: state.decision.reasonCodes,
      detail: `Maintenance handler prepared follow-up plan: ${handlerResult.followUpActions.join(' ')}`,
    })

    return handlerResult.taskDraft
  }

  if (state.supervisor?.handler === 'fault_handler') {
    const handlerResult = runFaultHandler(event, state.context)
    state.handlerResult = {
      handler: handlerResult.handler,
      summary: handlerResult.summary,
      suggestedAssigneeRole: handlerResult.suggestedAssigneeRole,
      followUpActions: handlerResult.followUpActions,
      metadata: handlerResult.metadata,
    }

    state.logs.push({
      actionType: 'task_created',
      reasonCodes: state.decision.reasonCodes,
      detail: `Fault handler prepared follow-up plan: ${handlerResult.followUpActions.join(' ')}`,
    })

    return handlerResult.taskDraft
  }

  state.handlerResult = {
    handler: state.supervisor?.handler ?? 'ignore',
    summary: 'No specialized handler override was applied; using default task draft.',
    followUpActions: [],
  }

  return buildTaskDraft(event, state.context)
}

export class LangGraphV1Runner {
  constructor(private readonly deps: GraphRunnerDependencies) {}

  async run(input: RunEventGraphInput): Promise<ApiEnvelope<LabAgentStateDTO>> {
    const state = buildInitialState(input)
    const fallbackRecommendation = buildRecommendationBundle(input.event, state.context)
    const recommendationResult = await this.deps.services.generateRecommendationBundle(
      input.event,
      state.context,
      fallbackRecommendation,
    )
    const recommendation = recommendationResult.content

    const openTasks = this.deps.services
      .listTasks()
      .filter((task) => task.status !== 'done' && task.status !== 'closed')

    const ruleResult: RuleEvaluationResponse = evaluateRuleGate(
      {
        event: input.event,
        context: state.context,
      },
      openTasks.map((task) => ({
        ...task,
        summary: task.summary,
        recommendation: task.recommendation,
        metadata: task.metadata,
      })),
    )

    state.decision = ruleResult.decision
    state.supervisor = routeSupervisor(input.event, state.decision, state.context)
    state.logs.push({
      actionType: 'task_status_changed',
      reasonCodes: state.decision.reasonCodes,
      detail: `Rule gate routed event to ${state.decision.route ?? 'ignore'} with risk ${input.event.riskLevel}.`,
    })
    state.logs.push({
      actionType: 'task_status_changed',
      reasonCodes: state.decision.reasonCodes,
      detail: `Supervisor assigned ${state.supervisor.handler} on ${state.supervisor.queue} queue. ${state.supervisor.reason}`,
    })

    if (!state.decision.isValidEvent || state.decision.dedupeHit || !state.decision.shouldCreateTask) {
      state.output = {
        status: 'ignored',
        summary: buildGraphOutputSummary('ignored', input.event, undefined, undefined, recommendation),
      }
      return { data: state }
    }

    const taskDraft = runSpecializedHandler(input.event, state)
    taskDraft.summary = `${recommendation.reason} ${recommendation.riskSummary}`
    taskDraft.recommendation = recommendation.actionSummary
    state.taskDraft = taskDraft
    state.logs.push({
      actionType: 'task_created',
      reasonCodes: state.decision.reasonCodes,
      detail: `Task draft created by ${state.supervisor?.handler ?? 'unknown_handler'}. Reason: ${recommendation.reason} Risk: ${recommendation.riskSummary} Action: ${recommendation.actionSummary}`,
    })

    const createTaskRequest = buildCreateTaskRequest(input.event, taskDraft)
    createTaskRequest.metadata = {
      ...(createTaskRequest.metadata ?? {}),
      llmUsed: recommendationResult.meta.llmUsed,
      llmFallbackReason: recommendationResult.meta.fallbackReason,
      llmProvider: recommendationResult.meta.provider,
      llmModel: recommendationResult.meta.model,
    }

    const taskResponse: CreateTaskResponse = this.deps.services.createTask(createTaskRequest, input.actor)
    const taskId = taskResponse.task.id

    state.toolResults.push({
      toolName: 'create_task',
      success: true,
      output: { taskId },
    })

    if (state.decision.requiresApproval) {
      const startedResponse = this.deps.services.updateTaskStatus(
        taskId,
        {
          transition: 'start_progress',
          detail: 'Task moved into execution context before requesting approval.',
        },
        input.actor,
      )

      state.toolResults.push({
        toolName: 'update_task_status',
        success: true,
        output: { taskId: startedResponse.task.id, status: startedResponse.task.status },
      })

      const statusResponse = this.deps.services.updateTaskStatus(
        taskId,
        {
          transition: 'request_approval',
          detail: 'Task requires supervisor approval.',
        },
        input.actor,
      )

      state.toolResults.push({
        toolName: 'update_task_status',
        success: true,
        output: { taskId: statusResponse.task.id, status: statusResponse.task.status },
      })

      state.approvalDraft = buildApprovalDraft(input.event, taskId, recommendation)
      const approvalRequest: CreateApprovalRequest = {
        taskId,
        title: state.approvalDraft.title,
        reason: state.approvalDraft.reason,
        riskLevel: state.approvalDraft.riskLevel,
        metadata: {
          graphRunId: input.runId,
          targetTempRef: state.approvalDraft.targetTempRef,
        },
      }
      const approvalResponse: CreateApprovalResponse = this.deps.services.createApproval(approvalRequest, input.actor)

      state.toolResults.push({
        toolName: 'request_approval',
        success: true,
        output: { approvalId: approvalResponse.approval.id, taskId },
      })

      state.logs.push({
        actionType: 'approval_requested',
        reasonCodes: [...state.decision.reasonCodes, 'approval_required'],
        detail: `Approval draft created. ${state.approvalDraft.reason}`,
        taskId,
        approvalId: approvalResponse.approval.id,
      })

      state.output = {
        status: 'approval_created',
        taskId,
        approvalId: approvalResponse.approval.id,
        summary: buildGraphOutputSummary('approval_created', input.event, taskId, approvalResponse.approval.id, recommendation),
      }

      return { data: state }
    }

    state.output = {
      status: 'task_created',
      taskId,
      summary: buildGraphOutputSummary('task_created', input.event, taskId, undefined, recommendation),
    }

    return { data: state }
  }
}
