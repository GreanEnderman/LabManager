import { Link } from 'react-router-dom'
import { useAI } from '../ai/AIStateLive'

export default function AIDashboard() {
  const { events, tasks, approvals, activityLogs, generateReport, createApprovalForTask } = useAI()

  const openTasks = tasks.filter((task) => task.status === 'open' || task.status === 'in_progress')
  const pendingApprovals = approvals.filter((approval) => approval.status === 'pending')
  const highPriorityTasks = tasks.filter(
    (task) => task.priority === 'P0' && task.status !== 'done' && task.status !== 'closed',
  )

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
        <StatCard title="今日发现问题" value={String(events.length)} icon="crisis_alert" />
        <StatCard title="待处理任务" value={String(openTasks.length)} icon="task" />
        <StatCard title="待审批事项" value={String(pendingApprovals.length)} icon="approval" />
        <StatCard title="高优先级任务" value={String(highPriorityTasks.length)} icon="priority_high" />
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
            <ActionCard title="查看任务面板" href="/ai-tasks" />
            <ActionCard title="查看报告中心" href="/ai-reports" />
          </div>
        </section>

        <section className="rounded-lg border border-outline-variant bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-on-surface">待处理队列</h2>
            <Link to="/ai-tasks" className="text-sm text-primary">
              查看全部
            </Link>
          </div>
          <div className="space-y-3">
            {tasks.slice(0, 4).map((task) => (
              <div key={task.id} className="rounded-lg bg-surface-container-low p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium text-on-surface">{task.title}</p>
                  <span className="rounded-full bg-primary-container px-3 py-1 text-xs text-on-primary-container">
                    {task.status}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant">{task.summary}</p>
                <p className="mt-2 text-xs text-on-surface-variant">责任人：{task.assignee}</p>
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
            {activityLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="rounded-lg bg-surface-container-low p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-on-surface">{log.action}</p>
                  <span className="text-xs text-on-surface-variant">{log.timestamp}</span>
                </div>
                <p className="mt-1 text-sm text-on-surface-variant">{log.detail}</p>
              </div>
            ))}
          </div>
        </section>
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
