import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

interface WorkerStatus {
  name: string
  status: string
  active_tasks: number
  processed: number
  pool: string
}

interface ScheduledTask {
  name: string
  task: string
  schedule: string
  last_run: string | null
  next_run: string | null
  enabled: boolean
}

interface WorkflowStatus {
  workers: WorkerStatus[]
  scheduled_tasks: ScheduledTask[]
  recent_executions: unknown[]
  stats: {
    total_workers: number
    active_workers: number
    total_scheduled_tasks: number
    total_processed: number
  }
}

interface TriggerResult {
  task_name: string
  task_id?: string
  state?: string
  message?: string
  result?: {
    events_found?: number
    tasks_created?: number
    task_ids?: string[]
    skipped_reason?: string
  }
}

const API_BASE = import.meta.env.VITE_PYTHON_API_BASE_URL || 'http://localhost:8001'

export default function WorkflowMonitor() {
  const [status, setStatus] = useState<WorkflowStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [triggerResult, setTriggerResult] = useState<TriggerResult | null>(null)
  const statusRequestInFlight = useRef(false)

  const fetchStatus = useCallback(async () => {
    if (statusRequestInFlight.current) {
      return
    }

    statusRequestInFlight.current = true
    try {
      const response = await fetch(`${API_BASE}/api/workflow/status`)
      if (!response.ok) throw new Error('Failed to fetch workflow status')
      const data = await response.json()
      setStatus(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      statusRequestInFlight.current = false
      setLoading(false)
    }
  }, [])

  const triggerTask = async (taskName: string) => {
    setTriggering(taskName)
    try {
      const response = await fetch(`${API_BASE}/api/workflow/tasks/${taskName}/trigger`, {
        method: 'POST',
      })
      const result = await response.json()
      if (result.success) {
        setTriggerResult(result)
        await fetchStatus()
      } else {
        alert(`触发失败: ${result.error}`)
      }
    } catch (err) {
      alert(`触发失败: ${err}`)
    } finally {
      setTriggering(null)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchStatus])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined mb-4 text-4xl text-primary">hourglass_empty</span>
          <p className="text-on-surface-variant">加载工作流状态...</p>
        </div>
      </div>
    )
  }

  if (error && !status) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined mb-4 text-4xl text-error">error</span>
          <p className="text-error">{error}</p>
          <button onClick={fetchStatus} className="mt-4 rounded-lg bg-primary px-4 py-2 text-on-primary">
            重试
          </button>
        </div>
      </div>
    )
  }

  if (!status) return null

  return (
    <div className="h-full overflow-auto bg-background p-6">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">自动工作流监控</h1>
          {error ? <p className="mt-1 text-sm text-error">最近一次刷新失败：{error}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-on-surface">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              className="h-4 w-4"
            />
            自动刷新 (5 秒)
          </label>
          <button
            onClick={fetchStatus}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm text-on-primary hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            刷新
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatusCard
          title="Worker 数量"
          value={`${status.stats.active_workers} / ${status.stats.total_workers}`}
          icon={status.stats.active_workers > 0 ? 'check_circle' : 'cancel'}
        />
        <StatusCard title="定时任务" value={`${status.stats.total_scheduled_tasks}`} icon="schedule" />
        <StatusCard title="已处理任务" value={`${status.stats.total_processed}`} icon="task_alt" />
        <StatusCard title="系统状态" value={status.stats.active_workers > 0 ? '运行中' : '离线'} icon="monitor_heart" />
      </div>

      <section className="mb-6 rounded-lg bg-surface p-6 shadow">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-on-surface">
          <span className="material-symbols-outlined">computer</span>
          Celery Workers
        </h2>

        {status.workers.length === 0 ? (
          <div className="rounded-lg bg-error-container p-4 text-center text-on-error-container">
            <p>没有检测到运行中的 Worker，或本次检查超时。</p>
            <p className="mt-2 text-sm opacity-80">
              启动命令：<code>celery -A app.tasks.celery_app:celery_app worker --loglevel=info --pool=solo</code>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {status.workers.map((worker) => (
              <div key={worker.name} className="flex items-center justify-between rounded-lg border border-outline-variant p-4">
                <div className="flex items-center gap-4">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <div>
                    <p className="font-medium text-on-surface">{worker.name}</p>
                    <p className="text-sm text-on-surface-variant">Pool: {worker.pool}</p>
                  </div>
                </div>
                <div className="flex gap-6 text-sm">
                  <span className="text-on-surface-variant">活跃任务: {worker.active_tasks}</span>
                  <span className="text-on-surface-variant">已处理: {worker.processed}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg bg-surface p-6 shadow">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-on-surface">
          <span className="material-symbols-outlined">schedule</span>
          定时任务配置
        </h2>

        {triggerResult ? (
          <div className="mb-4 rounded-lg border border-primary bg-primary-container p-4 text-on-primary-container">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">最近一次手动执行：{triggerResult.task_name}</p>
                <p className="mt-1 text-sm">
                  状态 {triggerResult.state ?? 'unknown'} · 发现事件 {triggerResult.result?.events_found ?? '-'} · 创建任务{' '}
                  {triggerResult.result?.tasks_created ?? '-'}
                </p>
                {triggerResult.result?.skipped_reason ? (
                  <p className="mt-1 text-sm">跳过原因：{triggerResult.result.skipped_reason}</p>
                ) : null}
                {triggerResult.result?.task_ids?.length ? (
                  <p className="mt-1 text-sm">任务 ID：{triggerResult.result.task_ids.join(', ')}</p>
                ) : null}
              </div>
              <Link
                to="/ai-workbench?tab=tasks"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm text-on-primary"
              >
                查看任务列表
              </Link>
            </div>
          </div>
        ) : null}

        {status.scheduled_tasks.length === 0 ? (
          <div className="rounded-lg bg-surface-container-low p-4 text-center text-on-surface-variant">没有配置定时任务。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant text-left">
                  <th className="pb-3 text-sm font-medium text-on-surface-variant">任务名称</th>
                  <th className="pb-3 text-sm font-medium text-on-surface-variant">任务类型</th>
                  <th className="pb-3 text-sm font-medium text-on-surface-variant">执行间隔</th>
                  <th className="pb-3 text-sm font-medium text-on-surface-variant">状态</th>
                  <th className="pb-3 text-sm font-medium text-on-surface-variant">操作</th>
                </tr>
              </thead>
              <tbody>
                {status.scheduled_tasks.map((task) => (
                  <tr key={task.name} className="border-b border-outline-variant">
                    <td className="py-4">
                      <p className="font-medium text-on-surface">{task.name}</p>
                    </td>
                    <td className="py-4">
                      <code className="rounded bg-surface-container-high px-2 py-1 text-xs text-on-surface">{task.task}</code>
                    </td>
                    <td className="py-4 text-sm text-on-surface-variant">{task.schedule}</td>
                    <td className="py-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                        启用
                      </span>
                    </td>
                    <td className="py-4">
                      <button
                        onClick={() => triggerTask(task.task)}
                        disabled={triggering === task.task}
                        className="rounded-lg bg-primary px-3 py-1 text-sm text-on-primary hover:bg-primary/90 disabled:opacity-50"
                      >
                        {triggering === task.task ? '触发中...' : '立即执行'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function StatusCard({ title, value, icon }: { title: string; value: string; icon: string }) {
  return (
    <div className="rounded-lg bg-surface p-4 shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-on-surface-variant">{title}</p>
          <p className="mt-1 text-2xl font-bold text-on-surface">{value}</p>
        </div>
        <span className="material-symbols-outlined text-4xl text-primary">{icon}</span>
      </div>
    </div>
  )
}
