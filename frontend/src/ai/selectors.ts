import type {
  AIActivityLog,
  AIApproval,
  AIEvent,
  AIReport,
  AISettings,
  AISLAStatus,
  AITask,
  ReportDeliveryRecord,
} from './types'

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
  const openTasks = tasks.filter((task) => task.status === 'open')
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

export type NotificationCategory = 'approval' | 'report' | 'delivery' | 'sla' | 'event' | 'activity'
export type NotificationSeverity = 'critical' | 'warning' | 'info' | 'success'

export interface NotificationItem {
  id: string
  category: NotificationCategory
  severity: NotificationSeverity
  title: string
  message: string
  createdAt: string
  sourceLabel: string
  actionLabel?: string
  actionHref?: string
}

const severityRank: Record<NotificationSeverity, number> = {
  critical: 4,
  warning: 3,
  info: 2,
  success: 1,
}

function reportTypeLabel(type: AIReport['type']) {
  if (type === 'daily') return '日报'
  if (type === 'weekly') return '周报'
  return '风险专题'
}

export function getNotificationItems(
  tasks: AITask[],
  approvals: AIApproval[],
  events: AIEvent[],
  reports: AIReport[],
  reportDeliveryRecords: ReportDeliveryRecord[],
  activityLogs: AIActivityLog[],
): NotificationItem[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const reportById = new Map(reports.map((report) => [report.id, report]))
  const notifications: NotificationItem[] = []

  approvals.forEach((approval) => {
    const task = taskById.get(approval.taskId)
    if (approval.status === 'pending') {
      notifications.push({
        id: `approval:${approval.id}`,
        category: 'approval',
        severity: approval.riskLevel === 'high' ? 'critical' : 'warning',
        title: '有新的审批待处理',
        message: task ? `${approval.title}，关联任务：${task.title}` : approval.reason,
        createdAt: approval.createdAt,
        sourceLabel: approval.riskLevel === 'high' ? '高风险审批' : '审批',
        actionLabel: '去审批',
        actionHref: `/ai-workbench?tab=approvals&approvalId=${approval.id}`,
      })
    }

    if (approval.status === 'needs_info') {
      notifications.push({
        id: `approval-needs-info:${approval.id}`,
        category: 'approval',
        severity: 'warning',
        title: '审批需要补充信息',
        message: approval.comment || approval.reason,
        createdAt: approval.updatedAt,
        sourceLabel: '审批退回',
        actionLabel: '查看审批',
        actionHref: `/ai-workbench?tab=approvals&approvalId=${approval.id}`,
      })
    }
  })

  tasks.forEach((task) => {
    if (task.slaStatus === 'escalated') {
      notifications.push({
        id: `sla-escalated:${task.id}`,
        category: 'sla',
        severity: 'critical',
        title: '任务已升级',
        message: `${task.title} 已催办 ${task.reminderCount ?? 0} 次，需要主管关注。`,
        createdAt: task.updatedAt,
        sourceLabel: 'SLA 升级',
        actionLabel: '看任务',
        actionHref: `/ai-workbench?tab=tasks&taskId=${task.id}`,
      })
      return
    }

    if (task.slaStatus === 'overdue') {
      notifications.push({
        id: `sla-overdue:${task.id}`,
        category: 'sla',
        severity: 'warning',
        title: '任务即将或已经超时',
        message: `${task.title} 当前负责人：${task.assignee}，截止时间：${task.dueAt}`,
        createdAt: task.updatedAt,
        sourceLabel: 'SLA 催办',
        actionLabel: '看任务',
        actionHref: `/ai-workbench?tab=tasks&taskId=${task.id}`,
      })
    }
  })

  reports.slice(0, 12).forEach((report) => {
    notifications.push({
      id: `report:${report.id}`,
      category: 'report',
      severity: 'success',
      title: `${reportTypeLabel(report.type)}已生成`,
      message: report.summary,
      createdAt: report.createdAt,
      sourceLabel: '报告生成',
      actionLabel: '看报告',
      actionHref: `/ai-workbench?tab=reports&reportId=${report.id}`,
    })
  })

  reportDeliveryRecords.slice(0, 20).forEach((record) => {
    const report = reportById.get(record.reportId)
    notifications.push({
      id: `delivery:${record.id}`,
      category: 'delivery',
      severity: record.status === 'success' ? 'success' : 'critical',
      title: record.status === 'success' ? '报告已发送' : '报告发送失败',
      message:
        record.status === 'success'
          ? `${record.reportTitle} 已发送给 ${record.recipientName}（${record.recipientEmail}）。`
          : `${record.reportTitle} 发送给 ${record.recipientName} 失败：${record.errorMessage ?? '未记录失败原因'}`,
      createdAt: record.sentAt || record.createdAt,
      sourceLabel: report ? reportTypeLabel(report.type) : '报告投递',
      actionLabel: '查看投递',
      actionHref: '/settings?tab=delivery',
    })
  })

  events
    .filter((event) => event.priority === 'P0' || event.riskLevel === 'high')
    .slice(0, 12)
    .forEach((event) => {
      notifications.push({
        id: `event:${event.id}`,
        category: 'event',
        severity: event.riskLevel === 'high' ? 'critical' : 'warning',
        title: '高优先级事件',
        message: `${event.title}：${event.summary}`,
        createdAt: event.createdAt,
        sourceLabel: event.sourceName,
        actionLabel: '去工作台',
        actionHref: '/ai-workbench',
      })
    })

  activityLogs
    .filter((log) => log.action.includes('失败') || log.action.includes('告警') || log.action.includes('催办'))
    .slice(0, 8)
    .forEach((log) => {
      notifications.push({
        id: `activity:${log.id}`,
        category: 'activity',
        severity: log.action.includes('失败') || log.action.includes('告警') ? 'critical' : 'info',
        title: log.action,
        message: log.detail,
        createdAt: log.timestamp,
        sourceLabel: log.actorName ?? '活动日志',
        actionLabel: log.approvalId ? '看审批' : log.taskId ? '看任务' : undefined,
        actionHref: log.approvalId
          ? `/ai-workbench?tab=approvals&approvalId=${log.approvalId}`
          : log.taskId
            ? `/ai-workbench?tab=tasks&taskId=${log.taskId}`
            : undefined,
      })
    })

  return notifications
    .sort((left, right) => {
      const severityDiff = severityRank[right.severity] - severityRank[left.severity]
      if (severityDiff !== 0) return severityDiff
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    })
    .slice(0, 80)
}
