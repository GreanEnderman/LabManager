import type { ApprovalDraftDTO, AIEventDTO, DomainContextDTO, GraphOutputDTO, TaskDraftDTO } from '../contracts/shared'
import type { RecommendationBundle } from '../services/llm-service'

function defaultAssigneeRole(event: AIEventDTO): string {
  switch (event.type) {
    case 'low_stock':
      return 'buyer'
    case 'maintenance_overdue':
      return 'equipment_manager'
    case 'equipment_fault':
      return 'equipment_manager'
  }
}

function defaultDueAt(event: AIEventDTO): string | null {
  const createdAt = new Date(event.createdAt)
  if (Number.isNaN(createdAt.getTime())) {
    return null
  }

  const days =
    event.type === 'equipment_fault'
      ? 1
      : event.type === 'maintenance_overdue'
        ? 3
        : 2

  createdAt.setUTCDate(createdAt.getUTCDate() + days)
  return createdAt.toISOString()
}

export function buildRecommendationBundle(event: AIEventDTO, context: DomainContextDTO): RecommendationBundle {
  if (event.type === 'low_stock') {
    const currentStock = String(event.metadata.currentStock ?? 'unknown')
    const threshold = String(event.metadata.threshold ?? 'unknown')

    return {
      reason: `${event.sourceName} stock is ${currentStock}, below the safety threshold ${threshold}.`,
      riskSummary:
        event.riskLevel === 'high'
          ? 'Stock is close to zero and may interrupt lab operations if not replenished immediately.'
          : 'Stock has dropped below the safety threshold and may affect upcoming experiments if not replenished soon.',
      actionSummary: `Verify ${event.sourceName} consumption and in-transit inventory, then arrange replenishment.`,
    }
  }

  if (event.type === 'maintenance_overdue') {
    const overdueDays = String(event.metadata.overdueDays ?? context.equipment?.overdueDays ?? 'unknown')

    return {
      reason: `${event.sourceName} is overdue for maintenance by ${overdueDays} days.`,
      riskSummary:
        event.riskLevel === 'high'
          ? 'The maintenance delay is significant and continued operation may increase failure or downtime risk.'
          : 'The equipment has entered an overdue maintenance window and should be serviced before risk accumulates.',
      actionSummary: `Schedule maintenance for ${event.sourceName} and update the maintenance record after completion.`,
    }
  }

  return {
    reason: `${event.sourceName} is currently in status ${String(event.metadata.status ?? context.equipment?.status ?? 'abnormal')}.`,
    riskSummary: 'The abnormal equipment state may affect safety or experiment continuity and should be reviewed first.',
    actionSummary: `Inspect the root cause for ${event.sourceName}, then decide whether to keep it running or escalate for approval.`,
  }
}

export function buildTaskDraft(
  event: AIEventDTO,
  context: DomainContextDTO,
  recommendation: RecommendationBundle = buildRecommendationBundle(event, context),
): TaskDraftDTO {
  return {
    type:
      event.type === 'low_stock'
        ? 'chemical_purchase'
        : event.type === 'maintenance_overdue'
          ? 'equipment_maintenance'
          : 'equipment_repair',
    title: event.title,
    summary: `${recommendation.reason} ${recommendation.riskSummary}`,
    recommendation: recommendation.actionSummary,
    priority: event.priority,
    riskLevel: event.riskLevel,
    assigneeRole: defaultAssigneeRole(event),
    sourceType: event.sourceType === 'system' ? 'equipment' : event.sourceType,
    sourceId: event.sourceId,
    dueAt: defaultDueAt(event),
  }
}

export function buildApprovalDraft(
  event: AIEventDTO,
  taskTempRef: string,
  recommendation: RecommendationBundle = buildRecommendationBundle(event, {}),
): ApprovalDraftDTO {
  return {
    title: `${event.sourceName} requires supervisor approval`,
    reason: `${recommendation.reason} ${recommendation.riskSummary}`,
    riskLevel: event.riskLevel,
    targetType: 'task',
    targetTempRef: taskTempRef,
  }
}

export function buildGraphOutputSummary(
  status: GraphOutputDTO['status'],
  event: AIEventDTO,
  taskId?: string,
  approvalId?: string,
  recommendation: RecommendationBundle = buildRecommendationBundle(event, {}),
): string {
  if (status === 'ignored') {
    return `Skipped ${event.sourceName}: a duplicate open task exists or the rule gate blocked execution.`
  }

  if (status === 'approval_created') {
    return `Created task ${taskId} for ${event.sourceName} and started approval ${approvalId}. Reason: ${recommendation.reason} Action: ${recommendation.actionSummary}`
  }

  if (status === 'task_created') {
    return `Created task ${taskId} for ${event.sourceName}. Reason: ${recommendation.reason} Action: ${recommendation.actionSummary}`
  }

  return `Event handling failed for ${event.sourceName}. Check graph execution logs.`
}

export function shouldRequireApproval(event: AIEventDTO, context: DomainContextDTO): boolean {
  if (event.riskLevel === 'high') {
    return true
  }

  if (event.type === 'equipment_fault' && context.equipment?.status && context.equipment.status !== 'normal') {
    return true
  }

  return false
}
