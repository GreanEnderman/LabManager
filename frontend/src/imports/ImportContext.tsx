import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  buildInitialChemicalRecords,
  buildInitialEquipmentRecords,
  buildInitialImportHistory,
  createImportBatch,
  validateChemicalRows,
  validateEquipmentRows,
} from './domain'
import type {
  ChemicalImportRecord,
  EquipmentImportRecord,
  ImportBatchRecord,
  ImportSource,
} from './types'

/* eslint-disable react-refresh/only-export-components */

interface ImportContextValue {
  chemicals: ChemicalImportRecord[]
  equipment: EquipmentImportRecord[]
  batches: ImportBatchRecord[]
  importChemicals(rows: ChemicalImportRecord[], source: ImportSource, fileName: string | null, importedBy: string): ImportBatchRecord
  importEquipment(rows: EquipmentImportRecord[], source: ImportSource, fileName: string | null, importedBy: string): ImportBatchRecord
}

const ImportContext = createContext<ImportContextValue | null>(null)

function countGeneratedChemicalEvents(rows: ChemicalImportRecord[]) {
  return rows.filter((row) => row.currentQuantity <= row.threshold).length
}

function countGeneratedEquipmentEvents(rows: EquipmentImportRecord[]) {
  return rows.filter((row) => row.status === '故障').length
}

export function ImportProvider({ children }: { children: ReactNode }) {
  const [chemicals, setChemicals] = useState<ChemicalImportRecord[]>(buildInitialChemicalRecords())
  const [equipment, setEquipment] = useState<EquipmentImportRecord[]>(buildInitialEquipmentRecords())
  const [batches, setBatches] = useState<ImportBatchRecord[]>(buildInitialImportHistory())

  const value = useMemo<ImportContextValue>(() => ({
    chemicals,
    equipment,
    batches,
    importChemicals(rows, source, fileName, importedBy) {
      const { validRows, errors } = validateChemicalRows(rows)
      if (validRows.length > 0) {
        setChemicals((current) => {
          const recordMap = new Map(current.map((item) => [item.id, item]))
          validRows.forEach((row) => recordMap.set(row.id, row))
          return [...recordMap.values()]
        })
      }

      const batch = createImportBatch({
        entityType: 'chemical',
        source,
        fileName,
        importedBy,
        importedRecordIds: validRows.map((row) => row.id),
        totalCount: rows.length,
        errors,
        generatedEventCount: countGeneratedChemicalEvents(validRows),
      })

      setBatches((current) => [batch, ...current])
      return batch
    },
    importEquipment(rows, source, fileName, importedBy) {
      const { validRows, errors } = validateEquipmentRows(rows)
      if (validRows.length > 0) {
        setEquipment((current) => {
          const recordMap = new Map(current.map((item) => [item.id, item]))
          validRows.forEach((row) => recordMap.set(row.id, row))
          return [...recordMap.values()]
        })
      }

      const batch = createImportBatch({
        entityType: 'equipment',
        source,
        fileName,
        importedBy,
        importedRecordIds: validRows.map((row) => row.id),
        totalCount: rows.length,
        errors,
        generatedEventCount: countGeneratedEquipmentEvents(validRows),
      })

      setBatches((current) => [batch, ...current])
      return batch
    },
  }), [batches, chemicals, equipment])

  return <ImportContext.Provider value={value}>{children}</ImportContext.Provider>
}

export function useImports() {
  const context = useContext(ImportContext)
  if (!context) {
    throw new Error('useImports must be used within ImportProvider')
  }
  return context
}
