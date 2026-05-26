import type { AIEventDTO, DomainContextDTO, HandlerResultDTO, TaskDraftDTO } from '../contracts/shared'
import { buildRecommendationBundle, buildTaskDraft } from './recommendations'

function buildFollowUpActions(event: AIEventDTO): string[] {
  return [
    `Confirm the abnormal symptoms and current availability of ${event.sourceName}.`,
    `Capture operator feedback, alarm details, and recent maintenance history for ${event.sourceName}.`,
    `Decide whether ${event.sourceName} should stay in service, be isolated, or move to supervisor approval.`,
  ]
}

function resolveFaultSeverity(event: AIEventDTO, equipmentStatus: string): 'critical' | 'major' | 'minor' {
  if (event.riskLevel === 'high' || equipmentStatus === '故障' || equipmentStatus === '停用') {
    return 'critical'
  }

  if (event.priority === 'P1' || equipmentStatus === '异常') {
    return 'major'
  }

  return 'minor'
}

export function runFaultHandler(
  event: AIEventDTO,
  context: DomainContextDTO,
): HandlerResultDTO & { taskDraft: TaskDraftDTO } {
  const recommendation = buildRecommendationBundle(event, context)
  const baseTaskDraft = buildTaskDraft(event, context)
  const followUpActions = buildFollowUpActions(event)
  const equipmentStatus = String(event.metadata.status ?? context.equipment?.status ?? '异常')
  const faultSeverity = resolveFaultSeverity(event, equipmentStatus)

  return {
    handler: 'fault_handler',
    summary: `${recommendation.reason} Recommend ${faultSeverity} severity triage before deciding the next containment step.`,
    suggestedAssigneeRole: '设备管理员',
    followUpActions,
    metadata: {
      equipmentStatus,
      faultSeverity,
      requiresImmediateCheck: faultSeverity === 'critical',
      recommendedDisposition:
        faultSeverity === 'critical'
          ? 'supervisor_review'
          : faultSeverity === 'major'
            ? 'controlled_diagnosis'
            : 'routine_diagnosis',
    },
    taskDraft: {
      ...baseTaskDraft,
      assigneeRole: '设备管理员',
      summary: `${baseTaskDraft.summary} Start with symptom confirmation, impact assessment, and containment decision.`,
      recommendation: `${recommendation.actionSummary} ${followUpActions[2]}`,
    },
  }
}
