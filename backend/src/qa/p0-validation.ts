import { createAIApplicationServices } from '../services/api-factory'
import { evaluateRuleGate } from '../ai/rule-gate'
import { generateRuleEvents, findDuplicateOpenTask } from '../ai/event-generator'
import type { AuditActor } from '../domain/types'

interface ValidationResult {
  name: string
  passed: boolean
  detail: string
}

const actor: AuditActor = {
  type: 'system',
  id: 'qa-runner',
  name: 'QA Runner',
}

function assert(condition: boolean, detail: string): { passed: boolean; detail: string } {
  return {
    passed: condition,
    detail,
  }
}

function validateTaskStateMachine(): ValidationResult[] {
  const services = createAIApplicationServices()
  const task = services.createTask(
    {
      eventId: 'event-task-flow',
      type: 'maintenance',
      title: '设备维护任务',
      summary: '验证任务状态机流转。',
      recommendation: '安排设备管理员执行维护。',
      priority: 'P1',
      riskLevel: 'medium',
      sourceType: 'equipment',
      sourceId: 'equipment-1',
      sourceName: '离心机 A',
      requiresApproval: false,
    },
    actor,
  ).task

  const start = services.updateTaskStatus(task.id, { transition: 'start_progress', detail: '开始处理' }, actor)
  const complete = services.updateTaskStatus(task.id, { transition: 'complete', detail: '处理完成' }, actor)
  const close = services.updateTaskStatus(task.id, { transition: 'close', detail: '确认关闭' }, actor)

  let invalidTransitionBlocked = false
  try {
    services.updateTaskStatus(task.id, { transition: 'start_progress', detail: '关闭后非法重开示例' }, actor)
  } catch {
    invalidTransitionBlocked = true
  }

  return [
    {
      name: '任务状态机允许合法流转',
      ...assert(
        start.task.status === 'in_progress' &&
          complete.task.status === 'done' &&
          close.task.status === 'closed',
        `Observed statuses: ${start.task.status} -> ${complete.task.status} -> ${close.task.status}`,
      ),
    },
    {
      name: '任务状态机阻止非法流转',
      ...assert(invalidTransitionBlocked, 'Closed task rejected invalid start_progress transition.'),
    },
  ]
}

function validateApprovalStateMachine(): ValidationResult[] {
  const services = createAIApplicationServices()
  const task = services.createTask(
    {
      eventId: 'event-approval-flow',
      type: 'anomaly_review',
      title: '关键设备异常排查',
      summary: '验证审批状态机流转。',
      recommendation: '先排查异常再确认是否停用。',
      priority: 'P0',
      riskLevel: 'high',
      sourceType: 'equipment',
      sourceId: 'equipment-2',
      sourceName: 'PCR 仪',
      requiresApproval: true,
    },
    actor,
  ).task

  services.updateTaskStatus(task.id, { transition: 'start_progress', detail: '开始排查' }, actor)
  const pending = services.updateTaskStatus(task.id, { transition: 'request_approval', detail: '提交审批' }, actor)
  const approval = services.createApproval(
    {
      taskId: task.id,
      title: 'PCR 仪异常处理审批',
      reason: '高风险设备异常需要主管确认。',
      riskLevel: 'high',
    },
    actor,
  )
  const processed = services.processApproval(
    approval.approval.id,
    {
      decision: 'approve',
      comment: '同意继续执行处理。',
    },
    {
      type: 'user',
      id: 'director-1',
      name: '实验室主管',
    },
  )

  return [
    {
      name: '审批状态机进入待审批',
      ...assert(
        pending.task.status === 'pending_approval' && approval.approval.status === 'pending',
        `Observed task=${pending.task.status}, approval=${approval.approval.status}`,
      ),
    },
    {
      name: '审批通过回写任务状态',
      ...assert(
        processed.approval.status === 'approved' && processed.task.status === 'in_progress',
        `Observed approval=${processed.approval.status}, task=${processed.task.status}`,
      ),
    },
  ]
}

function validateDedupeAndRuleGate(): ValidationResult[] {
  const services = createAIApplicationServices()
  const inputEvents = generateRuleEvents(
    {
      chemicals: [{ id: 'chem-1', name: '乙醇', totalQuantity: 1, threshold: 3 }],
      equipment: [{ id: 'equipment-3', name: '培养箱', status: '正常', lastMaintenanceAt: '2025-01-01' }],
    },
    {
      now: '2026-04-17T09:00:00.000Z',
      maintenanceOverdueDays: 90,
    },
  )

  const lowStockEvent = inputEvents.find((event) => event.type === 'low_stock')
  const overdueEvent = inputEvents.find((event) => event.type === 'maintenance_overdue')

  if (!lowStockEvent || !overdueEvent) {
    return [
      {
        name: '规则事件生成',
        passed: false,
        detail: 'Expected low_stock and maintenance_overdue events to be generated.',
      },
    ]
  }

  const createdTask = services.createTask(
    {
      eventId: lowStockEvent.id,
      type: 'restock',
      title: lowStockEvent.title,
      summary: lowStockEvent.summary,
      recommendation: '尽快补货',
      priority: lowStockEvent.priority,
      riskLevel: lowStockEvent.riskLevel,
      sourceType: lowStockEvent.sourceType,
      sourceId: lowStockEvent.sourceId,
      sourceName: lowStockEvent.sourceName,
      requiresApproval: false,
    },
    actor,
  ).task

  const duplicateTask = findDuplicateOpenTask(
    lowStockEvent,
    services.listTasks().map((task) => ({
      ...task,
      metadata: task.metadata,
    })),
  )

  const gateResult = evaluateRuleGate(
    {
      event: lowStockEvent,
      context: {},
    },
    services.listTasks().map((task) => ({
      ...task,
      metadata: task.metadata,
    })),
  )

  return [
    {
      name: '规则生成器输出标准事件',
      ...assert(
        inputEvents.length >= 2,
        `Generated events: ${inputEvents.map((event) => event.type).join(', ')}`,
      ),
    },
    {
      name: '判重逻辑命中未关闭同源任务',
      ...assert(
        duplicateTask?.id === createdTask.id && gateResult.decision.dedupeHit,
        `Duplicate task id=${duplicateTask?.id ?? 'none'}, dedupeHit=${String(gateResult.decision.dedupeHit)}`,
      ),
    },
  ]
}

function validateLogs(): ValidationResult[] {
  const services = createAIApplicationServices()
  const task = services.createTask(
    {
      eventId: 'event-log-flow',
      type: 'restock',
      title: '库存补货任务',
      summary: '验证日志链路。',
      recommendation: '补货并记录结果。',
      priority: 'P1',
      riskLevel: 'medium',
      sourceType: 'chemical',
      sourceId: 'chem-9',
      sourceName: '丙酮',
      requiresApproval: false,
    },
    actor,
  ).task

  services.assignTask(
    task.id,
    {
      assigneeId: 'buyer-1',
      assigneeName: '采购员 A',
      assigneeRole: '采购',
    },
    actor,
  )
  services.updateTaskStatus(task.id, { transition: 'start_progress', detail: '开始补货' }, actor)
  const detail = services.getTaskDetail(task.id)

  return [
    {
      name: '关键动作均写入日志',
      ...assert(
        detail.actions.length >= 3,
        `Observed action count=${detail.actions.length}`,
      ),
    },
    {
      name: '日志包含创建、指派、状态变化',
      ...assert(
        detail.actions.some((action) => action.actionType === 'task_created') &&
          detail.actions.some((action) => action.actionType === 'task_assigned') &&
          detail.actions.some((action) => action.actionType === 'task_status_changed'),
        `Observed action types=${detail.actions.map((action) => action.actionType).join(', ')}`,
      ),
    },
  ]
}

function runValidationSuite(): ValidationResult[] {
  return [
    ...validateTaskStateMachine(),
    ...validateApprovalStateMachine(),
    ...validateDedupeAndRuleGate(),
    ...validateLogs(),
  ]
}

const results = runValidationSuite()
const failed = results.filter((result) => !result.passed)

for (const result of results) {
  const prefix = result.passed ? '[PASS]' : '[FAIL]'
  console.log(`${prefix} ${result.name}: ${result.detail}`)
}

if (failed.length > 0) {
  console.error(`\nQA P0 validation failed with ${failed.length} failed checks.`)
  throw new Error(`QA P0 validation failed with ${failed.length} failed checks.`)
} else {
  console.log(`\nQA P0 validation passed with ${results.length} checks.`)
}
