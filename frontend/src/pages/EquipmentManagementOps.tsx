import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAI } from '../ai/AIStateLive'
import { useRole } from '../auth/RoleContext'
import { getTaskBySource } from '../ai/selectors'
import { useImports } from '../imports/ImportContextLive'
import type { EquipmentImportRecord } from '../imports/types'

type ViewMode = 'equipment' | 'maintenance'

const statusTone: Record<string, string> = {
  正常: 'bg-secondary-container text-on-secondary-container',
  维护中: 'bg-tertiary-container text-on-tertiary-container',
  待维护: 'bg-tertiary-container text-on-tertiary-container',
  故障: 'bg-error-container text-error',
}

const maintenanceStatusTone: Record<string, string> = {
  已维护: 'bg-secondary-container text-on-secondary-container',
  待维护: 'bg-tertiary-container text-on-tertiary-container',
  异常: 'bg-error-container text-error',
}

const MAINTENANCE_OVERDUE_DAYS = 180

function isMaintenanceOverdue(lastMaintenanceAt: string) {
  if (!lastMaintenanceAt) return false
  const maintenanceAt = new Date(`${lastMaintenanceAt}T00:00:00`)
  if (Number.isNaN(maintenanceAt.getTime())) return false
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - MAINTENANCE_OVERDUE_DAYS)
  return maintenanceAt < cutoff
}

function getEquipmentDisplayStatus(status: string, lastMaintenanceAt: string) {
  if (status === '正常' && isMaintenanceOverdue(lastMaintenanceAt)) return '待维护'
  return status
}

export default function EquipmentManagementOps() {
  const [activeView, setActiveView] = useState<ViewMode>('equipment')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
  const [maintenanceKeyword, setMaintenanceKeyword] = useState('')
  const [maintenanceStatus, setMaintenanceStatus] = useState('全部状态')
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const { tasks } = useAI()
  const { can } = useRole()
  const { equipment, maintenanceRecords, deleteEquipment, isSubmitting } = useImports()
  const canCreateImports = can('imports:create')
  const importEntityType = activeView === 'equipment' ? 'equipment' : 'maintenance'

  const filteredEquipment = useMemo(
    () =>
      equipment.filter((item) => {
        const searchText = keyword.trim()
        const displayStatus = getEquipmentDisplayStatus(item.status, item.lastMaintenanceAt)
        return (
          (searchText === '' || item.name.includes(searchText) || item.id.includes(searchText)) &&
          (status === '全部状态' || displayStatus === status)
        )
      }),
    [equipment, keyword, status],
  )

  const filteredMaintenanceRecords = useMemo(
    () =>
      maintenanceRecords.filter((record) => {
        const searchText = maintenanceKeyword.trim()
        return (
          (searchText === '' ||
            record.equipmentName.includes(searchText) ||
            record.equipmentId.includes(searchText)) &&
          (maintenanceStatus === '全部状态' || record.status === maintenanceStatus)
        )
      }),
    [maintenanceKeyword, maintenanceRecords, maintenanceStatus],
  )

  const handleDeleteEquipment = async (item: EquipmentImportRecord) => {
    if (!canCreateImports) return
    if (!window.confirm(`确定要删除设备“${item.name}”吗？相关维护记录也会一并删除。`)) return

    try {
      await deleteEquipment(item.id)
      setNotification({ type: 'success', message: `已删除设备：${item.name}` })
      setTimeout(() => setNotification(null), 3000)
    } catch (error: unknown) {
      setNotification({ type: 'error', message: error instanceof Error ? error.message : '删除设备失败' })
      setTimeout(() => setNotification(null), 5000)
    }
  }

  return (
    <div className="space-y-6 p-8">
      {notification ? (
        <div
          className={`fixed right-8 top-8 z-50 rounded-lg px-6 py-3 shadow-lg ${
            notification.type === 'success'
              ? 'bg-tertiary-container text-on-tertiary-container'
              : 'bg-error-container text-error'
          }`}
        >
          {notification.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">仪器设备</h1>
        </div>
        <div className="flex gap-3">
          <Link to={`/data-import?entityType=${importEntityType}`} className="rounded-lg bg-surface-container-high px-4 py-2 text-on-surface transition-colors hover:bg-surface-container-highest">数据导入</Link>
          <Link to="/ai-dashboard" className="rounded-lg bg-primary px-4 py-2 text-on-primary transition-colors hover:bg-primary-container">查看 AI 驾驶台</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg bg-surface-container-low p-1">
          <button type="button" onClick={() => setActiveView('equipment')} className={`rounded-md px-4 py-2 text-sm ${activeView === 'equipment' ? 'bg-primary text-on-primary' : 'text-on-surface'}`}>设备清单</button>
          <button type="button" onClick={() => setActiveView('maintenance')} className={`rounded-md px-4 py-2 text-sm ${activeView === 'maintenance' ? 'bg-primary text-on-primary' : 'text-on-surface'}`}>维护记录</button>
        </div>
      </div>

      {activeView === 'equipment' ? (
        <>
          <div className="rounded-lg border border-outline-variant bg-surface p-4">
            <div className="flex flex-wrap gap-4">
              <input type="text" placeholder="搜索设备名称或 ID..." value={keyword} onChange={(event) => setKeyword(event.target.value)} className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2" />
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2">
                <option>全部状态</option>
                <option>正常</option>
                <option>待维护</option>
                <option>故障</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredEquipment.map((item) => {
              const relatedTask = getTaskBySource(tasks, 'equipment', item.id)
              const displayStatus = getEquipmentDisplayStatus(item.status, item.lastMaintenanceAt)
              return (
                <div key={item.id} className="overflow-hidden rounded-lg border border-outline-variant bg-surface transition-shadow hover:shadow-lg">
                  <div className="space-y-4 p-6">
                    {item.imageDataUrl ? <img src={item.imageDataUrl} alt={item.name} className="h-40 w-full rounded-lg border border-outline-variant object-cover" /> : null}
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-lg font-semibold text-on-surface">{item.name}</h2>
                      <span className={`rounded-full px-3 py-1 text-sm ${statusTone[displayStatus] ?? 'bg-surface-container text-on-surface'}`}>{displayStatus}</span>
                    </div>
                    <div className="space-y-2 text-sm text-on-surface-variant">
                      <p>型号：{item.model || '-'}</p>
                      <p>记录：{item.id}</p>
                      <p>厂商：{item.vendor || '-'}</p>
                      <p>最近维护：{item.lastMaintenanceAt || '-'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {relatedTask ? <Link to="/ai-tasks" className="flex-1 rounded-lg bg-secondary-container px-4 py-2 text-center text-on-secondary-container">查看关联 AI 任务</Link> : null}
                      <button
                        type="button"
                        onClick={() => handleDeleteEquipment(item)}
                        disabled={isSubmitting || !canCreateImports}
                        className="rounded-lg border border-error px-4 py-2 text-sm text-error transition-colors hover:bg-error hover:text-on-error disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <section className="rounded-lg border border-outline-variant bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant bg-surface-container-low px-6 py-4">
            <div>
              <h2 className="text-xl font-semibold text-on-surface">维护记录</h2>
            </div>
            <Link to="/ai-tasks" className="rounded-lg border border-outline-variant px-4 py-2 text-sm text-on-surface transition-colors hover:bg-surface">查看 AI 任务</Link>
          </div>
          <div className="border-b border-outline-variant p-4">
            <div className="flex flex-wrap gap-4">
              <input type="text" placeholder="搜索设备名称或 ID..." value={maintenanceKeyword} onChange={(event) => setMaintenanceKeyword(event.target.value)} className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2" />
              <select value={maintenanceStatus} onChange={(event) => setMaintenanceStatus(event.target.value)} className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2">
                <option>全部状态</option>
                <option>已维护</option>
                <option>待维护</option>
                <option>异常</option>
              </select>
            </div>
          </div>
          <div className="space-y-4 p-6">
            {filteredMaintenanceRecords.length === 0 ? (
              <div className="rounded-lg bg-surface-container-low p-6 text-center text-sm text-on-surface-variant">暂无维护记录</div>
            ) : (
              filteredMaintenanceRecords.map((record) => {
                const relatedTask = getTaskBySource(tasks, 'equipment', record.equipmentId || record.id)
                return (
                  <div key={record.id} className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="font-semibold text-on-surface">{record.equipmentName}</h3>
                          <span className={`rounded-full px-3 py-1 text-sm ${maintenanceStatusTone[record.status] ?? 'bg-surface-container text-on-surface'}`}>{record.status}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-on-surface-variant">
                          <span>{record.maintenanceAt || '-'}</span>
                          <span>{record.engineer || '-'}</span>
                          <span>{record.equipmentId || '-'}</span>
                        </div>
                      </div>
                      {relatedTask ? <Link to="/ai-tasks" className="rounded-lg bg-secondary-container px-4 py-2 text-sm text-on-secondary-container">查看关联 AI 任务</Link> : null}
                    </div>
                    <div className="mt-4 rounded-lg bg-surface p-4">
                      <h4 className="mb-2 text-sm font-medium text-on-surface">维护摘要</h4>
                      <p className="text-sm text-on-surface-variant">{record.summary || '-'}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      )}
    </div>
  )
}
