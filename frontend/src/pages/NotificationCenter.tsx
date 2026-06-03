import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAI } from '../ai/AIStateLive'
import {
  getNotificationItems,
  type NotificationCategory,
  type NotificationItem,
  type NotificationSeverity,
} from '../ai/selectors'
import {
  markNotificationsRead,
  readNotificationReadIds,
  subscribeNotificationReadState,
} from '../notifications/state'
import { formatLocalDateTime } from '../runtime/dateTime'

const categoryMeta: Record<NotificationCategory | 'all', { label: string; icon: string }> = {
  all: { label: '全部', icon: 'inbox' },
  approval: { label: '审批提醒', icon: 'approval' },
  report: { label: '报告生成', icon: 'summarize' },
  delivery: { label: '发送提醒', icon: 'outgoing_mail' },
  sla: { label: '催办升级', icon: 'timer' },
  event: { label: '风险事件', icon: 'warning' },
  activity: { label: '活动日志', icon: 'history' },
}

const severityMeta: Record<NotificationSeverity, { label: string; className: string; dotClassName: string }> = {
  critical: {
    label: '紧急',
    className: 'bg-error-container text-error',
    dotClassName: 'bg-error',
  },
  warning: {
    label: '提醒',
    className: 'bg-tertiary-container text-on-tertiary-container',
    dotClassName: 'bg-tertiary',
  },
  info: {
    label: '信息',
    className: 'bg-primary-container text-on-primary-container',
    dotClassName: 'bg-primary',
  },
  success: {
    label: '完成',
    className: 'bg-secondary-container text-on-secondary-container',
    dotClassName: 'bg-secondary',
  },
}

const notificationFilters: Array<NotificationCategory | 'all'> = [
  'all',
  'approval',
  'report',
  'delivery',
  'sla',
  'event',
  'activity',
]

export default function NotificationCenter() {
  const { tasks, approvals, events, reports, reportDeliveryRecords, activityLogs } = useAI()
  const [activeFilter, setActiveFilter] = useState<NotificationCategory | 'all'>('all')
  const [readNotificationIds, setReadNotificationIds] = useState(() => new Set(readNotificationReadIds()))

  const notifications = useMemo(
    () => getNotificationItems(tasks, approvals, events, reports, reportDeliveryRecords, activityLogs),
    [activityLogs, approvals, events, reportDeliveryRecords, reports, tasks],
  )
  const filteredNotifications = notifications.filter(
    (item) => activeFilter === 'all' || item.category === activeFilter,
  )

  const urgentCount = notifications.filter((item) => item.severity === 'critical').length
  const actionCount = notifications.filter((item) => item.actionHref).length
  const approvalCount = notifications.filter((item) => item.category === 'approval').length
  const deliveryFailureCount = notifications.filter(
    (item) => item.category === 'delivery' && item.severity === 'critical',
  ).length

  useEffect(() => {
    return subscribeNotificationReadState(() => {
      setReadNotificationIds(new Set(readNotificationReadIds()))
    })
  }, [])

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">AI 员工消息流</p>
          <h1 className="text-3xl font-bold text-on-surface">通知中心</h1>
          <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
            集中收拢审批提醒、报告生成、报告发送、SLA 催办升级和高风险事件，后续可接入站内已读状态、邮件、短信或企业微信。
          </p>
        </div>
        <Link
          to="/ai-workbench"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-container hover:text-on-primary-container"
        >
          返回 AI 工作台
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="全部通知" value={String(notifications.length)} icon="notifications" />
        <SummaryCard title="紧急通知" value={String(urgentCount)} icon="priority_high" tone="critical" />
        <SummaryCard title="待动作" value={String(actionCount)} icon="touch_app" />
        <SummaryCard title="待审批 / 发送失败" value={`${approvalCount} / ${deliveryFailureCount}`} icon="approval" tone="warning" />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {notificationFilters.map((filter) => {
          const active = activeFilter === filter
          const meta = categoryMeta[filter]

          return (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${
                active
                  ? 'bg-primary text-on-primary'
                  : 'border border-outline-variant bg-surface text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{meta.icon}</span>
              {meta.label}
            </button>
          )
        })}
      </div>

      <div>
        <section className="rounded-lg border border-outline-variant bg-surface">
          <div className="border-b border-outline-variant px-6 py-4">
            <h2 className="text-lg font-semibold text-on-surface">通知列表</h2>
          </div>

          {filteredNotifications.length > 0 ? (
            <div className="divide-y divide-outline-variant">
              {filteredNotifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  isUnread={!readNotificationIds.has(notification.id)}
                />
              ))}
            </div>
          ) : (
            <div className="p-10 text-center">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant">notifications_off</span>
              <p className="mt-3 font-medium text-on-surface">暂无通知</p>
              <p className="mt-1 text-sm text-on-surface-variant">当前分类下没有需要处理的信息。</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function NotificationRow({
  notification,
  isUnread,
}: {
  notification: NotificationItem
  isUnread: boolean
}) {
  const severity = severityMeta[notification.severity]
  const category = categoryMeta[notification.category]

  return (
    <article className="flex flex-col gap-4 p-5 transition-colors hover:bg-surface-container-low md:flex-row md:items-start">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-container-high">
        <span className="material-symbols-outlined text-on-surface">{category.icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {isUnread ? <span className="h-2 w-2 rounded-full bg-error" aria-label="未读通知" /> : null}
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${severity.className}`}>
            {severity.label}
          </span>
          <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs text-on-surface-variant">
            {category.label}
          </span>
          <span className="text-xs text-on-surface-variant">{formatLocalDateTime(notification.createdAt)}</span>
        </div>
        <h3 className="font-semibold text-on-surface">{notification.title}</h3>
        <p className="mt-1 text-sm leading-6 text-on-surface-variant">{notification.message}</p>
        <p className="mt-2 text-xs text-on-surface-variant">来源：{notification.sourceLabel}</p>
      </div>
      {notification.actionHref && notification.actionLabel ? (
        <Link
          to={notification.actionHref}
          onClick={() => markNotificationsRead([notification.id])}
          className="shrink-0 rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-container hover:text-on-primary-container"
        >
          {notification.actionLabel}
        </Link>
      ) : null}
    </article>
  )
}

function SummaryCard({
  title,
  value,
  icon,
  tone = 'primary',
}: {
  title: string
  value: string
  icon: string
  tone?: 'primary' | 'warning' | 'critical'
}) {
  const toneClassName = {
    primary: 'bg-primary-container text-on-primary-container',
    warning: 'bg-tertiary-container text-on-tertiary-container',
    critical: 'bg-error-container text-error',
  }[tone]

  return (
    <div className="rounded-lg border border-outline-variant bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className={`material-symbols-outlined rounded-full p-2 ${toneClassName}`}>{icon}</span>
      </div>
      <p className="text-2xl font-semibold text-on-surface">{value}</p>
      <p className="mt-1 text-sm text-on-surface-variant">{title}</p>
    </div>
  )
}
