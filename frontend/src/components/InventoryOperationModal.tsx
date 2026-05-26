import { useState } from 'react'

interface ChemicalInfo {
  id: string
  name: string
  currentQuantity: number
  unit?: string
}

interface InventoryOperation {
  entityType: 'chemical'
  entityId: string
  operationType: 'inbound' | 'outbound'
  quantity: number
  unit: string
  operator: { id: string; name: string; type: string }
  reason: string
  metadata: Record<string, unknown>
}

interface InventoryOperationModalProps {
  isOpen: boolean
  chemical: ChemicalInfo | null
  operationType: 'inbound' | 'outbound'
  onSubmit: (operation: InventoryOperation) => Promise<void>
  onClose: () => void
}

export default function InventoryOperationModal({
  isOpen,
  chemical,
  operationType,
  onSubmit,
  onClose,
}: InventoryOperationModalProps) {
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('瓶')
  const [reason, setReason] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen || !chemical) return null

  const isOutbound = operationType === 'outbound'
  const title = isOutbound ? '出库操作' : '入库操作'
  const submitButtonText = isOutbound ? '确认出库' : '确认入库'

  const resetForm = () => {
    setQuantity('')
    setUnit('瓶')
    setReason('')
    setBatchNumber('')
    setError('')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    const qty = parseInt(quantity, 10)
    if (Number.isNaN(qty) || qty <= 0) {
      setError('数量必须为正整数')
      return
    }

    if (isOutbound && qty > chemical.currentQuantity) {
      setError(`库存不足，当前库存 ${chemical.currentQuantity}`)
      return
    }

    if (isOutbound && !reason.trim()) {
      setError('出库时必须填写原因')
      return
    }

    setSubmitting(true)

    try {
      await onSubmit({
        entityType: 'chemical',
        entityId: chemical.id,
        operationType,
        quantity: qty,
        unit: unit || '瓶',
        operator: {
          id: 'frontend-user',
          name: 'Frontend User',
          type: 'user',
        },
        reason: reason.trim(),
        metadata: {
          batchNumber: batchNumber.trim() || undefined,
        },
      })

      resetForm()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!submitting) {
      resetForm()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-xl">
        <h2 className="mb-4 text-2xl font-bold text-on-surface">{title}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface-variant">化学品名称</label>
            <input type="text" value={chemical.name} disabled className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-on-surface opacity-60" />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant">当前库存</label>
            <input type="text" value={`${chemical.currentQuantity} ${chemical.unit || '瓶'}`} disabled className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-on-surface opacity-60" />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant">数量 <span className="text-error">*</span></label>
            <input type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} min="1" required className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-on-surface focus:border-primary focus:outline-none" placeholder="请输入数量" />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant">单位</label>
            <input type="text" value={unit} onChange={(event) => setUnit(event.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-on-surface focus:border-primary focus:outline-none" placeholder="瓶" />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant">原因 {isOutbound ? <span className="text-error">*</span> : null}</label>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} required={isOutbound} rows={3} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-on-surface focus:border-primary focus:outline-none" placeholder={isOutbound ? '请输入出库原因（必填）' : '请输入入库原因（可选）'} />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant">批次号（可选）</label>
            <input type="text" value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-on-surface focus:border-primary focus:outline-none" placeholder="请输入批次号" />
          </div>

          {error ? <div className="rounded-lg bg-error-container p-3 text-sm text-error">{error}</div> : null}

          <div className="flex gap-3">
            <button type="button" onClick={handleClose} disabled={submitting} className="flex-1 rounded-lg border border-outline-variant bg-surface px-4 py-2 text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50">取消</button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 rounded-lg px-4 py-2 text-white transition-colors disabled:opacity-50 ${
                isOutbound
                  ? 'bg-error hover:bg-error-container hover:text-error'
                  : 'bg-tertiary hover:bg-tertiary-container hover:text-on-tertiary-container'
              }`}
            >
              {submitting ? '处理中...' : submitButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
