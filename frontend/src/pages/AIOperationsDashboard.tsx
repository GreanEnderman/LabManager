import { Link } from 'react-router-dom'
import { useAI } from '../ai/AIStateLive'
import { taskStatusClass, taskStatusLabel } from '../ai/labels'
import { getAIOverviewStats, getHighPriorityTasks, getPendingApprovals, getRecentActivityLogs } from '../ai/selectors'
import { formatLocalDateTime } from '../runtime/dateTime'

export default function AIOperationsDashboard() {
  const { events, tasks, approvals, reports, activityLogs, generateReport, createApprovalForTask } = useAI()
  const overview = getAIOverviewStats(tasks, approvals, events, reports)
  const pendingApprovals = getPendingApprovals(approvals)
  const highPriorityTasks = getHighPriorityTasks(tasks)
  const recentLogs = getRecentActivityLogs(activityLogs)
  const taskQueue = tasks
    .filter((task) => task.status !== 'done' && task.status !== 'closed')
    .slice(0, 4)

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">AI 员工驾驶台</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={() => generateReport('daily')} className="rounded-lg bg-primary px-4 py-2 text-on-primary">
            生成日报
          </button>
          <Link to="/ai-tasks" className="rounded-lg bg-surface-container-high px-4 py-2 text-on-surface">
            进入任务中心
          </Link>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="今日发现问题" value={String(overview.eventCount)} icon="crisis_alert" />
        <StatCard title="未批准任务" value={String(overview.openTaskCount)} icon="task" />
        <StatCard title="待审批事项" value={String(overview.pendingApprovalCount)} icon="approval" />
        <StatCard title="超时任务" value={String(overview.overdueTaskCount)} icon="timer" />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="rounded-lg border border-outline-variant bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-on-surface">AI 建议动作</h2>
            <Link to="/ai-approvals" className="text-sm text-primary">
              查看审批台
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ActionCard
              title="推动高风险任务进入审批"
              onClick={() => {
                const candidate = tasks.find(
                  (task) => task.priority === 'P0' && task.status !== 'pending_approval',
                )
                if (candidate) {
                  createApprovalForTask(candidate.id)
                }
              }}
            />
            <ActionCard
              title="生成每日日报"
              onClick={() => generateReport('daily')}
            />
            <ActionCard
              title="查看 AI 数据分析"
              href="/ai-analysis"
            />
            <ActionCard title="查看报告中心" href="/ai-reports" />
          </div>
        </section>

        <section className="rounded-lg border border-outline-variant bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-on-surface">未批准队列</h2>
            <Link to="/ai-tasks" className="text-sm text-primary">
              查看全部
            </Link>
          </div>
          <div className="space-y-3">
            {taskQueue.map((task) => (
              <div key={task.id} className="rounded-lg bg-surface-container-low p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="font-medium text-on-surface">{task.title}</p>
                  <span className={`rounded-full px-3 py-1 text-xs ${taskStatusClass[task.status]}`}>
                    {taskStatusLabel[task.status]}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant">{task.summary}</p>
                <p className="mt-2 text-xs text-on-surface-variant">
                  责任人：{task.assignee} · 优先级：{task.priority}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr,1fr]">
        <section className="rounded-lg border border-outline-variant bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-on-surface">风险事件</h2>
            <Link to="/dashboard" className="text-sm text-primary">
              查看角落预警
            </Link>
          </div>
          <div className="space-y-3">
            {events.slice(0, 5).map((event) => (
              <div key={event.id} className="rounded-lg bg-tertiary-container p-4 text-on-tertiary-container">
                <p className="font-medium">{event.title}</p>
                <p className="mt-1 text-sm">{event.summary}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-outline-variant bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-on-surface">最近活动</h2>
            <Link to="/ai-reports" className="text-sm text-primary">
              查看报告
            </Link>
          </div>
          <div className="space-y-3">
            {recentLogs.map((log) => (
              <div key={log.id} className="rounded-lg bg-surface-container-low p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-on-surface">{log.action}</p>
                  <span className="text-xs text-on-surface-variant">{formatLocalDateTime(log.timestamp)}</span>
                </div>
                <p className="mt-1 text-sm text-on-surface-variant">{log.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 rounded-lg border border-outline-variant bg-surface p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-on-surface">AI 工作摘要</h2>
          </div>
          <Link to="/ai-analysis" className="rounded-lg bg-surface-container-high px-4 py-2 text-sm text-on-surface">
            查看数据分析
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SummaryCard title="高优先级任务" value={`${highPriorityTasks.length} 个`} />
          <SummaryCard title="待审批事项" value={`${pendingApprovals.length} 项`} />
          <SummaryCard title="报告沉淀" value={`${overview.reportCount} 份`} />
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: string }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="material-symbols-outlined rounded-full bg-primary-container p-2 text-on-primary-container">
          {icon}
        </span>
      </div>
      <p className="text-3xl font-bold text-on-surface">{value}</p>
      <p className="mt-1 text-sm text-on-surface-variant">{title}</p>
    </div>
  )
}

function ActionCard({
  title,
  onClick,
  href,
}: {
  title: string
  onClick?: () => void
  href?: string
}) {
  const content = (
    <p className="font-medium text-on-surface">{title}</p>
  )

  if (href) {
    return (
      <Link
        to={href}
        className="rounded-lg border border-outline-variant bg-surface-container-low p-4 transition-colors hover:bg-surface-container"
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-outline-variant bg-surface-container-low p-4 text-left transition-colors hover:bg-surface-container"
    >
      {content}
    </button>
  )
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-container-low p-4">
      <p className="text-sm text-on-surface-variant">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-on-surface">{value}</p>
    </div>
  )
}
