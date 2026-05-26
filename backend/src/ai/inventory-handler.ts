import type { AIEventDTO, DomainContextDTO, HandlerResultDTO, TaskDraftDTO } from '../contracts/shared'
import { buildRecommendationBundle, buildTaskDraft } from './recommendations'

function buildFollowUpActions(event: AIEventDTO): string[] {
  return [
    `核对 ${event.sourceName} 当前实物库存与系统库存是否一致。`,
    `确认 ${event.sourceName} 是否存在在途采购或待入库批次。`,
    `根据库存缺口安排补货，并回填预计到货时间。`,
  ]
}

export function runInventoryHandler(event: AIEventDTO, context: DomainContextDTO): HandlerResultDTO & { taskDraft: TaskDraftDTO } {
  const recommendation = buildRecommendationBundle(event, context)
  const baseTaskDraft = buildTaskDraft(event, context)
  const followUpActions = buildFollowUpActions(event)
  const currentStock = Number(event.metadata.currentStock ?? context.chemical?.currentStock ?? 0)
  const threshold = Number(event.metadata.threshold ?? context.chemical?.threshold ?? 0)
  const shortage = Math.max(0, threshold - currentStock)

  return {
    handler: 'inventory_handler',
    summary: `${recommendation.reason} 建议优先补齐至少 ${shortage || 1} 个单位的库存缓冲。`,
    suggestedAssigneeRole: '采购',
    followUpActions,
    metadata: {
      shortageQuantity: shortage,
      currentStock,
      threshold,
      replenishmentPriority: event.priority,
    },
    taskDraft: {
      ...baseTaskDraft,
      assigneeRole: '采购',
      summary: `${baseTaskDraft.summary} 建议先核对在途库存，再按缺口安排补货。`,
      recommendation: `${recommendation.actionSummary} ${followUpActions[2]}`,
    },
  }
}
