import type { AIActivityLog, AIApproval, AIEvent, AIReport, AISettings, AISLAStatus, AITask } from './types'

export interface AIOverviewStats {
  eventCount: number
  openTaskCount: number
  pendingApprovalCount: number
  overdueTaskCount: number
  escalatedTaskCount: number
  highPriorityTaskCount: number
  completedTaskCount: number
  reportCount: number
}

export interface AITaskSLAView {
  status: AISLAStatus
  label: string
  toneClassName: string
  detail: string
}

const DASHBOARD_REFERENCE_TIME = '2026-04-16 12:00'

export function getAIOverviewStats(tasks: AITask[], approvals: AIApproval[], events: AIEvent[], reports: AIReport[]): AIOverviewStats {
  const openTasks = tasks.filter((task) => task.status === 'open' || task.status === 'in_progress')
  const pendingApprovals = approvals.filter((approval) => approval.status === 'pending')
  const overdueTasks = tasks.filter(
    (task) =>
      (task.status === 'open' || task.status === 'in_progress' || task.status === 'pending_approval') &&
      task.dueAt < DASHBOARD_REFERENCE_TIME,
  )
  const highPriorityTasks = tasks.filter(
    (task) => task.priority === 'P0' && task.status !== 'done' && task.status !== 'closed',
  )
  const completedTasks = tasks.filter((task) => task.status === 'done' || task.status === 'closed')
  const escalatedTasks = tasks.filter((task) => task.slaStatus === 'escalated')

  return {
    eventCount: events.length,
    openTaskCount: openTasks.length,
    pendingApprovalCount: pendingApprovals.length,
    overdueTaskCount: overdueTasks.length,
    escalatedTaskCount: escalatedTasks.length,
    highPriorityTaskCount: highPriorityTasks.length,
    completedTaskCount: completedTasks.length,
    reportCount: reports.length,
  }
}

function statusThresholdMinutes(task: AITask, settings: AISettings) {
  if (task.status === 'open') return settings.sla.openMinutes
  if (task.status === 'in_progress') return settings.sla.inProgressMinutes
  return settings.sla.pendingApprovalMinutes
}

function parseMinutesBetween(left: string, right: string) {
  const leftDate = new Date(left.replace(' ', 'T'))
  const rightDate = new Date(right.replace(' ', 'T'))
  return Math.floor((rightDate.getTime() - leftDate.getTime()) / 60000)
}

export function getTaskSLAStatus(task: AITask, settings: AISettings, referenceTime = DASHBOARD_REFERENCE_TIME): AISLAStatus {
  if (task.status === 'done' || task.status === 'closed') {
    return 'on_track'
  }

  const overdueByDueAt = task.dueAt < referenceTime
  const overdueByThreshold = parseMinutesBetween(task.updatedAt, referenceTime) > statusThresholdMinutes(task, settings)
  const isOverdue = overdueByDueAt || overdueByThreshold
  if (!isOverdue) {
    return 'on_track'
  }

  if ((task.reminderCount ?? 0) >= settings.sla.maxReminderCountBeforeEscalation || task.slaStatus === 'escalated') {
    return 'escalated'
  }

  return 'overdue'
}

export function getTaskSLAView(task: AITask, settings: AISettings, referenceTime = DASHBOARD_REFERENCE_TIME): AITaskSLAView {
  const status = getTaskSLAStatus(task, settings, referenceTime)

  if (status === 'escalated') {
    return {
      status,
      label: '已升级',
      toneClassName: 'bg-error-container text-error',
      detail: `已催办 ${task.reminderCount ?? 0} 次，需主管关注。`,
    }
  }

  if (status === 'overdue') {
    return {
      status,
      label: '已超时',
      toneClassName: 'bg-tertiary-container text-on-tertiary-container',
      detail: `已催办 ${task.reminderCount ?? 0} 次，建议优先处理。`,
    }
  }

  return {
    status,
    label: '正常',
    toneClassName: 'bg-secondary-container text-on-secondary-container',
    detail: `当前催办 ${task.reminderCount ?? 0} 次，仍在 SLA 范围内。`,
  }
}

export function getOverdueTasks(tasks: AITask[], settings: AISettings) {
  return tasks.filter((task) => getTaskSLAStatus(task, settings) === 'overdue')
}

export function getEscalatedTasks(tasks: AITask[], settings: AISettings) {
  return tasks.filter((task) => getTaskSLAStatus(task, settings) === 'escalated')
}

export function getPendingApprovals(approvals: AIApproval[]) {
  return approvals.filter((approval) => approval.status === 'pending')
}

export function getHighPriorityTasks(tasks: AITask[]) {
  return tasks.filter((task) => task.priority === 'P0' && task.status !== 'done' && task.status !== 'closed')
}

export function getRecentActivityLogs(activityLogs: AIActivityLog[], limit = 5) {
  return activityLogs.slice(0, limit)
}

export function getTaskById(tasks: AITask[], taskId: string) {
  return tasks.find((task) => task.id === taskId)
}

export function getApprovalByTaskId(approvals: AIApproval[], taskId: string) {
  return approvals.find((approval) => approval.taskId === taskId)
}

export function getLogsByTaskId(activityLogs: AIActivityLog[], taskId?: string) {
  if (!taskId) {
    return []
  }

  return activityLogs.filter((log) => log.taskId === taskId)
}

export function getEventBySource(events: AIEvent[], sourceType: AIEvent['sourceType'], sourceId: string) {
  return events.find((event) => event.sourceType === sourceType && event.sourceId === sourceId)
}

export function getTaskBySource(tasks: AITask[], sourceType: AITask['sourceType'], sourceId: string) {
  return tasks.find((task) => task.sourceType === sourceType && task.sourceId === sourceId && task.status !== 'closed')
}
