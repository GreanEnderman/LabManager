import type { AIEventDTO, DecisionStateDTO, DomainContextDTO, SupervisorDecisionDTO } from '../contracts/shared'

function resolveQueue(event: AIEventDTO): SupervisorDecisionDTO['queue'] {
  if (event.priority === 'P0' || event.riskLevel === 'high') {
    return 'urgent'
  }

  if (event.priority === 'P1' || event.riskLevel === 'medium') {
    return 'priority'
  }

  return 'routine'
}

function resolveEscalationTarget(
  event: AIEventDTO,
  decision: DecisionStateDTO,
): SupervisorDecisionDTO['escalationTarget'] {
  if (decision.requiresApproval || event.riskLevel === 'high') {
    return 'supervisor'
  }

  if (event.type === 'equipment_fault' || event.type === 'maintenance_overdue') {
    return 'equipment_manager'
  }

  if (event.type === 'low_stock') {
    return 'buyer'
  }

  return null
}

function buildReason(event: AIEventDTO, decision: DecisionStateDTO, context: DomainContextDTO): string {
  if (decision.dedupeHit) {
    const taskId = context.existingOpenTask?.id ?? 'unknown-task'
    return `Detected duplicate open task ${taskId}; supervisor will skip new task creation.`
  }

  if (decision.shouldNotifyOnly) {
    return `Event ${event.type} is configured for notification only and will not create a new task.`
  }

  if (event.type === 'low_stock') {
    return `Route inventory issue to restock workflow because ${event.sourceName} is below threshold.`
  }

  if (event.type === 'maintenance_overdue') {
    return `Route maintenance issue because ${event.sourceName} has exceeded the maintenance window.`
  }

  return `Route fault issue because ${event.sourceName} is in abnormal equipment status.`
}

export function routeSupervisor(
  event: AIEventDTO,
  decision: DecisionStateDTO,
  context: DomainContextDTO,
): SupervisorDecisionDTO {
  if (!decision.isValidEvent || decision.route === 'ignore') {
    return {
      handler: 'ignore',
      queue: 'background',
      reason: 'Event was marked invalid or ignored by the rule gate.',
      escalationTarget: null,
    }
  }

  if (decision.dedupeHit || decision.shouldNotifyOnly) {
    return {
      handler: decision.shouldNotifyOnly ? 'notify_only' : 'ignore',
      queue: decision.shouldNotifyOnly ? 'background' : 'routine',
      reason: buildReason(event, decision, context),
      escalationTarget: decision.requiresApproval ? 'supervisor' : null,
    }
  }

  return {
    handler:
      decision.route === 'inventory'
        ? 'inventory_handler'
        : decision.route === 'maintenance'
          ? 'maintenance_handler'
          : 'fault_handler',
    queue: resolveQueue(event),
    reason: buildReason(event, decision, context),
    escalationTarget: resolveEscalationTarget(event, decision),
  }
}
