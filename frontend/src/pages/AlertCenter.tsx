import { useNavigate } from 'react-router-dom'
import { useRole } from '../auth/RoleContext'
import { useAI } from '../ai/AIStateLive'
import { getChemicalThreshold } from '../data/runtime-config'
import {
  MAINTENANCE_OVERDUE_DAYS,
  getFaultEquipment,
  getLowStockChemicals,
  getOverdueEquipment,
} from '../data/selectors'

const lowStockAlerts = getLowStockChemicals().slice(0, 6)
const maintenanceAlerts = getOverdueEquipment().slice(0, 6)
const faultAlerts = getFaultEquipment().slice(0, 6)

export default function AlertCenter() {
  const navigate = useNavigate()
  const { can } = useRole()
  const { createTaskFromEvent, getEventBySource, getTaskBySource } = useAI()
  const canCreateTask = can('tasks:write')

  const handleCreateTask = async (sourceType: 'chemical' | 'equipment', sourceId: string) => {
    const event = getEventBySource(sourceType, sourceId)
    if (!event) {
      return
    }
    await createTaskFromEvent({ eventId: event.id })
    navigate('/ai-tasks')
  }

  const handleViewTask = (sourceType: 'chemical' | 'equipment', sourceId: string) => {
    const task = getTaskBySource(sourceType, sourceId)
    if (task) {
      navigate('/ai-tasks')
    }
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold text-on-surface">预警中心</h1>

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
                  description={`当前库存：${item.totalQuantity} 瓶 / 预警阈值：${getChemicalThreshold(item.name)} 瓶`}
                  image={item.image ?? undefined}
                  icon="science"
                  action={
                    <AlertActions
                      canWrite={canCreateTask}
                      hasTask={Boolean(getTaskBySource('chemical', item.id))}
                      onCreate={() => handleCreateTask('chemical', item.id)}
                      onView={() => handleViewTask('chemical', item.id)}
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
                  description={`最近维护：${item.lastMaintenanceAt ?? '-'} / 已超过建议周期`}
                  image={item.image ?? undefined}
                  icon="precision_manufacturing"
                  action={
                    <AlertActions
                      canWrite={canCreateTask}
                      hasTask={Boolean(getTaskBySource('equipment', item.id))}
                      onCreate={() => handleCreateTask('equipment', item.id)}
                      onView={() => handleViewTask('equipment', item.id)}
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
                  description={`设备状态异常：${item.status}`}
                  image={item.image ?? undefined}
                  icon="warning"
                  emphasis="error"
                  action={
                    <AlertActions
                      canWrite={canCreateTask}
                      hasTask={Boolean(getTaskBySource('equipment', item.id))}
                      onCreate={() => handleCreateTask('equipment', item.id)}
                      onView={() => handleViewTask('equipment', item.id)}
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
  onView,
  createLabel,
}: {
  canWrite: boolean
  hasTask: boolean
  onCreate: () => void
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
    <button onClick={onCreate} className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary">
      {createLabel}
    </button>
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
