import { useState } from 'react'
import { getMaintenanceRecords } from '../data/selectors'

const records = getMaintenanceRecords()

const statusConfig: Record<string, string> = {
  已维护: 'bg-secondary-container text-on-secondary-container',
  待维护: 'bg-tertiary-container text-on-tertiary-container',
  异常: 'bg-error-container text-error',
}

export default function MaintenanceRecords() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')

  const filteredRecords = records.filter((record) => {
    const searchText = keyword.trim()
    const matchesKeyword = searchText === '' || record.name.includes(searchText)
    const matchesStatus = status === '全部状态' || record.status === status
    return matchesKeyword && matchesStatus
  })

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-on-surface">维护记录</h1>
        <button className="rounded-lg bg-primary px-4 py-2 text-on-primary transition-colors hover:bg-primary-container">
          维护规则来自配置
        </button>
      </div>

      <div className="mb-6 rounded-lg border border-outline-variant bg-surface p-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="搜索设备名称..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2"
          />
          <input type="date" className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2" />
          <input type="date" className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2" />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2"
          >
            <option>全部状态</option>
            <option>已维护</option>
            <option>待维护</option>
            <option>异常</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredRecords.map((record) => (
          <div
            key={record.id}
            className="rounded-lg border border-outline-variant bg-surface p-6 transition-shadow hover:shadow-md"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-on-surface">{record.name}</h3>
                  <span className={`rounded-full px-3 py-1 text-sm ${statusConfig[record.status]}`}>
                    {record.status}
                  </span>
                </div>
                <div className="flex items-center gap-6 text-sm text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">calendar_today</span>
                    {record.lastMaintenanceAt ?? '-'}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">person</span>
                    {record.engineer}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">image</span>
                    {record.images.length} 张图片
                  </span>
                </div>
              </div>
              <button className="rounded-lg bg-primary-container px-4 py-2 text-on-primary-container transition-colors hover:bg-primary-fixed">
                查看详情
              </button>
            </div>

            <div className="rounded-lg bg-surface-container-low p-4">
              <h4 className="mb-2 text-sm font-medium text-on-surface">维护摘要</h4>
              <p className="text-sm text-on-surface-variant">{record.summary}</p>
            </div>

            {record.images.length > 0 && (
              <div className="mt-4 flex gap-2">
                {record.images.slice(0, 3).map((image, index) => (
                  <div
                    key={`${record.id}-img-${index}`}
                    className="flex h-20 w-20 items-center justify-center overflow-hidden rounded bg-surface-container"
                  >
                    <img src={image} alt={`${record.name}-${index + 1}`} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
