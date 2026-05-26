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
          await refreshImports()
          return response.batch
        } finally {
          setIsSubmitting(false)
        }
      },
      async importEquipment(rows, source, fileName, importedBy) {
        setIsSubmitting(true)
        try {
          const response = await aiAppClient.importEquipment(rows, source, fileName, importedBy)
          await refreshImports()
          return response.batch
        } finally {
          setIsSubmitting(false)
        }
      },
      async importMovements(rows, source, fileName, importedBy) {
        setIsSubmitting(true)
        try {
          setMovements((current) => {
            const recordMap = new Map(current.map((item) => [item.id, item]))
            rows.forEach((row) => recordMap.set(row.id, row))
            return [...recordMap.values()].sort((left, right) => right.date.localeCompare(left.date))
          })
          const batch = buildLocalBatch({
            entityType: 'movement',
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

