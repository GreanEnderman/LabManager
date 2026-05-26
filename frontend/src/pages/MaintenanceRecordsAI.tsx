import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAI } from '../ai/AIStateLive'
import { getTaskBySource } from '../ai/selectors'
import { useImports } from '../imports/ImportContextLive'

const statusConfig: Record<string, string> = {
  已维护: 'bg-secondary-container text-on-secondary-container',
  待维护: 'bg-tertiary-container text-on-tertiary-container',
  异常: 'bg-error-container text-error',
}

export default function MaintenanceRecordsAI() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
  const { tasks } = useAI()
  const { maintenanceRecords } = useImports()

  const filteredRecords = useMemo(
    () =>
      maintenanceRecords.filter((record) => {
        const searchText = keyword.trim()
        const matchesKeyword = searchText === '' || record.equipmentName.includes(searchText)
        const matchesStatus = status === '全部状态' || record.status === status
        return matchesKeyword && matchesStatus
      }),
    [keyword, maintenanceRecords, status],
  )

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">维修记录</h1>
        </div>
        <Link to="/ai-tasks" className="rounded-lg bg-primary px-4 py-2 text-on-primary transition-colors hover:bg-primary-container">查看 AI 任务</Link>
      </div>

      <div className="mb-6 rounded-lg border border-outline-variant bg-surface p-4">
        <div className="flex gap-4">
          <input type="text" placeholder="搜索设备名称..." value={keyword} onChange={(event) => setKeyword(event.target.value)} className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2">
            <option>全部状态</option>
            <option>已维护</option>
            <option>待维护</option>
            <option>异常</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredRecords.map((record) => {
          const relatedTask = getTaskBySource(tasks, 'equipment', record.equipmentId || record.id)
          return (
            <div key={record.id} className="rounded-lg border border-outline-variant bg-surface p-6 transition-shadow hover:shadow-md">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-on-surface">{record.equipmentName}</h3>
                    <span className={`rounded-full px-3 py-1 text-sm ${statusConfig[record.status] ?? 'bg-surface-container text-on-surface'}`}>{record.status}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-on-surface-variant">
                    <span>{record.maintenanceAt || '-'}</span>
                    <span>{record.engineer || '-'}</span>
                    <span>{record.equipmentId || '-'}</span>
                  </div>
                </div>
                {relatedTask ? <Link to="/ai-tasks" className="rounded-lg bg-secondary-container px-4 py-2 text-on-secondary-container transition-colors hover:opacity-90">查看关联 AI 任务</Link> : null}
              </div>
              <div className="rounded-lg bg-surface-container-low p-4">
                <h4 className="mb-2 text-sm font-medium text-on-surface">维护摘要</h4>
                <p className="text-sm text-on-surface-variant">{record.summary || '-'}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
