import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAI } from '../ai/AIStateLive'
import { getEventBySource, getTaskBySource } from '../ai/selectors'
import { equipment } from '../data'

const statusConfig: Record<string, string> = {
  正常: 'bg-secondary-container text-on-secondary-container',
  维护中: 'bg-tertiary-container text-on-tertiary-container',
  故障: 'bg-error-container text-error',
  未知: 'bg-surface-container text-on-surface',
}

export default function EquipmentManagementAI() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
  const { events, tasks } = useAI()

  const filteredEquipment = equipment.filter((item) => {
    const searchText = keyword.trim()
    const matchesKeyword =
      searchText === '' || item.name.includes(searchText) || (item.code ?? '').includes(searchText)
    const matchesStatus = status === '全部状态' || item.status === status
    return matchesKeyword && matchesStatus
  })

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">仪器设备</h1>
        </div>
        <div className="flex gap-3">
          <button className="rounded-lg bg-surface-container-high px-4 py-2 text-on-surface transition-colors hover:bg-surface-container-highest">
            新增设备
          </button>
          <Link
            to="/ai-dashboard"
            className="rounded-lg bg-primary px-4 py-2 text-on-primary transition-colors hover:bg-primary-container"
          >
            查看 AI 驾驶台
          </Link>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-outline-variant bg-surface p-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="搜索设备名称或编号..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2"
          >
            <option>全部状态</option>
            <option>正常</option>
            <option>故障</option>
          </select>
          <select className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2">
            <option>全部分类</option>
            <option>按真实数据接入后补充</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredEquipment.map((item) => {
          const relatedTask = getTaskBySource(tasks, 'equipment', item.id)
          const relatedEvent = getEventBySource(events, 'equipment', item.id)

          return (
            <div
              key={item.id}
              className="overflow-hidden rounded-lg border border-outline-variant bg-surface transition-shadow hover:shadow-lg"
            >
              <div className="flex h-48 items-center justify-center overflow-hidden bg-surface-container">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-6xl text-on-surface-variant">
                    precision_manufacturing
                  </span>
                )}
              </div>
              <div className="p-6">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-on-surface">{item.name}</h3>
                  <span className={`rounded-full px-3 py-1 text-sm ${statusConfig[item.status] ?? statusConfig['未知']}`}>
                    {item.status}
                  </span>
                </div>
                <div className="mb-4 space-y-2 text-sm text-on-surface-variant">
                  <p>型号：{item.model ?? '-'}</p>
                  <p>编号：{item.code ?? '-'}</p>
                  <p>供应商：{item.vendor ?? '-'}</p>
                  <p>最近维护：{item.lastMaintenanceAt ?? '-'}</p>
                </div>

                <div className="space-y-3">
                  <button className="w-full rounded-lg bg-primary-container px-4 py-2 text-on-primary-container transition-colors hover:bg-primary-fixed">
                    {item.images.length > 0 ? `图片 ${item.images.length} 张` : item.remark ? '查看备注' : '查看详情'}
                  </button>

                  {relatedTask ? (
                    <Link
                      to="/ai-tasks"
                      className="block rounded-lg bg-secondary-container px-4 py-2 text-center text-on-secondary-container transition-colors hover:opacity-90"
                    >
                      查看关联 AI 任务
                    </Link>
                  ) : relatedEvent ? (
                    <Link
                      to="/alerts"
                      className="block rounded-lg bg-tertiary-container px-4 py-2 text-center text-on-tertiary-container transition-colors hover:opacity-90"
                    >
                      查看 AI 异常建议
                    </Link>
                  ) : (
                    <div className="rounded-lg bg-surface-container-low px-4 py-2 text-center text-sm text-on-surface-variant">
                      暂无 AI 处理项
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 rounded-lg border border-outline-variant bg-surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">AI 维护建议</h2>
          </div>
          <Link
            to="/ai-tasks"
            className="rounded-lg bg-primary-container px-4 py-2 text-on-primary-container transition-colors hover:bg-primary-fixed"
          >
            进入维护任务
          </Link>
        </div>
      </div>
    </div>
  )
}
