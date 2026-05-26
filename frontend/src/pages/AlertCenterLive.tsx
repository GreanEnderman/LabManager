import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRole } from '../auth/RoleContext'
import { useAI } from '../ai/AIStateLive'
import { useAISettingsRuntime } from '../ai/AISettingsRuntimeLive'
import { getEffectiveChemicalThreshold } from '../ai/thresholds'
import { alertsApi, type AlertEvent } from '../api/alerts'
import { MAINTENANCE_OVERDUE_DAYS } from '../data/selectors'
import { useImports } from '../imports/ImportContextLive'

interface AlertItem {
  id: string
  name: string
  description: string
  image?: string
  icon: string
  sourceType: 'chemical' | 'equipment'
  sourceId: string
  event: AlertEvent
  emphasis?: 'default' | 'error'
}

export default function AlertCenterLive() {
  const navigate = useNavigate()
  const { can } = useRole()
  const { getTaskBySource } = useAI()
  const { settings } = useAISettingsRuntime()
  const { chemicals, equipment, isLoading: importsLoading } = useImports()
  const canCreateTask = can('tasks:write')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lowStockAlerts, setLowStockAlerts] = useState<AlertItem[]>([])
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<AlertItem[]>([])
  const [faultAlerts, setFaultAlerts] = useState<AlertItem[]>([])
  const [previewingAlert, setPreviewingAlert] = useState<AlertItem | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewRecommendation, setPreviewRecommendation] = useState<{
    reason: string
    riskSummary: string
    actionSummary: string | string[]
    llmUsed?: boolean
    fallbackReason?: string | null
  } | null>(null)

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Prepare data for inspection
      const now = new Date().toISOString()
      const response = await alertsApi.inspectRules({
        input: {
          chemicals: chemicals.map((c) => ({
            id: c.id,
            name: c.name,
            totalQuantity: c.currentQuantity,
            threshold: getEffectiveChemicalThreshold(c, settings),
          })),
          equipment: equipment.map((e) => ({
            id: e.id,
            name: e.name,
            status: e.status,
            lastMaintenanceAt: e.lastMaintenanceAt,
          })),
        },
        config: {
          now,
          maintenanceOverdueDays: MAINTENANCE_OVERDUE_DAYS,
        },
      })

      // Process alerts
      const lowStock: AlertItem[] = []
      const maintenance: AlertItem[] = []
      const fault: AlertItem[] = []

      response.data.items.forEach(({ event }) => {
        const sourceData =
          event.sourceType === 'chemical'
            ? chemicals.find((c) => c.id === event.sourceId)
            : equipment.find((e) => e.id === event.sourceId)

        if (!sourceData) return

        const alertItem: AlertItem = {
          id: event.id,
          name: event.sourceName,
          description: event.summary,
          image: sourceData.imageDataUrl || undefined,
          icon: event.sourceType === 'chemical' ? 'science' : 'precision_manufacturing',
          sourceType: event.sourceType,
          sourceId: event.sourceId,
          event,
        }

        if (event.type === 'low_stock') {
          lowStock.push(alertItem)
        } else if (event.type === 'maintenance_overdue') {
          maintenance.push(alertItem)
        } else if (event.type === 'equipment_fault') {
          fault.push({ ...alertItem, emphasis: 'error', icon: 'warning' })
        }
      })

      setLowStockAlerts(lowStock.slice(0, 6))
      setMaintenanceAlerts(maintenance.slice(0, 6))
      setFaultAlerts(fault.slice(0, 6))
    } catch (err) {
      console.error('加载预警失败:', err)
      setError(err instanceof Error ? err.message : '加载预警失败')
    } finally {
      setLoading(false)
    }
  }, [chemicals, equipment, settings])

  useEffect(() => {
    if (!importsLoading) {
      loadAlerts()
    }
  }, [importsLoading, loadAlerts])

  const handleCreateTask = async (alertItem: AlertItem) => {
    try {
      const response = await alertsApi.executeRule({
        event: alertItem.event,
        actor: {
          id: 'current-user',
          name: 'Current User',
          type: 'user',
        },
        runId: `run-${Date.now()}`,
      })

      if (response.data.state.output.taskId) {
        setPreviewingAlert(null)
        navigate('/ai-tasks')
      }
    } catch (err) {
      console.error('创建任务失败:', err)
      window.alert('创建任务失败: ' + (err instanceof Error ? err.message : '未知错误'))
    }
  }

  const handlePreviewRecommendation = async (alertItem: AlertItem) => {
    setPreviewingAlert(alertItem)
    setPreviewLoading(true)
    setPreviewRecommendation(null)

    try {
      const response = await alertsApi.previewRule({
        event: alertItem.event,
        actor: {
          id: 'current-user',
          name: 'Current User',
          type: 'user',
        },
        runId: `preview-${Date.now()}`,
      })

      // Extract recommendation from state
      const stateData = response.data.state

      // Check if task already exists (deduplication)
      if (stateData.context?.existingOpenTask) {
        window.alert('该预警已经创建过任务了，请在任务列表中查看。')
        setPreviewingAlert(null)
        setPreviewLoading(false)
        return
      }

      const recommendation = stateData.recommendation

      if (recommendation) {
        // LLM generated recommendation
        setPreviewRecommendation({
          reason: recommendation.reason || '无法获取原因分析',
          riskSummary: recommendation.riskSummary || '无法获取风险评估',
          actionSummary: recommendation.actionSummary || '无法获取行动建议',
          llmUsed: recommendation.llmUsed,
          fallbackReason: recommendation.fallbackReason,
        })
      } else {
        // Fallback: use task data
        const task = stateData.taskDraft || stateData.task
        if (task) {
          setPreviewRecommendation({
            reason: task.summary || '无法获取原因分析',
            riskSummary: `风险级别: ${task.riskLevel || 'medium'}`,
            actionSummary: task.recommendation || '无法获取行动建议',
            llmUsed: false,
            fallbackReason: 'task_draft_fallback',
          })
        } else {
          window.alert('无法获取推荐内容，请稍后重试。')
          setPreviewingAlert(null)
        }
      }
    } catch (err) {
      console.error('预览推荐失败:', err)
      window.alert('预览推荐失败: ' + (err instanceof Error ? err.message : '未知错误'))
      setPreviewingAlert(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleViewTask = (sourceType: 'chemical' | 'equipment', sourceId: string) => {
    const task = getTaskBySource(sourceType, sourceId)
    if (task) {
      navigate('/ai-tasks')
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <p className="text-on-surface-variant">加载预警数据...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-error bg-error-container p-6 text-error">
          <h2 className="mb-2 text-xl font-bold">加载失败</h2>
          <p>{error}</p>
          <button onClick={loadAlerts} className="mt-4 rounded-lg bg-error px-4 py-2 text-on-error">
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-on-surface">预警中心</h1>
        <button
          onClick={loadAlerts}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-on-primary"
        >
          <span className="material-symbols-outlined">refresh</span>
          刷新
        </button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AlertStatCard title="低库存数量" value={String(lowStockAlerts.length)} icon="inventory_2" color="warning" />
        <AlertStatCard title="异常设备" value={String(faultAlerts.length)} icon="error" color="error" />
        <AlertStatCard title="待维护设备" value={String(maintenanceAlerts.length)} icon="build" color="warning" />
        <AlertStatCard title="维护周期" value={`${MAINTENANCE_OVERDUE_DAYS}天`} icon="schedule" color="warning" />
      </div>

      <div className="space-y-6">
        <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface">
          <div className="flex items-center justify-between bg-tertiary-container px-6 py-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-on-tertiary-container">
              <span className="material-symbols-outlined">inventory_2</span>
              低库存化学品
            </h2>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary">快速入库</button>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {lowStockAlerts.map((item) => (
                <AlertRow
                  key={item.id}
                  title={item.name}
                  description={item.description}
                  image={item.image}
                  icon={item.icon}
                  action={
                    <AlertActions
                      canWrite={canCreateTask}
                      hasTask={Boolean(getTaskBySource(item.sourceType, item.sourceId))}
                      onCreate={() => handleCreateTask(item)}
                      onPreview={() => handlePreviewRecommendation(item)}
                      onView={() => handleViewTask(item.sourceType, item.sourceId)}
                      createLabel="生成任务"
                    />
                  }
                />
              ))}
            </div>
            {lowStockAlerts.length === 0 && <p className="text-sm text-on-surface-variant">当前没有低库存化学品。</p>}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface">
          <div className="flex items-center justify-between bg-tertiary-container px-6 py-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-on-tertiary-container">
              <span className="material-symbols-outlined">build</span>
              待维护设备
            </h2>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary">查看全部</button>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {maintenanceAlerts.map((item) => (
                <AlertRow
                  key={item.id}
                  title={item.name}
                  description={item.description}
                  image={item.image}
                  icon={item.icon}
                  action={
                    <AlertActions
                      canWrite={canCreateTask}
                      hasTask={Boolean(getTaskBySource(item.sourceType, item.sourceId))}
                      onCreate={() => handleCreateTask(item)}
                      onPreview={() => handlePreviewRecommendation(item)}
                      onView={() => handleViewTask(item.sourceType, item.sourceId)}
                      createLabel="生成任务"
                    />
                  }
                />
              ))}
            </div>
            {maintenanceAlerts.length === 0 && <p className="text-sm text-on-surface-variant">当前没有超期维护设备。</p>}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface">
          <div className="flex items-center justify-between bg-error-container px-6 py-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-error">
              <span className="material-symbols-outlined">error</span>
              异常设备
            </h2>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary">导出清单</button>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {faultAlerts.map((item) => (
                <AlertRow
                  key={item.id}
                  title={item.name}
                  description={item.description}
                  image={item.image}
                  icon={item.icon}
                  emphasis="error"
                  action={
                    <AlertActions
                      canWrite={canCreateTask}
                      hasTask={Boolean(getTaskBySource(item.sourceType, item.sourceId))}
                      onCreate={() => handleCreateTask(item)}
                      onPreview={() => handlePreviewRecommendation(item)}
                      onView={() => handleViewTask(item.sourceType, item.sourceId)}
                      createLabel="立即处理"
                    />
                  }
                />
              ))}
            </div>
            {faultAlerts.length === 0 && <p className="text-sm text-on-surface-variant">当前没有异常状态设备。</p>}
          </div>
        </section>
      </div>

      {/* 推荐预览弹窗 */}
      {previewingAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-surface shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-outline-variant bg-surface px-6 py-4">
              <h2 className="text-xl font-bold text-on-surface">AI 推荐预览</h2>
              <button
                onClick={() => setPreviewingAlert(null)}
                className="rounded-lg p-2 hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-on-surface">close</span>
              </button>
            </div>

            <div className="p-6">
              {/* 预警信息 */}
              <div className="mb-6 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <div className="mb-2 flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-on-surface-variant">
                    {previewingAlert.icon}
                  </span>
                  <div>
                    <h3 className="font-semibold text-on-surface">{previewingAlert.name}</h3>
                    <p className="text-sm text-on-surface-variant">{previewingAlert.description}</p>
                  </div>
                </div>
              </div>

              {/* 加载状态 */}
              {previewLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="mb-4 text-4xl">🤖</div>
                    <p className="text-on-surface-variant">AI 正在分析并生成推荐...</p>
                  </div>
                </div>
              )}

              {/* 推荐内容 */}
              {!previewLoading && previewRecommendation && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-base">
                      {previewRecommendation.llmUsed ? 'auto_awesome' : 'rule'}
                    </span>
                    <span>
                      {previewRecommendation.llmUsed
                        ? 'AI 生成'
                        : `模板兜底${previewRecommendation.fallbackReason ? `：${previewRecommendation.fallbackReason}` : ''}`}
                    </span>
                  </div>

                  <div>
                    <h4 className="mb-2 flex items-center gap-2 font-semibold text-on-surface">
                      <span className="material-symbols-outlined text-primary">info</span>
                      原因分析
                    </h4>
                    <div className="rounded-lg bg-surface-container-low p-4 text-sm text-on-surface">
                      {previewRecommendation.reason}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 flex items-center gap-2 font-semibold text-on-surface">
                      <span className="material-symbols-outlined text-error">warning</span>
                      风险评估
                    </h4>
                    <div className="rounded-lg bg-error-container p-4 text-sm text-on-error-container">
                      {previewRecommendation.riskSummary}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 flex items-center gap-2 font-semibold text-on-surface">
                      <span className="material-symbols-outlined text-tertiary">checklist</span>
                      行动建议
                    </h4>
                    <div className="rounded-lg bg-tertiary-container p-4 text-sm text-on-tertiary-container">
                      {typeof previewRecommendation.actionSummary === 'string' ? (
                        <p>{previewRecommendation.actionSummary}</p>
                      ) : Array.isArray(previewRecommendation.actionSummary) ? (
                        <ul className="list-inside list-disc space-y-1">
                          {previewRecommendation.actionSummary.map((action, idx) => (
                            <li key={idx}>{action}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>{String(previewRecommendation.actionSummary)}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              {!previewLoading && previewRecommendation && (
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => handleCreateTask(previewingAlert)}
                    className="flex-1 rounded-lg bg-primary px-4 py-3 font-medium text-on-primary"
                  >
                    确认并创建任务
                  </button>
                  <button
                    onClick={() => setPreviewingAlert(null)}
                    className="rounded-lg border border-outline px-4 py-3 font-medium text-on-surface"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AlertRow({
  title,
  description,
  image,
  icon,
  action,
  emphasis = 'default',
}: {
  title: string
  description: string
  image?: string
  icon: string
  action: React.ReactNode
  emphasis?: 'default' | 'error'
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg p-4 ${
        emphasis === 'error'
          ? 'border-l-4 border-error bg-surface-container-low'
          : 'bg-surface-container-low'
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded ${
            emphasis === 'error' ? 'bg-error-container' : 'bg-surface-container'
          }`}
        >
          {image ? (
            <img src={image} alt={title} className="h-full w-full object-cover" />
          ) : (
            <span className={`material-symbols-outlined ${emphasis === 'error' ? 'text-error' : 'text-on-surface-variant'}`}>
              {icon}
            </span>
          )}
        </div>
        <div>
          <p className="font-medium text-on-surface">{title}</p>
          <p className={`text-sm ${emphasis === 'error' ? 'text-error' : 'text-on-surface-variant'}`}>{description}</p>
        </div>
      </div>
      {action}
    </div>
  )
}

function AlertActions({
  canWrite,
  hasTask,
  onCreate,
  onPreview,
  onView,
  createLabel,
}: {
  canWrite: boolean
  hasTask: boolean
  onCreate: () => void
  onPreview: () => void
  onView: () => void
  createLabel: string
}) {
  if (hasTask) {
    return (
      <button onClick={onView} className="rounded-lg bg-surface-container px-4 py-2 text-sm text-on-surface">
        查看任务
      </button>
    )
  }

  if (!canWrite) {
    return <span className="text-sm text-on-surface-variant">普通成员仅可查看任务</span>
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={onPreview}
        className="rounded-lg border border-outline bg-surface px-4 py-2 text-sm text-on-surface hover:bg-surface-container"
      >
        预览推荐
      </button>
      <button onClick={onCreate} className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary">
        {createLabel}
      </button>
    </div>
  )
}

function AlertStatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string
  value: string
  icon: string
  color: 'warning' | 'error'
}) {
  const colorClasses = {
    warning: 'bg-tertiary-container text-on-tertiary-container',
    error: 'bg-error-container text-error',
  }

  return (
    <div className={`rounded-lg p-6 ${colorClasses[color]}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="material-symbols-outlined text-3xl">{icon}</span>
      </div>
      <p className="mb-1 text-3xl font-bold">{value}</p>
      <p className="text-sm">{title}</p>
    </div>
  )
}
