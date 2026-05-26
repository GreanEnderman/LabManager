import { useEffect, useMemo, useState } from 'react'
import { aiAppClient } from '../runtime/aiAppFacadeAsync'

export default function InboundOutbound() {
  const [keyword, setKeyword] = useState('')
  const [movementType, setMovementType] = useState('全部类型')
  const [transactions, setTransactions] = useState<Array<{
    id: string
    date: string
    name: string
    type: string
    quantity: string
    unit: string
    operator: string
    reason: string
  }>>([])
  const [loading, setLoading] = useState(true)

  async function loadTransactions() {
    setLoading(true)
    try {
      const data = await aiAppClient.listInventoryTransactions()
      setTransactions(data)
    } catch (error) {
      console.error('Failed to load transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTransactions()
  }, [])

  const filteredRecords = useMemo(
    () =>
      transactions.filter((record) => {
        const searchText = keyword.trim()
        const matchesKeyword = searchText === '' || record.name.includes(searchText)
        const matchesType = movementType === '全部类型' || record.type === movementType
        return matchesKeyword && matchesType
      }),
    [keyword, movementType, transactions],
  )

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-on-surface">出入库记录</h1>
        <button
          onClick={loadTransactions}
          className="rounded-lg bg-primary px-4 py-2 text-on-primary transition-colors hover:bg-primary-container"
        >
          刷新
        </button>
      </div>

      <div className="mb-6 rounded-lg border border-outline-variant bg-surface p-4">
        <div className="flex gap-4">
          <input type="text" placeholder="搜索物料..." value={keyword} onChange={(event) => setKeyword(event.target.value)} className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2" />
          <select value={movementType} onChange={(event) => setMovementType(event.target.value)} className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2">
            <option>全部类型</option>
            <option>入库</option>
            <option>出库</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface">
        <table className="w-full">
          <thead className="bg-surface-container-high">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">时间</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">物料名称</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">操作类型</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">数量</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">经手人</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">用途说明</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-on-surface-variant">
                  加载中...
                </td>
              </tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-on-surface-variant">
                  暂无记录
                </td>
              </tr>
            ) : (
              filteredRecords.map((record) => {
                const isInbound = record.type === '入库'
                return (
                  <tr key={record.id} className="transition-colors hover:bg-surface-container-low">
                    <td className="px-6 py-4 text-on-surface-variant">{record.date || '-'}</td>
                    <td className="px-6 py-4 text-on-surface">{record.name}</td>
                    <td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-sm ${isInbound ? 'bg-secondary-container text-on-secondary-container' : 'bg-tertiary-container text-on-tertiary-container'}`}>{record.type}</span></td>
                    <td className="px-6 py-4 font-medium text-on-surface">{record.quantity} {record.unit}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{record.operator || '-'}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{record.reason || '-'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
