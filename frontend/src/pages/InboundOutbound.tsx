import { useEffect, useMemo, useState } from 'react'
import { useImports } from '../imports/ImportContextLive'
import { aiAppClient } from '../runtime/aiAppFacadeAsync'
import { formatLocalDateTime } from '../runtime/dateTime'

interface TransactionRecord {
  id: string
  date: string
  name: string
  type: string
  quantity: string
  unit: string
  operator: string
  reason: string
}

function normalizeMovementType(type: string) {
  if (type === 'inbound' || type === '鍏ュ簱') return '入库'
  if (type === 'outbound' || type === '鍑哄簱') return '出库'
  return type
}

export default function InboundOutbound() {
  const { movements } = useImports()
  const [keyword, setKeyword] = useState('')
  const [movementType, setMovementType] = useState('全部类型')
  const [remoteTransactions, setRemoteTransactions] = useState<TransactionRecord[]>([])
  const [loading, setLoading] = useState(true)

  async function loadTransactions() {
    setLoading(true)
    try {
      const data = await aiAppClient.listInventoryTransactions()
      setRemoteTransactions(data)
    } catch (error) {
      console.error('Failed to load transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTransactions()
  }, [])

  const importedTransactions = useMemo<TransactionRecord[]>(
    () =>
      movements.map((record) => ({
        id: record.id,
        date: record.date,
        name: record.name,
        type: normalizeMovementType(record.type),
        quantity: record.quantity,
        unit: '',
        operator: record.operator,
        reason: record.reason,
      })),
    [movements],
  )

  const transactions = useMemo(() => {
    const transactionMap = new Map<string, TransactionRecord>()
    remoteTransactions.forEach((record) => transactionMap.set(record.id, { ...record, type: normalizeMovementType(record.type) }))
    importedTransactions.forEach((record) => transactionMap.set(record.id, record))
    return [...transactionMap.values()].sort((left, right) => right.date.localeCompare(left.date))
  }, [importedTransactions, remoteTransactions])

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
                    <td className="px-6 py-4 text-on-surface-variant">{formatLocalDateTime(record.date)}</td>
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
