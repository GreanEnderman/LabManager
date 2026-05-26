import type {
  AIEventDTO,
  DecisionStateDTO,
  DomainContextDTO,
  RuleEvaluationRequest,
  RuleEvaluationResponse,
} from '../contracts/shared'
import type { AITaskRecord } from '../domain/models'
import { findDuplicateOpenTask } from './event-generator'
import { shouldRequireApproval } from './recommendations'

function resolveRoute(event: AIEventDTO): DecisionStateDTO['route'] {
  switch (event.type) {
    case 'low_stock':
      return 'inventory'
    case 'maintenance_overdue':
      return 'maintenance'
    case 'equipment_fault':
      return 'fault'
  }
}

export function evaluateRuleGate(
  request: RuleEvaluationRequest,
  openTasks: AITaskRecord[] = [],
): RuleEvaluationResponse {
  const duplicate = findDuplicateOpenTask(request.event, openTasks)
  const requiresApproval = shouldRequireApproval(request.event, request.context)

  return {
    decision: {
      isValidEvent: true,
      dedupeHit: Boolean(duplicate),
      route: resolveRoute(request.event),
      requiresApproval,
      shouldCreateTask: !duplicate,
      shouldNotifyOnly: false,
      reasonCodes: duplicate
        ? ['event_duplicated']
        : request.event.type === 'low_stock'
          ? ['inventory_threshold_hit']
          : request.event.type === 'maintenance_overdue'
            ? ['maintenance_overdue']
            : ['equipment_fault'],
    },
  }
}

export function buildDomainContextForEvent(
  event: AIEventDTO,
  input: Partial<DomainContextDTO> = {},
): DomainContextDTO {
  return {
    chemical: event.sourceType === 'chemical' ? input.chemical : undefined,
    equipment: event.sourceType === 'equipment' ? input.equipment : undefined,
    existingOpenTask: input.existingOpenTask ?? null,
    relatedApproval: input.relatedApproval ?? null,
  }
}
