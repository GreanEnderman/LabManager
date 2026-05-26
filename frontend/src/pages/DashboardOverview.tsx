import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { dashboardApi, type DashboardOverview as DashboardData } from '../api/dashboard'

export default function DashboardOverview() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [lowStockItems, setLowStockItems] = useState<Array<{ id: string; name: string; totalQuantity: number; image?: string | null }>>([])
  const [recentMaintenance, setRecentMaintenance] = useState<Array<{ id: string; name: string; lastMaintenanceAt: string | null; status: string; image?: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true)
        setError(null)

        const [overview, lowStock, maintenance] = await Promise.all([
          dashboardApi.getOverview(),
          dashboardApi.getLowStockChemicals(4),
          dashboardApi.getRecentMaintenance(4),
        ])

        setDashboardData(overview)
        setLowStockItems(lowStock.data)
        setRecentMaintenance(maintenance.data)
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <p className="text-on-surface-variant">加载中...</p>
        </div>
      </div>
    )
  }

  if (error || !dashboardData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <p className="text-error">{error || '无法加载数据'}</p>
        </div>
      </div>
    )
  }

  const { inventory: dashboardStats, aiWorkflow: aiOverview } = dashboardData

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold text-on-surface">首页概览</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="化学品总数" value={String(dashboardStats.chemicalCount)} icon="science" />
        <StatCard title="低库存物料" value={String(dashboardStats.lowStockCount)} icon="warning" color="warning" />
        <StatCard title="入库记录数" value={String(dashboardStats.inboundCount)} icon="arrow_downward" color="success" />
        <StatCard title="出库记录数" value={String(dashboardStats.outboundCount)} icon="arrow_upward" />
        <StatCard title="设备总数" value={String(dashboardStats.equipmentCount)} icon="precision_manufacturing" />
        <StatCard title="待维护设备" value={String(dashboardStats.overdueEquipmentCount)} icon="build" color="warning" />
      </div>

      <div className="mb-6 rounded-lg border border-outline-variant bg-surface p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-on-surface">AI 今日工作摘要</h2>
          </div>
          <Link
            to="/ai-dashboard"
            className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary transition-colors hover:bg-primary-container"
          >
            前往 AI 驾驶台
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <AISummaryCard title="待处理事件" value={String(aiOverview.eventCount)} icon="notifications_active" />
          <AISummaryCard title="进行中任务" value={String(aiOverview.openTaskCount)} icon="task" />
          <AISummaryCard title="待审批事项" value={String(aiOverview.pendingApprovalCount)} icon="approval" />
          <AISummaryCard title="已生成报告" value={String(aiOverview.reportCount)} icon="summarize" />
          <AISummaryCard title="高优任务" value={String(aiOverview.highPriorityTaskCount)} icon="timeline" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-outline-variant bg-surface p-6">
          <h2 className="mb-4 text-xl font-semibold text-on-surface">低库存化学品</h2>
          <div className="space-y-3">
            {lowStockItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded bg-surface-container-low p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded bg-surface-container">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-on-surface-variant">science</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-on-surface">{item.name}</p>
                    <p className="text-sm text-on-surface-variant">当前库存：{item.totalQuantity} 瓶</p>
                  </div>
                </div>
                <span className="rounded-full bg-error-container px-3 py-1 text-sm text-error">低库存</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-outline-variant bg-surface p-6">
          <h2 className="mb-4 text-xl font-semibold text-on-surface">近期设备维护记录</h2>
          <div className="space-y-3">
            {recentMaintenance.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded bg-surface-container-low p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded bg-surface-container">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-on-surface-variant">precision_manufacturing</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-on-surface">{item.name}</p>
                    <p className="text-sm text-on-surface-variant">维护时间：{item.lastMaintenanceAt ?? '-'}</p>
                  </div>
                </div>
                <span className="rounded-full bg-secondary-container px-3 py-1 text-sm text-on-secondary-container">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
          {recentMaintenance.length === 0 && (
            <p className="text-sm text-on-surface-variant">暂无可展示的维护记录。</p>
          )}
        </div>
      </div>

      <div className="mt-6 text-sm text-on-surface-variant">
        数据来源：实时从后端 API 获取 | 最后更新：{new Date(dashboardData.timestamp).toLocaleString('zh-CN')}
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  color = 'primary',
}: {
  title: string
  value: string
  icon: string
  color?: 'primary' | 'warning' | 'success'
}) {
  const colorClasses = {
    primary: 'bg-primary-container text-on-primary-container',
    warning: 'bg-tertiary-container text-on-tertiary-container',
    success: 'bg-secondary-container text-on-secondary-container',
  }

  return (
    <div className="rounded-lg border border-outline-variant bg-surface p-6">
      <div className="mb-2 flex items-center justify-between">
        <span className={`material-symbols-outlined rounded-full p-2 ${colorClasses[color]}`}>
          {icon}
        </span>
      </div>
      <p className="mb-1 text-3xl font-bold text-on-surface">{value}</p>
      <p className="text-sm text-on-surface-variant">{title}</p>
    </div>
  )
}

function AISummaryCard({
  title,
  value,
  icon,
}: {
  title: string
  value: string
  icon: string
}) {
  return (
    <div className="rounded-lg bg-surface-container-low p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="material-symbols-outlined rounded-full bg-primary-container p-2 text-on-primary-container">
          {icon}
        </span>
        <span className="text-sm text-on-surface-variant">{title}</span>
      </div>
      <p className="text-2xl font-semibold text-on-surface">{value}</p>
    </div>
  )
}
