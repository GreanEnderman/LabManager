import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { equipment as seedEquipment, movements as seedMovements } from '../data'
import { aiAppClient } from '../runtime/aiAppFacadeAsync'
import type {
  ChemicalImportRecord,
  EquipmentImportRecord,
  ImportBatchRecord,
  ImportErrorItem,
  ImportSource,
  MaintenanceImportRecord,
  MovementImportRecord,
} from './types'

/* eslint-disable react-refresh/only-export-components */

// Live import provider - chemicals/equipment use HTTP backend, movements/maintenance are local auxiliary data.
// HTTP failures throw and propagate - no silent fallback to mock data.

interface ImportContextValue {
  isLoading: boolean
  isSubmitting: boolean
  chemicals: ChemicalImportRecord[]
  equipment: EquipmentImportRecord[]
  movements: MovementImportRecord[]
  maintenanceRecords: MaintenanceImportRecord[]
  batches: ImportBatchRecord[]
  refreshChemicals(): Promise<void>
  updateChemicalQuantity(update: { id: string; currentQuantity: number }): void
  deleteChemical(chemicalId: string): Promise<void>
  deleteEquipment(equipmentId: string): Promise<void>
  importChemicals(rows: ChemicalImportRecord[], source: ImportSource, fileName: string | null, importedBy: string): Promise<ImportBatchRecord>
  importEquipment(rows: EquipmentImportRecord[], source: ImportSource, fileName: string | null, importedBy: string): Promise<ImportBatchRecord>
  importMovements(rows: MovementImportRecord[], source: ImportSource, fileName: string | null, importedBy: string): Promise<ImportBatchRecord>
  importMaintenanceRecords(rows: MaintenanceImportRecord[], source: ImportSource, fileName: string | null, importedBy: string): Promise<ImportBatchRecord>
}

const ImportContext = createContext<ImportContextValue | null>(null)
const MOVEMENTS_STORAGE_KEY = 'labmanager.import.movements'
const MAINTENANCE_STORAGE_KEY = 'labmanager.import.maintenance'
const LOCAL_BATCHES_STORAGE_KEY = 'labmanager.import.batches.local'

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function mapSeedMovements(): MovementImportRecord[] {
  return seedMovements.map((item) => ({
    id: item.id,
    date: item.date ?? '',
    name: item.name,
    type: item.type,
    quantity: item.quantity ?? '',
    operator: item.operator,
    reason: item.reason,
  }))
}

function buildSeedMaintenance(): MaintenanceImportRecord[] {
  return seedEquipment.map((item) => ({
    id: `maintenance-${item.id}`,
    equipmentId: item.id,
    equipmentName: item.name,
    status: item.status === '正常' ? '已维护' : '异常',
    maintenanceAt: item.lastMaintenanceAt ?? '',
    engineer: '系统导入',
    summary:
      item.status === '正常'
        ? '当前维护记录正常，可继续按照计划周期执行下一次维护。'
        : `设备状态为${item.status}，建议优先安排人工检查和维修。`,
  }))
}

function buildLocalBatch(params: {
  entityType: ImportBatchRecord['entityType']
  source: ImportSource
  fileName: string | null
  importedBy: string
  totalCount: number
  importedRecordIds: string[]
  errors?: ImportErrorItem[]
}): ImportBatchRecord {
  const errors = params.errors ?? []
  const successCount = params.importedRecordIds.length
  const failureCount = errors.length
  return {
    id: `local-import-${params.entityType}-${Date.now()}`,
    entityType: params.entityType,
    source: params.source,
    fileName: params.fileName,
    status: successCount === 0 && failureCount > 0 ? 'failed' : failureCount > 0 ? 'partial_failed' : 'completed',
    totalCount: params.totalCount,
    successCount,
    failureCount,
    createdAt: new Date().toISOString(),
    importedBy: params.importedBy,
    importedRecordIds: params.importedRecordIds,
    generatedEventCount: 0,
    errors,
  }
}

function mergeById<T extends { id: string }>(current: T[], nextItems: T[]) {
  const nextById = new Map(nextItems.map((item) => [item.id, item]))
  const merged = current.map((item) => nextById.get(item.id) ?? item)
  const existingIds = new Set(current.map((item) => item.id))
  return [...nextItems.filter((item) => !existingIds.has(item.id)), ...merged]
}

function validateMovementRows(rows: MovementImportRecord[]) {
  const errors: ImportErrorItem[] = []
  const validRows: MovementImportRecord[] = []
  const requiredFields: Array<{ key: keyof MovementImportRecord; label: string }> = [
    { key: 'date', label: '业务时间' },
    { key: 'name', label: '物料名称' },
    { key: 'type', label: '类型' },
    { key: 'quantity', label: '数量' },
    { key: 'operator', label: '经手人' },
    { key: 'reason', label: '原因' },
  ]

  rows.forEach((row, index) => {
    const rowNumber = index + 1
    const missingField = requiredFields.find((field) => String(row[field.key] ?? '').trim() === '')
    if (missingField) {
      errors.push({
        rowNumber,
        field: missingField.key,
        code: 'required',
        message: `${missingField.label}不能为空`,
        rawValue: row[missingField.key],
      })
      return
    }

    if (!normalizeMovementBusinessDate(row.date)) {
      errors.push({
        rowNumber,
        field: 'date',
        code: 'required',
        message: '业务时间需至少填写完整年月日，时分秒可不填',
        rawValue: row.date,
      })
      return
    }

    const quantity = Number(row.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push({
        rowNumber,
        field: 'quantity',
        code: 'invalid_number',
        message: '数量必须是大于 0 的数字',
        rawValue: row.quantity,
      })
      return
    }

    if (!normalizeMovementOperationType(row.type)) {
      errors.push({
        rowNumber,
        field: 'type',
        code: 'required',
        message: '类型必须是入库或出库',
        rawValue: row.type,
      })
      return
    }

    validRows.push(row)
  })

  return { validRows, errors }
}

function normalizeMovementBusinessDate(value: string) {
  const normalized = value.trim().replace('T', ' ')
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
  if (!match) return null

  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  )
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day) ||
    date.getHours() !== Number(hour) ||
    date.getMinutes() !== Number(minute) ||
    date.getSeconds() !== Number(second)
  ) {
    return null
  }

  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function normalizeMovementOperationType(type: string): 'inbound' | 'outbound' | null {
  const normalized = normalizeText(type)
  if (normalized === '入库' || normalized === 'inbound') return 'inbound'
  if (normalized === '出库' || normalized === 'outbound') return 'outbound'
  return null
}

function findChemicalForMovement(row: MovementImportRecord, chemicals: ChemicalImportRecord[]) {
  const target = normalizeText(row.name)
  return chemicals.find((chemical) => normalizeText(chemical.id) === target || normalizeText(chemical.name) === target)
}

function mapInventoryOperationToMovement(row: MovementImportRecord, operation: Awaited<ReturnType<typeof aiAppClient.createInventoryOperation>>['operation']): MovementImportRecord {
  return {
    id: operation.id,
    date: operation.operationDate || row.date,
    name: operation.entityName || row.name,
    type: operation.operationType === 'inbound' ? '入库' : '出库',
    quantity: String(operation.quantity),
    operator: operation.operatorName || row.operator,
    reason: operation.reason ?? row.reason,
  }
}

export function ImportProvider({ children }: { children: ReactNode }) {
  const [chemicals, setChemicals] = useState<ChemicalImportRecord[]>([])
  const [equipment, setEquipment] = useState<EquipmentImportRecord[]>([])
  const [movements, setMovements] = useState<MovementImportRecord[]>(() => readStorage(MOVEMENTS_STORAGE_KEY, mapSeedMovements()))
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceImportRecord[]>(() =>
    readStorage(MAINTENANCE_STORAGE_KEY, buildSeedMaintenance()),
  )
  const [remoteBatches, setRemoteBatches] = useState<ImportBatchRecord[]>([])
  const [localBatches, setLocalBatches] = useState<ImportBatchRecord[]>(() => readStorage(LOCAL_BATCHES_STORAGE_KEY, []))
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function refreshRemoteBatches() {
    setRemoteBatches(await aiAppClient.listImportBatches().catch(() => []))
  }

  async function refreshImports() {
    try {
      const [nextChemicals, nextEquipment, nextBatches] = await Promise.all([
        aiAppClient.listChemicals().catch(() => []),
        aiAppClient.listEquipment().catch(() => []),
        aiAppClient.listImportBatches().catch(() => []),
      ])
      setChemicals(nextChemicals)
      setEquipment(nextEquipment)
      setRemoteBatches(nextBatches)
    } catch (error) {
      console.warn('Failed to load imports from backend:', error)
      // Use empty arrays if backend doesn't have these APIs yet
      setChemicals([])
      setEquipment([])
      setRemoteBatches([])
    }
  }

  useEffect(() => {
    refreshImports().finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    writeStorage(MOVEMENTS_STORAGE_KEY, movements)
  }, [movements])

  useEffect(() => {
    writeStorage(MAINTENANCE_STORAGE_KEY, maintenanceRecords)
  }, [maintenanceRecords])

  useEffect(() => {
    writeStorage(LOCAL_BATCHES_STORAGE_KEY, localBatches)
  }, [localBatches])

  const batches = useMemo(
    () => [...localBatches, ...remoteBatches].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [localBatches, remoteBatches],
  )

  const value = useMemo<ImportContextValue>(
    () => ({
      isLoading,
      isSubmitting,
      chemicals,
      equipment,
      movements,
      maintenanceRecords,
      batches,
      async refreshChemicals() {
        try {
          const nextChemicals = await aiAppClient.listChemicals()
          setChemicals(nextChemicals)
        } catch (error) {
          console.warn('Failed to refresh chemicals:', error)
        }
      },
      updateChemicalQuantity(update) {
        setChemicals((current) =>
          current.map((item) =>
            item.id === update.id
              ? {
                  ...item,
                  currentQuantity: update.currentQuantity,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        )
      },
      async deleteChemical(chemicalId) {
        setIsSubmitting(true)
        try {
          await aiAppClient.deleteChemical(chemicalId)
          setChemicals((current) => current.filter((item) => item.id !== chemicalId))
          await refreshImports()
        } finally {
          setIsSubmitting(false)
        }
      },
      async deleteEquipment(equipmentId) {
        setIsSubmitting(true)
        try {
          await aiAppClient.deleteEquipment(equipmentId)
          setEquipment((current) => current.filter((item) => item.id !== equipmentId))
          setMaintenanceRecords((current) => current.filter((item) => item.equipmentId !== equipmentId))
          await refreshImports()
        } finally {
          setIsSubmitting(false)
        }
      },
      async importChemicals(rows, source, fileName, importedBy) {
        setIsSubmitting(true)
        try {
          const response = await aiAppClient.importChemicals(rows, source, fileName, importedBy)
          setChemicals((current) => mergeById(current, response.records))
          setRemoteBatches((current) => mergeById(current, [response.batch]))
          await refreshRemoteBatches()
          return response.batch
        } finally {
          setIsSubmitting(false)
        }
      },
      async importEquipment(rows, source, fileName, importedBy) {
        setIsSubmitting(true)
        try {
          const response = await aiAppClient.importEquipment(rows, source, fileName, importedBy)
          setEquipment((current) => mergeById(current, response.records))
          setRemoteBatches((current) => mergeById(current, [response.batch]))
          await refreshRemoteBatches()
          return response.batch
        } finally {
          setIsSubmitting(false)
        }
      },
      async importMovements(rows, source, fileName, importedBy) {
        setIsSubmitting(true)
        try {
          const { validRows, errors } = validateMovementRows(rows)
          const importedRows: MovementImportRecord[] = []

          for (const [index, row] of validRows.entries()) {
            const chemical = findChemicalForMovement(row, chemicals)
            const operationType = normalizeMovementOperationType(row.type)

            if (!chemical || !operationType) {
              errors.push({
                rowNumber: rows.indexOf(row) + 1 || index + 1,
                field: !chemical ? 'name' : 'type',
                code: 'required',
                message: !chemical ? `未找到匹配的化学品：${row.name}` : '类型必须是入库或出库',
                rawValue: !chemical ? row.name : row.type,
              })
              continue
            }

            try {
              const operationDate = normalizeMovementBusinessDate(row.date)
              const response = await aiAppClient.createInventoryOperation({
                entityType: 'chemical',
                entityId: chemical.id,
                operationType,
                quantity: Number(row.quantity),
                unit: chemical.spec || '',
                operator: {
                  id: row.operator || importedBy,
                  name: row.operator || importedBy,
                  type: 'user',
                },
                reason: row.reason,
                operationDate: operationDate ?? undefined,
                metadata: {
                  importRecordId: row.id,
                  importSource: source,
                  importFileName: fileName,
                },
              })
              importedRows.push(mapInventoryOperationToMovement(row, response.operation))
              setChemicals((current) =>
                current.map((item) =>
                  item.id === response.updatedEntity.id
                    ? {
                        ...item,
                        currentQuantity: response.updatedEntity.currentQuantity,
                        updatedAt: new Date().toISOString(),
                      }
                    : item,
                ),
              )
            } catch (error) {
              errors.push({
                rowNumber: rows.indexOf(row) + 1 || index + 1,
                field: 'name',
                code: 'required',
                message: error instanceof Error ? error.message : `出入库流水写入失败：${row.name}`,
                rawValue: row.name,
              })
            }
          }

          setMovements((current) => {
            const recordMap = new Map(current.map((item) => [item.id, item]))
            importedRows.forEach((row) => recordMap.set(row.id, row))
            return [...recordMap.values()].sort((left, right) => right.date.localeCompare(left.date))
          })
          const batch = buildLocalBatch({
            entityType: 'movement',
            source,
            fileName,
            importedBy,
            totalCount: rows.length,
            importedRecordIds: importedRows.map((row) => row.id),
            errors,
          })
          setLocalBatches((current) => [batch, ...current])
          return batch
        } finally {
          setIsSubmitting(false)
        }
      },
      async importMaintenanceRecords(rows, source, fileName, importedBy) {
        setIsSubmitting(true)
        try {
          setMaintenanceRecords((current) => {
            const recordMap = new Map(current.map((item) => [item.id, item]))
            rows.forEach((row) => recordMap.set(row.id, row))
            return [...recordMap.values()].sort((left, right) => right.maintenanceAt.localeCompare(left.maintenanceAt))
          })
          const batch = buildLocalBatch({
            entityType: 'maintenance',
            source,
            fileName,
            importedBy,
            totalCount: rows.length,
            importedRecordIds: rows.map((row) => row.id),
          })
          setLocalBatches((current) => [batch, ...current])
          return batch
        } finally {
          setIsSubmitting(false)
        }
      },
    }),
    [batches, chemicals, equipment, isLoading, isSubmitting, maintenanceRecords, movements],
  )

  return <ImportContext.Provider value={value}>{children}</ImportContext.Provider>
}

export function useImports() {
  const context = useContext(ImportContext)
  if (!context) throw new Error('useImports must be used within ImportProvider')
  return context
}

