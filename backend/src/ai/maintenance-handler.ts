import type { AIEventDTO, DomainContextDTO, HandlerResultDTO, TaskDraftDTO } from '../contracts/shared'
import { buildRecommendationBundle, buildTaskDraft } from './recommendations'

function buildFollowUpActions(event: AIEventDTO): string[] {
  return [
    `核对 ${event.sourceName} 最近一次维护记录与计划维护窗口。`,
    `安排维护负责人确认停机时间、备件和维护顺序。`,
    `维护完成后回填维护记录，并确认设备恢复可用状态。`,
  ]
}

function resolveMaintenancePriority(event: AIEventDTO, overdueDays: number): 'urgent' | 'high' | 'normal' {
  if (event.riskLevel === 'high' || overdueDays >= 14) {
    return 'urgent'
  }

  if (event.priority === 'P1' || overdueDays >= 7) {
    return 'high'
  }

  return 'normal'
}

export function runMaintenanceHandler(
  event: AIEventDTO,
  context: DomainContextDTO,
): HandlerResultDTO & { taskDraft: TaskDraftDTO } {
  const recommendation = buildRecommendationBundle(event, context)
  const baseTaskDraft = buildTaskDraft(event, context)
  const followUpActions = buildFollowUpActions(event)
  const overdueDays = Number(event.metadata.overdueDays ?? context.equipment?.overdueDays ?? 0)
  const maintenancePriority = resolveMaintenancePriority(event, overdueDays)

  return {
    handler: 'maintenance_handler',
    summary: `${recommendation.reason} 建议按 ${maintenancePriority} 级维护优先级排期，并尽快锁定维护窗口。`,
    suggestedAssigneeRole: '设备管理员',
    followUpActions,
    metadata: {
      overdueDays,
      maintenancePriority,
      recommendedWindow: maintenancePriority === 'urgent' ? '24h' : maintenancePriority === 'high' ? '72h' : '5d',
    },
    taskDraft: {
      ...baseTaskDraft,
      assigneeRole: '设备管理员',
      summary: `${baseTaskDraft.summary} 需优先确认维护窗口、停机影响和记录回填。`,
      recommendation: `${recommendation.actionSummary} ${followUpActions[2]}`,
    },
  }
}
