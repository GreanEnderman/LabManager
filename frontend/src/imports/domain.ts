import type {
  ChemicalImportRecord,
  EquipmentImportRecord,
  ImportBatchRecord,
  ImportEntityType,
  ImportErrorItem,
  ImportSource,
} from './types'

function buildImportId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function getTodayISOString() {
  return new Date().toISOString()
}

function dedupeKey(parts: Array<string | number>) {
  return parts.join('|').trim().toLowerCase()
}

function buildStatus(successCount: number, failureCount: number): ImportBatchRecord['status'] {
  if (successCount === 0 && failureCount > 0) return 'failed'
  if (failureCount > 0) return 'partial_failed'
  return 'completed'
}

export function buildInitialChemicalRecords(): ChemicalImportRecord[] {
  return []
}

export function buildInitialEquipmentRecords(): EquipmentImportRecord[] {
  return []
}

export function buildInitialImportHistory(): ImportBatchRecord[] {
  return []
}

export function validateChemicalRows(rows: ChemicalImportRecord[]) {
  const errors: ImportErrorItem[] = []
  const validRows: ChemicalImportRecord[] = []
  const seen = new Set<string>()

  rows.forEach((row, index) => {
    const rowNumber = index + 1
    let invalid = false
    if (!row.name.trim()) {
      errors.push({ rowNumber, field: 'name', code: 'required', message: '化学品名称不能为空', rawValue: row.name })
      invalid = true
    }
    if (!Number.isFinite(row.currentQuantity) || row.currentQuantity < 0) {
      errors.push({
        rowNumber,
        field: 'currentQuantity',
        code: 'invalid_number',
        message: '库存数量必须为非负数字',
        rawValue: row.currentQuantity,
      })
      invalid = true
    }
    if (!Number.isFinite(row.threshold) || row.threshold < 0) {
      errors.push({
        rowNumber,
        field: 'threshold',
        code: 'invalid_number',
        message: '阈值必须为非负数字',
        rawValue: row.threshold,
      })
      invalid = true
    }
    const key = dedupeKey([row.id, row.name])
    if (seen.has(key)) {
      errors.push({
        rowNumber,
        field: 'id',
        code: 'duplicate_record',
        message: '导入批次内存在重复化学品记录',
        rawValue: row.id || row.name,
      })
      invalid = true
    } else {
      seen.add(key)
    }
    if (!invalid) {
      validRows.push({
        ...row,
        status: row.currentQuantity <= row.threshold ? 'low_stock' : row.status || 'normal',
        updatedAt: row.updatedAt || getTodayISOString(),
      })
    }
  })

  return { validRows, errors }
}

export function validateEquipmentRows(rows: EquipmentImportRecord[]) {
  const errors: ImportErrorItem[] = []
  const validRows: EquipmentImportRecord[] = []
  const seen = new Set<string>()

  rows.forEach((row, index) => {
    const rowNumber = index + 1
    let invalid = false
    if (!row.name.trim()) {
      errors.push({ rowNumber, field: 'name', code: 'required', message: '设备名称不能为空', rawValue: row.name })
      invalid = true
    }
    if (!row.status.trim()) {
      errors.push({ rowNumber, field: 'status', code: 'required', message: '设备状态不能为空', rawValue: row.status })
      invalid = true
    }
    const key = dedupeKey([row.id, row.name, row.labName])
    if (seen.has(key)) {
      errors.push({
        rowNumber,
        field: 'id',
        code: 'duplicate_record',
        message: '导入批次内存在重复设备记录',
        rawValue: row.id || row.name,
      })
      invalid = true
    } else {
      seen.add(key)
    }
    if (!invalid) {
      validRows.push({
        ...row,
        updatedAt: row.updatedAt || getTodayISOString(),
      })
    }
  })

  return { validRows, errors }
}

export function createImportBatch(params: {
  entityType: ImportEntityType
  source: ImportSource
  fileName?: string | null
  importedBy: string
  importedRecordIds: string[]
  totalCount: number
  errors: ImportErrorItem[]
  generatedEventCount: number
}) {
  const successCount = params.importedRecordIds.length
  const failureCount = params.errors.length
  return {
    id: buildImportId('import-batch'),
    entityType: params.entityType,
    source: params.source,
    fileName: params.fileName ?? null,
    status: buildStatus(successCount, failureCount),
    totalCount: params.totalCount,
    successCount,
    failureCount,
    createdAt: getTodayISOString(),
    importedBy: params.importedBy,
    importedRecordIds: params.importedRecordIds,
    generatedEventCount: params.generatedEventCount,
    errors: params.errors,
  } satisfies ImportBatchRecord
}

export function createEmptyChemicalRow(): ChemicalImportRecord {
  return {
    id: buildImportId('chem'),
    name: '',
    casNumber: '',
    category: '有机溶剂',
    spec: '',
    currentQuantity: 0,
    batchNumber: '',
    openedAt: '',
    expiryDate: '',
    threshold: 5,
    status: 'normal',
    ownerName: '',
    updatedAt: '',
    imageDataUrl: '',
    remark: '',
  }
}

export function createEmptyEquipmentRow(): EquipmentImportRecord {
  return {
    id: buildImportId('equipment'),
    name: '',
    vendor: '',
    model: '',
    status: '正常',
    labName: '',
    ownerName: '',
    lastMaintenanceAt: '',
    updatedAt: '',
    imageDataUrl: '',
    remark: '',
  }
}

