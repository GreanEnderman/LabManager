import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAI } from '../ai/AIStateLive'
import { useAISettingsRuntime } from '../ai/AISettingsRuntimeLive'
import { getTaskBySource } from '../ai/selectors'
import { getEffectiveChemicalThreshold } from '../ai/thresholds'
import { useImports } from '../imports/ImportContextLive'
import type { ChemicalImportRecord } from '../imports/types'
import InventoryOperationModal from '../components/InventoryOperationModal'
import { aiAppClient } from '../runtime/aiAppFacadeAsync'
import type { InventoryOperationInput, InventoryTransaction } from '../runtime/aiGateway'

type ViewMode = 'chemicals' | 'transactions'

function getChemicalInventoryStatus(currentQuantity: number, threshold: number) {
  return currentQuantity <= threshold ? '低库存' : '库存充足'
}

export default function ChemicalInventoryOps() {
  const [activeView, setActiveView] = useState<ViewMode>('chemicals')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
  const [movementKeyword, setMovementKeyword] = useState('')
  const [movementType, setMovementType] = useState('全部类型')
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedChemical, setSelectedChemical] = useState<ChemicalImportRecord | null>(null)
  const [operationType, setOperationType] = useState<'inbound' | 'outbound'>('inbound')
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { tasks } = useAI()
  const { settings } = useAISettingsRuntime()
  const { chemicals, refreshChemicals, deleteChemical, isSubmitting } = useImports()

  const filteredChemicals = useMemo(
    () =>
      chemicals.filter((item) => {
        const searchText = keyword.trim()
        const effectiveThreshold = getEffectiveChemicalThreshold(item, settings)
        const inventoryStatus = getChemicalInventoryStatus(item.currentQuantity, effectiveThreshold)
        return (
          (searchText === '' || item.name.includes(searchText) || item.id.includes(searchText)) &&
          (status === '全部状态' || inventoryStatus === status)
        )
      }),
    [chemicals, keyword, settings, status],
  )

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((record) => {
        const searchText = movementKeyword.trim()
        return (
          (searchText === '' || record.name.includes(searchText)) &&
          (movementType === '全部类型' || record.type === movementType)
        )
      }),
    [movementKeyword, movementType, transactions],
  )

  async function loadTransactions() {
    setTransactionsLoading(true)
    try {
      setTransactions(await aiAppClient.listInventoryTransactions())
    } catch (error) {
      console.error('Failed to load inventory transactions:', error)
    } finally {
      setTransactionsLoading(false)
    }
  }

  useEffect(() => {
    loadTransactions()
  }, [])

  const openOperationModal = (chemical: ChemicalImportRecord, type: 'inbound' | 'outbound') => {
    setSelectedChemical(chemical)
    setOperationType(type)
    setModalOpen(true)
  }

  const handleOperationSubmit = async (operation: InventoryOperationInput) => {
    try {
      await aiAppClient.createInventoryOperation(operation)
      setNotification({
        type: 'success',
        message: `${operation.operationType === 'inbound' ? '入库' : '出库'}操作成功`,
      })
      await refreshChemicals()
      await loadTransactions()
      setTimeout(() => setNotification(null), 3000)
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : '操作失败')
    }
  }

  const handleDeleteChemical = async (chemical: ChemicalImportRecord) => {
    if (!window.confirm(`确定要删除化学品“${chemical.name}”吗？相关出入库记录也会一并删除。`)) return

    try {
      await deleteChemical(chemical.id)
      setNotification({ type: 'success', message: `已删除化学品：${chemical.name}` })
      setTimeout(() => setNotification(null), 3000)
    } catch (error: unknown) {
      setNotification({ type: 'error', message: error instanceof Error ? error.message : '删除化学品失败' })
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
          <h1 className="text-3xl font-bold text-on-surface">化学品管理</h1>
        </div>
        <div className="flex gap-3">
          <Link to="/data-import" className="rounded-lg bg-surface-container-high px-4 py-2 text-on-surface transition-colors hover:bg-surface-container-highest">数据导入</Link>
          <Link to="/ai-tasks" className="rounded-lg bg-primary px-4 py-2 text-on-primary transition-colors hover:bg-primary-container">查看 AI 任务中心</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg bg-surface-container-low p-1">
          <button type="button" onClick={() => setActiveView('chemicals')} className={`rounded-md px-4 py-2 text-sm ${activeView === 'chemicals' ? 'bg-primary text-on-primary' : 'text-on-surface'}`}>化学品清单</button>
          <button type="button" onClick={() => setActiveView('transactions')} className={`rounded-md px-4 py-2 text-sm ${activeView === 'transactions' ? 'bg-primary text-on-primary' : 'text-on-surface'}`}>出入库记录</button>
        </div>
      </div>

      {activeView === 'chemicals' ? (
        <>
          <div className="rounded-lg border border-outline-variant bg-surface p-4">
            <div className="flex flex-wrap gap-4">
              <input type="text" placeholder="搜索化学品名称或 ID..." value={keyword} onChange={(event) => setKeyword(event.target.value)} className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2" />
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2">
                <option>全部状态</option>
                <option>库存充足</option>
                <option>低库存</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface">
            <table className="w-full">
              <thead className="bg-surface-container-high">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">记录 ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">名称</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">CAS</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">图片</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">分类</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">规格</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">当前库存</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">阈值</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">状态</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">AI 联动</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filteredChemicals.map((item) => {
                  const effectiveThreshold = getEffectiveChemicalThreshold(item, settings)
                  const inventoryStatus = getChemicalInventoryStatus(item.currentQuantity, effectiveThreshold)
                  const relatedTask = getTaskBySource(tasks, 'chemical', item.id)
                  const isLowStock = inventoryStatus === '低库存'
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-surface-container-low">
                      <td className="px-6 py-4 text-on-surface-variant">{item.id}</td>
                      <td className="px-6 py-4 text-on-surface">{item.name}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{item.casNumber || '-'}</td>
                      <td className="px-6 py-4">{item.imageDataUrl ? <img src={item.imageDataUrl} alt={item.name} className="h-12 w-12 rounded-lg border border-outline-variant object-cover" /> : <span className="text-sm text-on-surface-variant">无图</span>}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{item.category || '-'}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{item.spec || '-'}</td>
                      <td className="px-6 py-4 font-medium text-on-surface">{item.currentQuantity}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{effectiveThreshold}</td>
                      <td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-sm ${isLowStock ? 'bg-error-container text-error' : 'bg-secondary-container text-on-secondary-container'}`}>{inventoryStatus}</span></td>
                      <td className="px-6 py-4">{relatedTask ? <Link to="/ai-tasks" className="text-primary hover:text-primary-container">查看 AI 任务</Link> : <span className="text-sm text-on-surface-variant">暂无 AI 处理项</span>}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => openOperationModal(item, 'inbound')} className="rounded-lg bg-tertiary-container px-3 py-1 text-sm text-on-tertiary-container transition-colors hover:bg-tertiary hover:text-on-tertiary">入库</button>
                          <button onClick={() => openOperationModal(item, 'outbound')} className="rounded-lg bg-error-container px-3 py-1 text-sm text-error transition-colors hover:bg-error hover:text-on-error">出库</button>
                          <button onClick={() => handleDeleteChemical(item)} disabled={isSubmitting} className="rounded-lg border border-error px-3 py-1 text-sm text-error transition-colors hover:bg-error hover:text-on-error disabled:cursor-not-allowed disabled:opacity-50">删除</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant bg-surface-container-low px-6 py-4">
            <div>
              <h2 className="text-xl font-semibold text-on-surface">出入库记录</h2>
            </div>
            <button onClick={loadTransactions} className="rounded-lg border border-outline-variant px-4 py-2 text-sm text-on-surface transition-colors hover:bg-surface">刷新记录</button>
          </div>
          <div className="border-b border-outline-variant p-4">
            <div className="flex flex-wrap gap-4">
              <input type="text" placeholder="搜索物料..." value={movementKeyword} onChange={(event) => setMovementKeyword(event.target.value)} className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2" />
              <select value={movementType} onChange={(event) => setMovementType(event.target.value)} className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2">
                <option>全部类型</option>
                <option>入库</option>
                <option>出库</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
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
                {transactionsLoading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-on-surface-variant">加载中...</td></tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-on-surface-variant">暂无记录</td></tr>
                ) : (
                  filteredTransactions.map((record) => {
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
        </section>
      )}

      <InventoryOperationModal
        isOpen={modalOpen}
        chemical={selectedChemical}
        operationType={operationType}
        onSubmit={handleOperationSubmit}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}
