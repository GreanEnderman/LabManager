import type {
  AIEventDTO,
  DomainContextDTO,
  ExecuteReportingAgentRequest,
  ExecuteReportingAgentResponse,
  ExecuteRuleEventRequest,
  ExecuteRuleEventResponse,
  ExecuteTaskTrackingAgentRequest,
  ExecuteTaskTrackingAgentResponse,
  InspectRulesRequest,
  InspectRulesResponse,
  RuleEvaluationRequest,
  RuleEvaluationResponse,
} from '../contracts/shared'
import type { EventGenerationConfig, EventGenerationInput } from '../ai/business-types'
import { generateRuleEvents, findDuplicateOpenTask } from '../ai/event-generator'
import { createLangGraphV1Runner, createReportingAgentRunner, createTaskTrackingAgentRunner } from '../ai/graph-factory'
import { buildDomainContextForEvent, evaluateRuleGate } from '../ai/rule-gate'
import type { AIApplicationServices } from './api-factory'

export interface RuleEngineServiceDependencies {
  services: Pick<
    AIApplicationServices,
    | 'listTasks'
    | 'createTask'
    | 'updateTaskStatus'
    | 'createApproval'
    | 'inspectTaskSLA'
    | 'executeTaskSLA'
    | 'generateReport'
    | 'generateRecommendationBundle'
  >
}

function getSourceContextKey(event: AIEventDTO) {
  return `${event.sourceType}:${event.sourceId}`
}

export class RuleEngineService {
  constructor(private readonly deps: RuleEngineServiceDependencies) {}

  generateEvents(input: EventGenerationInput, config: EventGenerationConfig): AIEventDTO[] {
    return generateRuleEvents(input, config)
  }

  evaluateEvent(
    request: RuleEvaluationRequest,
    context?: {
      openTasks?: ReturnType<AIApplicationServices['listTasks']>
    },
  ): RuleEvaluationResponse & { duplicateTaskId: string | null } {
    const openTasks = (context?.openTasks ?? this.deps.services.listTasks()).filter(
      (task) => task.status !== 'done' && task.status !== 'closed',
    )
    const duplicate = findDuplicateOpenTask(
      request.event,
      openTasks.map((task) => ({
        ...task,
        metadata: task.metadata,
        summary: task.summary,
        recommendation: task.recommendation,
      })),
    )

    const mergedContext: DomainContextDTO = {
      ...request.context,
      existingOpenTask: duplicate
        ? {
            id: duplicate.id,
            status: duplicate.status,
            assigneeId: duplicate.assigneeId,
            assigneeName: duplicate.assigneeName,
          }
        : request.context.existingOpenTask ?? null,
    }

    const result = evaluateRuleGate(
      {
        event: request.event,
        context: mergedContext,
      },
      openTasks.map((task) => ({
        ...task,
        metadata: task.metadata,
        summary: task.summary,
        recommendation: task.recommendation,
      })),
    )

    return {
      ...result,
      duplicateTaskId: duplicate?.id ?? null,
    }
  }

  inspectRules(request: InspectRulesRequest): InspectRulesResponse {
    const events = this.generateEvents(request.input, request.config)
    const openTasks = this.deps.services
      .listTasks()
      .filter((task) => task.status !== 'done' && task.status !== 'closed')

    return {
      items: events.map((event) => {
        const sourceKey = getSourceContextKey(event)
        const baseContext = request.contextBySource?.[sourceKey] ?? {}
        const context = buildDomainContextForEvent(event, baseContext)
        const evaluation = this.evaluateEvent(
          {
            event,
            context,
          },
          { openTasks },
        )

        return {
          event,
          context: {
            ...context,
            existingOpenTask: evaluation.duplicateTaskId
              ? context.existingOpenTask ?? {
                  id: evaluation.duplicateTaskId,
                  status: 'open',
                }
              : context.existingOpenTask ?? null,
          },
          decision: evaluation.decision,
          duplicateTaskId: evaluation.duplicateTaskId,
        }
      }),
    }
  }

  async executeRuleEvent(request: ExecuteRuleEventRequest): Promise<ExecuteRuleEventResponse> {
    const runner = createLangGraphV1Runner(this.deps.services as AIApplicationServices)
    const result = await runner.run(request)

    return {
      state: result.data,
    }
  }

  executeTaskTrackingAgent(request: ExecuteTaskTrackingAgentRequest): ExecuteTaskTrackingAgentResponse {
    const runner = createTaskTrackingAgentRunner(this.deps.services as AIApplicationServices)
    return runner.run(request)
  }

  async executeReportingAgent(request: ExecuteReportingAgentRequest): Promise<ExecuteReportingAgentResponse> {
    const runner = createReportingAgentRunner(this.deps.services as AIApplicationServices)
    return await runner.run(request)
  }
}
