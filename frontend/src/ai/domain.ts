import type {
  AIActivityLog,
  AIApproval,
  AIAssignee,
  AIEvent,
  AIReport,
  AIReportType,
  AITask,
  AITaskStatus,
} from './types'
import type { AIState, ResolveApprovalStatus } from './actions'

function nowTimestamp() {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function buildActivityLog(log: Omit<AIActivityLog, 'id' | 'timestamp'>): AIActivityLog {
  return {
    id: createId('log'),
    timestamp: nowTimestamp(),
    actorType: log.actorType ?? 'ai',
    actorName: log.actorName ?? 'AI 员工',
    ...log,
  }
}

export function defaultAssignee(event: AIEvent): AIAssignee {
  if (event.type === 'low_stock') return '采购'
  if (event.type === 'maintenance_overdue' || event.type === 'equipment_fault') return '设备管理员'
  return '实验室管理员'
}

export function taskTitleFromEvent(event: AIEvent) {
  if (event.suggestedTaskType === 'chemical_purchase') return `采购药品：${event.sourceName}`
  if (event.suggestedTaskType === 'equipment_maintenance') return `设备维护：${event.sourceName}`
  if (event.suggestedTaskType === 'equipment_repair') return `设备维修：${event.sourceName}`
  if (event.suggestedTaskType === 'restock') return `补货：${event.sourceName}`
  if (event.suggestedTaskType === 'maintenance') return `维护：${event.sourceName}`
  if (event.suggestedTaskType === 'anomaly_review') return `排查：${event.sourceName}`
  return `处理：${event.sourceName}`
}

export function getTaskBySource(tasks: AITask[], sourceType: AITask['sourceType'], sourceId: string) {
  return tasks.find((task) => task.sourceType === sourceType && task.sourceId === sourceId && task.status !== 'closed')
}

export function getEventBySource(events: AIEvent[], sourceType: AIEvent['sourceType'], sourceId: string) {
  return events.find((event) => event.sourceType === sourceType && event.sourceId === sourceId)
}

export function getTaskById(tasks: AITask[], taskId: string) {
  return tasks.find((task) => task.id === taskId)
}

export function getApprovalById(approvals: AIApproval[], approvalId: string) {
  return approvals.find((approval) => approval.id === approvalId)
}

export function buildTaskFromEvent(event: AIEvent, assignee?: AIAssignee): AITask {
  const timestamp = nowTimestamp()
  return {
    id: createId('task'),
    type: event.suggestedTaskType,
    title: taskTitleFromEvent(event),
    summary: event.summary,
    status: 'open',
    priority: event.priority,
    riskLevel: event.riskLevel,
    assignee: assignee ?? defaultAssignee(event),
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    sourceName: event.sourceName,
    dueAt: '2026-04-18 18:00',
    createdAt: timestamp,
    updatedAt: timestamp,
    recommendation: `建议优先处理 ${event.sourceName}，并在完成后补充处理记录。`,
    evidence: [`事件标题：${event.title}`, `事件摘要：${event.summary}`],
    requiresApproval: event.riskLevel === 'high',
  }
}

export function updateTaskAssignment(task: AITask, assignee: AIAssignee): AITask {
  return { ...task, assignee, updatedAt: nowTimestamp() }
}

export function updateTaskState(task: AITask, status: AITaskStatus): AITask {
  return { ...task, status, updatedAt: nowTimestamp() }
}

export function buildApprovalForTask(task: AITask): AIApproval {
  const timestamp = nowTimestamp()
  return {
    id: createId('approval'),
    taskId: task.id,
    title: `${task.title} 待审批`,
    reason: `任务“${task.title}”涉及${task.riskLevel === 'high' ? '高风险' : '中风险'}处理动作，需要人工审批确认。`,
    status: 'pending',
    riskLevel: task.riskLevel,
    createdAt: timestamp,
    updatedAt: timestamp,
    comment: '',
  }
}

export function resolveApprovalState(
  approval: AIApproval,
  status: ResolveApprovalStatus,
  comment?: string,
): AIApproval {
  return {
    ...approval,
    status,
    updatedAt: nowTimestamp(),
    comment: comment?.trim() ? comment.trim() : approval.comment,
  }
}

export function buildReport(state: AIState, type: AIReportType): AIReport {
  const pendingApprovalCount = state.approvals.filter((item) => item.status === 'pending').length
  const completedTaskCount = state.tasks.filter((item) => item.status === 'done' || item.status === 'closed').length
  const inProgressTaskCount = state.tasks.filter((item) => item.status === 'in_progress').length
  const escalatedTaskCount = state.tasks.filter((item) => item.slaStatus === 'escalated').length

  return {
    id: createId('report'),
    type,
    title:
      type === 'daily'
        ? 'AI 员工自动日报'
        : type === 'weekly'
          ? 'AI 员工自动周报'
          : 'AI 风险专题摘要',
    createdAt: nowTimestamp(),
    summary:
      type === 'daily'
        ? `当前共有 ${state.tasks.length} 个任务，待审批 ${pendingApprovalCount} 项。`
        : type === 'weekly'
          ? `本周期累计处理 ${completedTaskCount} 个任务。`
          : `当前共识别 ${state.events.length} 条风险事件，其中已升级任务 ${escalatedTaskCount} 个。`,
    highlights:
      type === 'risk_summary'
        ? [`风险事件 ${state.events.length} 条`, `已升级任务 ${escalatedTaskCount} 个`, `待审批事项 ${pendingApprovalCount} 项`]
        : [`风险事件 ${state.events.length} 条`, `未批准任务 ${inProgressTaskCount} 个`, `待审批事项 ${pendingApprovalCount} 项`],
    sections:
      type === 'daily'
        ? [
            { title: '今日巡检结论', content: `今日共识别 ${state.events.length} 条风险事件，任务与审批链路保持可追踪。` },
            { title: '待办关注点', content: `当前仍有 ${pendingApprovalCount} 项待审批，请优先处理高风险动作。` },
          ]
        : type === 'weekly'
          ? [
              { title: '周度推进', content: `本周期已完成或归档 ${completedTaskCount} 个任务，持续推进中的任务 ${inProgressTaskCount} 个。` },
              { title: '改进建议', content: '建议复盘高频异常对象，并根据实际处理节奏调整阈值与 SLA 配置。' },
            ]
          : [
              { title: '风险聚焦', content: `当前已升级任务 ${escalatedTaskCount} 个，说明部分事项已超出常规处理节奏。` },
              { title: '处置建议', content: '建议主管优先处理升级任务，并对重复风险对象启动专项复核。' },
            ],
  }
}
