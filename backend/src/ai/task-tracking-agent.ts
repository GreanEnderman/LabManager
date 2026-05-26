import type {
  ExecuteTaskTrackingAgentRequest,
  ExecuteTaskTrackingAgentResponse,
  TaskTrackingAgentStateDTO,
} from '../contracts/shared'
import type { AIApplicationServices } from '../services/api-factory'

export interface TaskTrackingAgentDependencies {
  services: Pick<AIApplicationServices, 'inspectTaskSLA' | 'executeTaskSLA'>
}

function buildSummary(reminderCount: number, escalationCount: number) {
  if (reminderCount === 0 && escalationCount === 0) {
    return 'Task tracking agent completed with no reminder or escalation actions.'
  }

  return `Task tracking agent completed with ${reminderCount} reminders and ${escalationCount} escalations.`
}

export class TaskTrackingAgentRunner {
  constructor(private readonly deps: TaskTrackingAgentDependencies) {}

  run(input: ExecuteTaskTrackingAgentRequest): ExecuteTaskTrackingAgentResponse {
    const inspection = this.deps.services.inspectTaskSLA({
      now: input.now,
      config: input.config,
    })

    const execution = this.deps.services.executeTaskSLA({
      now: input.now,
      config: input.config,
      actor: input.actor,
    })

    const reminderCount = execution.reminders.length
    const escalationCount = execution.escalations.length

    const state: TaskTrackingAgentStateDTO = {
      runId: input.runId,
      now: input.now,
      actor: input.actor,
      inspection,
      execution,
      logs: [
        {
          step: 'inspect_sla',
          detail: `Inspected ${inspection.items.length} overdue task candidates for SLA actions.`,
        },
        {
          step: 'execute_sla',
          detail: `Executed ${reminderCount} reminders and ${escalationCount} escalations.`,
        },
        {
          step: 'summarize',
          detail: buildSummary(reminderCount, escalationCount),
        },
      ],
      output: {
        status: 'completed',
        reminderCount,
        escalationCount,
        summary: buildSummary(reminderCount, escalationCount),
      },
    }

    return { state }
  }
}
