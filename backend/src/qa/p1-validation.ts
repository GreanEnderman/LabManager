import { createAIApplicationServices } from '../services/api-factory'
import type { AuditActor } from '../domain/types'

interface ValidationResult {
  name: string
  passed: boolean
  detail: string
}

const actor: AuditActor = {
  type: 'system',
  id: 'qa-p1-runner',
  name: 'QA P1 Runner',
}

function assert(condition: boolean, detail: string): { passed: boolean; detail: string } {
  return {
    passed: condition,
    detail,
  }
}

function validateRuleEngineInspection(): ValidationResult[] {
  const services = createAIApplicationServices()
  const settings = services.getSystemSettings()

  const inspection = services.inspectRules({
    input: {
      chemicals: [
        { id: 'chem-p1-1', name: '无水乙醇', totalQuantity: 1, threshold: 3 },
      ],
      equipment: [
        { id: 'eq-p1-1', name: '离心机 B', status: '故障', lastMaintenanceAt: '2025-01-01' },
      ],
    },
    config: {
      now: '2026-04-17T10:00:00.000Z',
      maintenanceOverdueDays: settings.thresholds.maintenanceOverdueDays,
    },
  })

  const eventTypes = inspection.items.map((item) => item.event.type)
  const lowStockItem = inspection.items.find((item) => item.event.type === 'low_stock')
  const faultItem = inspection.items.find((item) => item.event.type === 'equipment_fault')

  return [
    {
      name: '规则服务识别三类主事件中的命中项',
      ...assert(
        eventTypes.includes('low_stock') &&
          eventTypes.includes('maintenance_overdue') &&
          eventTypes.includes('equipment_fault'),
        `Observed event types: ${eventTypes.join(', ')}`,
      ),
    },
    {
      name: '规则服务对低库存事件给出 inventory 路由',
      ...assert(
        lowStockItem?.decision.route === 'inventory' && lowStockItem.decision.shouldCreateTask,
        `Observed route=${lowStockItem?.decision.route ?? 'none'}, create=${String(lowStockItem?.decision.shouldCreateTask)}`,
      ),
    },
    {
      name: '规则服务对故障设备命中审批门禁',
      ...assert(
        faultItem?.decision.route === 'fault' && faultItem.decision.requiresApproval,
        `Observed route=${faultItem?.decision.route ?? 'none'}, approval=${String(faultItem?.decision.requiresApproval)}`,
      ),
    },
  ]
}

async function validateRuleEngineExecutionAndDedupe(): Promise<ValidationResult[]> {
  const services = createAIApplicationServices()

  const firstRun = await services.executeRuleEvent({
    runId: 'graph-run-1',
    actor,
    event: {
      id: 'event-low-stock-exec',
      type: 'low_stock',
      sourceType: 'chemical',
      sourceId: 'chem-p1-dup',
      sourceName: '甲醇',
      title: '甲醇库存偏低',
      summary: '库存低于阈值，建议补货。',
      priority: 'P1',
      riskLevel: 'medium',
      evidence: [{ kind: 'metric', label: 'currentStock', value: '1' }],
      metadata: {},
      createdAt: '2026-04-17T10:00:00.000Z',
    },
  })

  const secondInspection = services.inspectRules({
    input: {
      chemicals: [{ id: 'chem-p1-dup', name: '甲醇', totalQuantity: 1, threshold: 5 }],
    },
    config: {
      now: '2026-04-17T10:30:00.000Z',
      maintenanceOverdueDays: 30,
    },
  })
  const secondLowStock = secondInspection.items.find((item) => item.event.sourceId === 'chem-p1-dup')

  return [
    {
      name: '规则执行入口可创建任务',
      ...assert(
        firstRun.state.output?.status === 'task_created' && Boolean(firstRun.state.output.taskId),
        `Observed status=${firstRun.state.output?.status ?? 'none'}, taskId=${firstRun.state.output?.taskId ?? 'none'}`,
      ),
    },
    {
      name: '规则巡检在已存在未关闭任务时命中判重',
      ...assert(
        secondLowStock?.decision.dedupeHit === true && secondLowStock.duplicateTaskId === firstRun.state.output?.taskId,
        `Observed dedupe=${String(secondLowStock?.decision.dedupeHit)}, duplicateTaskId=${secondLowStock?.duplicateTaskId ?? 'none'}`,
      ),
    },
  ]
}

async function validateFaultHandlerExecution(): Promise<ValidationResult[]> {
  const services = createAIApplicationServices()

  const result = await services.executeRuleEvent({
    runId: 'graph-run-fault-1',
    actor,
    event: {
      id: 'event-fault-handler',
      type: 'equipment_fault',
      sourceType: 'equipment',
      sourceId: 'eq-fault-1',
      sourceName: '离心机 C',
      title: '离心机状态异常',
      summary: '设备当前处于故障状态，需要人工排查。',
      priority: 'P0',
      riskLevel: 'high',
      evidence: [{ kind: 'text', label: 'status', value: '故障' }],
      metadata: {
        status: '故障',
      },
      createdAt: '2026-04-17T11:00:00.000Z',
    },
  })

  return [
    {
      name: '故障设备事件会进入 fault handler 并产出审批链路',
      ...assert(
        result.state.supervisor?.handler === 'fault_handler' &&
          result.state.handlerResult?.handler === 'fault_handler' &&
          result.state.output?.status === 'approval_created',
        `Observed supervisor=${result.state.supervisor?.handler ?? 'none'}, handler=${result.state.handlerResult?.handler ?? 'none'}, status=${result.state.output?.status ?? 'none'}`,
      ),
    },
  ]
}

function validateSLAInspectionAndExecution(): ValidationResult[] {
  const services = createAIApplicationServices()
  const settings = services.getSystemSettings()
  const qaSLAConfig = {
    ...settings.sla,
    openMinutes: 0,
    inProgressMinutes: 0,
    pendingApprovalMinutes: 0,
  }

  const reminderTask = services.createTask(
    {
      eventId: 'event-sla-reminder',
      type: 'maintenance',
      title: 'SLA 提醒测试任务',
      summary: '用于验证提醒逻辑。',
      recommendation: '请尽快处理。',
      priority: 'P1',
      riskLevel: 'medium',
      sourceType: 'equipment',
      sourceId: 'eq-sla-1',
      sourceName: '恒温箱',
      requiresApproval: false,
      metadata: {},
    },
    actor,
  ).task

  const escalationTask = services.createTask(
    {
      eventId: 'event-sla-escalation',
      type: 'anomaly_review',
      title: 'SLA 升级测试任务',
      summary: '用于验证升级逻辑。',
      recommendation: '需要尽快升级处理。',
      priority: 'P0',
      riskLevel: 'high',
      sourceType: 'equipment',
      sourceId: 'eq-sla-2',
      sourceName: 'PCR 仪 C',
      requiresApproval: true,
      metadata: {
        slaReminderCount: qaSLAConfig.maxReminderCountBeforeEscalation,
      },
    },
    actor,
  ).task

  const inspection = services.inspectTaskSLA({
    now: '2026-04-17T10:00:00.000Z',
    config: qaSLAConfig,
  })

  const execution = services.executeTaskSLA({
    now: '2026-04-17T10:00:00.000Z',
    config: qaSLAConfig,
    actor,
  })

  const reminderDetail = services.getTaskDetail(reminderTask.id)
  const escalationDetail = services.getTaskDetail(escalationTask.id)

  return [
    {
      name: 'SLA 巡检能识别超时任务',
      ...assert(
        inspection.items.length >= 2,
        `Observed SLA items=${inspection.items.length}`,
      ),
    },
    {
      name: 'SLA 执行会生成提醒日志',
      ...assert(
        execution.reminders.some((item) => item.taskId === reminderTask.id) &&
          reminderDetail.actions.some((item) => item.actionType === 'sla_reminder_sent'),
        `Observed reminder actions=${reminderDetail.actions.map((item) => item.actionType).join(', ')}`,
      ),
    },
    {
      name: 'SLA 执行会生成升级日志',
      ...assert(
        execution.escalations.some((item) => item.taskId === escalationTask.id) &&
          escalationDetail.actions.some((item) => item.actionType === 'task_escalated') &&
          escalationDetail.task.metadata.slaEscalated === true,
        `Observed escalation actions=${escalationDetail.actions.map((item) => item.actionType).join(', ')}`,
      ),
    },
  ]
}

function validateTaskTrackingAgentExecution(): ValidationResult[] {
  const services = createAIApplicationServices()
  const settings = services.getSystemSettings()
  const qaSLAConfig = {
    ...settings.sla,
    openMinutes: 0,
    inProgressMinutes: 0,
    pendingApprovalMinutes: 0,
  }

  const trackedTask = services.createTask(
    {
      eventId: 'event-task-tracking-1',
      type: 'maintenance',
      title: 'Task Tracking Agent 测试任务',
      summary: '用于验证独立 Task Tracking Agent 编排入口。',
      recommendation: '请触发 SLA 巡检。',
      priority: 'P1',
      riskLevel: 'medium',
      sourceType: 'equipment',
      sourceId: 'eq-tracking-1',
      sourceName: '冷冻离心机 D',
      requiresApproval: false,
      metadata: {},
    },
    actor,
  ).task

  const result = services.executeTaskTrackingAgent({
    runId: 'task-tracking-run-1',
    now: '2026-04-17T12:00:00.000Z',
    actor,
    config: qaSLAConfig,
  })

  const detail = services.getTaskDetail(trackedTask.id)

  return [
    {
      name: 'Task Tracking Agent 可独立执行 SLA 巡检编排',
      ...assert(
        result.state.output.status === 'completed' &&
          result.state.inspection.items.length >= 1 &&
          result.state.logs.length === 3,
        `Observed status=${result.state.output.status}, inspected=${result.state.inspection.items.length}, logs=${result.state.logs.length}`,
      ),
    },
    {
      name: 'Task Tracking Agent 会写入提醒或升级结果',
      ...assert(
        result.state.output.reminderCount + result.state.output.escalationCount >= 1 &&
          detail.actions.some((item) => item.actionType === 'sla_reminder_sent' || item.actionType === 'task_escalated'),
        `Observed reminders=${result.state.output.reminderCount}, escalations=${result.state.output.escalationCount}, actions=${detail.actions.map((item) => item.actionType).join(', ')}`,
      ),
    },
  ]
}

async function validateReportingAgentExecution(): Promise<ValidationResult[]> {
  const services = createAIApplicationServices()

  services.createTask(
    {
      eventId: 'event-reporting-1',
      type: 'restock',
      title: 'Reporting Agent 测试任务',
      summary: '用于验证 Reporting Agent 的报告生成入口。',
      recommendation: '请生成日报。',
      priority: 'P1',
      riskLevel: 'medium',
      sourceType: 'chemical',
      sourceId: 'chem-report-1',
      sourceName: '乙醇',
      requiresApproval: false,
      metadata: {},
    },
    actor,
  )

  const result = await services.executeReportingAgent({
    runId: 'reporting-run-1',
    now: '2026-04-17T13:00:00.000Z',
    actor,
    type: 'daily',
  })

  const reports = services.listReports({ type: 'daily' })

  return [
    {
      name: 'Reporting Agent 可独立执行报告生成编排',
      ...assert(
        result.state.output.status === 'completed' &&
          result.state.report.type === 'daily' &&
          result.state.logs.length === 2,
        `Observed status=${result.state.output.status}, type=${result.state.report.type}, logs=${result.state.logs.length}`,
      ),
    },
    {
      name: 'Reporting Agent 会落库报告并返回摘要',
      ...assert(
        reports.some((item) => item.id === result.state.output.reportId) &&
          result.state.output.summary.includes(result.state.output.reportId),
        `Observed reportId=${result.state.output.reportId}, reports=${reports.map((item) => item.id).join(', ')}`,
      ),
    },
  ]
}

function validateImportExecutionAndHistory(): ValidationResult[] {
  const services = createAIApplicationServices()

  const importResult = services.importChemicals({
    source: 'excel',
    fileName: 'chemicals.xlsx',
    importedBy: actor,
    rows: [
      {
        recordId: 'chem-import-1',
        name: '乙醇',
        category: '化学品',
        spec: '500ml',
        currentQuantity: 2,
        threshold: 5,
        labName: '分析实验室',
      },
      {
        recordId: 'chem-import-1',
        name: '乙醇',
        currentQuantity: 4,
        threshold: 5,
        labName: '分析实验室',
      },
    ],
  })

  const history = services.listImportBatches({ entityType: 'chemical' })
  const detail = services.getImportBatchDetail(importResult.batch.id)

  return [
    {
      name: '导入服务会返回成功/失败统计和错误清单',
      ...assert(
        importResult.batch.successCount === 1 &&
          importResult.batch.failureCount === 1 &&
          importResult.batch.errors.some((item) => item.code === 'duplicate_record'),
        `Observed success=${importResult.batch.successCount}, failure=${importResult.batch.failureCount}, errors=${importResult.batch.errors.map((item) => item.code).join(', ')}`,
      ),
    },
    {
      name: '导入服务会触发规则巡检并记录事件数量',
      ...assert(
        importResult.batch.ruleInspectionTriggered === true &&
          importResult.batch.generatedEventCount >= 1,
        `Observed triggered=${String(importResult.batch.ruleInspectionTriggered)}, events=${importResult.batch.generatedEventCount}`,
      ),
    },
    {
      name: '导入历史可追溯到批次和成功入库记录',
      ...assert(
        history.some((item) => item.id === importResult.batch.id) &&
          detail.chemicals.length === 1 &&
          detail.batch.importedRecordIds.includes('chem-import-1'),
        `Observed history=${history.length}, detailRecords=${detail.chemicals.length}`,
      ),
    },
  ]
}

async function runValidationSuite(): Promise<ValidationResult[]> {
  return [
    ...validateRuleEngineInspection(),
    ...(await validateRuleEngineExecutionAndDedupe()),
    ...(await validateFaultHandlerExecution()),
    ...validateSLAInspectionAndExecution(),
    ...validateTaskTrackingAgentExecution(),
    ...(await validateReportingAgentExecution()),
    ...validateImportExecutionAndHistory(),
  ]
}

void runValidationSuite().then((results) => {
  const failed = results.filter((result) => !result.passed)

  for (const result of results) {
    const prefix = result.passed ? '[PASS]' : '[FAIL]'
    console.log(`${prefix} ${result.name}: ${result.detail}`)
  }

  if (failed.length > 0) {
    console.error(`\nQA P1 validation failed with ${failed.length} failed checks.`)
    throw new Error(`QA P1 validation failed with ${failed.length} failed checks.`)
  } else {
    console.log(`\nQA P1 validation passed with ${results.length} checks.`)
  }
})
