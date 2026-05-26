export type ImportEntityType = 'chemical' | 'equipment' | 'movement' | 'maintenance'
export type ImportSource = 'manual' | 'excel'
export type ImportStatus = 'completed' | 'partial_failed' | 'failed'

export interface ImportErrorItem {
  rowNumber: number
  field: string
  code: 'required' | 'invalid_number' | 'duplicate_record'
  message: string
  rawValue: unknown
}

export interface ChemicalImportRecord {
  id: string
  name: string
  casNumber: string
  category: string
  spec: string
  currentQuantity: number
  threshold: number
  status: string
  labName: string
  ownerName: string
  updatedAt: string
  imageDataUrl: string
  remark: string
}

export interface EquipmentImportRecord {
  id: string
  name: string
  vendor: string
  model: string
  status: string
  labName: string
  ownerName: string
  lastMaintenanceAt: string
  updatedAt: string
  imageDataUrl: string
  remark: string
}

export interface MovementImportRecord {
  id: string
  date: string
  name: string
  type: string
  quantity: string
  operator: string
  reason: string
}

export interface MaintenanceImportRecord {
  id: string
  equipmentId: string
  equipmentName: string
  status: string
  maintenanceAt: string
  engineer: string
  summary: string
}

export interface ImportBatchRecord {
  id: string
  entityType: ImportEntityType
  source: ImportSource
  fileName: string | null
  status: ImportStatus
  totalCount: number
  successCount: number
  failureCount: number
  createdAt: string
  importedBy: string
  importedRecordIds: string[]
  generatedEventCount: number
  errors: ImportErrorItem[]
}

export type ChemicalImportField = keyof ChemicalImportRecord
export type EquipmentImportField = keyof EquipmentImportRecord
export type MovementImportField = keyof MovementImportRecord
export type MaintenanceImportField = keyof MaintenanceImportRecord
export type ImportFieldKey = ChemicalImportField | EquipmentImportField | MovementImportField | MaintenanceImportField

export interface ImportFieldOption {
  key: ImportFieldKey
  label: string
  required?: boolean
  type: 'text' | 'number' | 'date'
}

export interface ParsedImportColumn {
  sourceKey: string
  header: string
  sampleValue: string
  matchedField: ImportFieldKey | null
}

export interface ParsedImportDraft {
  rows: Array<Record<string, string>>
  columns: ParsedImportColumn[]
}
