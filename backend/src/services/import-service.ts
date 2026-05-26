import type {
  ChemicalImportRowDTO,
  ChemicalInventoryDTO,
  EquipmentAssetDTO,
  EquipmentImportRowDTO,
  ImportBatchDetailDTO,
  ImportChemicalsRequest,
  ImportChemicalsResponse,
  ImportEquipmentRequest,
  ImportEquipmentResponse,
  ListImportBatchesQuery,
  SystemSettingsDTO,
} from '../contracts/shared'
import {
  toChemicalInventoryDTO,
  toEquipmentAssetDTO,
  toImportBatchDTO,
} from '../domain/mappers'
import type {
  ChemicalInventoryRecord,
  EquipmentAssetRecord,
  ImportBatchRecord,
  ImportErrorRecord,
} from '../domain/models'
import { EntityNotFoundError, ValidationError } from './errors'
import type { Clock } from './clock'
import type { IdGenerator } from './id-generator'
import type { AIDataStore } from './store'

export interface ImportServiceDependencies {
  store: AIDataStore
  idGenerator: IdGenerator
  clock: Clock
  getSettings(): SystemSettingsDTO
  inspectRules(input: {
    chemicals?: Array<{
      id: string
      name: string
      totalQuantity: number
      threshold: number
    }>
    equipment?: Array<{
      id: string
      name: string
      status: string
      lastMaintenanceAt: string | null
    }>
    config: {
      now: string
      maintenanceOverdueDays: number
    }
  }): { items: Array<unknown> }
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function buildBatchStatus(successCount: number, failureCount: number): ImportBatchRecord['status'] {
  if (successCount === 0 && failureCount > 0) return 'failed'
  if (failureCount > 0) return 'partial_failed'
  return 'completed'
}

export class ImportService {
  constructor(private readonly deps: ImportServiceDependencies) {}

  importChemicals(request: ImportChemicalsRequest): ImportChemicalsResponse {
    const settings = this.deps.getSettings()
    const now = this.deps.clock.now()
    const batchId = this.deps.idGenerator.next('import-batch')
    const errors: ImportErrorRecord[] = []
    const imported: ChemicalInventoryRecord[] = []
    const seenKeys = new Set<string>()

    request.rows.forEach((row, index) => {
      const rowNumber = index + 1
      const rowErrors = this.validateChemicalRow(row, rowNumber, seenKeys)
      if (rowErrors.length > 0) {
        errors.push(...rowErrors)
        return
      }

      const record = this.upsertChemical(row, settings, now)
      imported.push(record)
    })

    const batch = this.persistBatch({
      id: batchId,
      entityType: 'chemical',
      source: request.source,
      fileName: request.fileName ?? null,
      importedBy: request.importedBy,
      totalCount: request.rows.length,
      importedRecordIds: imported.map((item) => item.id),
      errors,
      createdAt: now,
      completedAt: this.deps.clock.now(),
      ruleInspectionTriggered: request.runRuleInspection !== false,
      generatedEventCount: 0,
      metadata: {
        duplicateErrorCount: errors.filter((item) => item.code === 'duplicate_record').length,
      },
    })

    if (batch.ruleInspectionTriggered) {
      batch.generatedEventCount = this.inspectCurrentData(batch.completedAt)
      this.deps.store.importBatches.set(batch.id, batch)
    }

    return {
      batch: toImportBatchDTO(batch),
      records: imported.map(toChemicalInventoryDTO),
    }
  }

  importEquipment(request: ImportEquipmentRequest): ImportEquipmentResponse {
    const now = this.deps.clock.now()
    const batchId = this.deps.idGenerator.next('import-batch')
    const errors: ImportErrorRecord[] = []
    const imported: EquipmentAssetRecord[] = []
    const seenKeys = new Set<string>()

    request.rows.forEach((row, index) => {
      const rowNumber = index + 1
      const rowErrors = this.validateEquipmentRow(row, rowNumber, seenKeys)
      if (rowErrors.length > 0) {
        errors.push(...rowErrors)
        return
      }

      const record = this.upsertEquipment(row, now)
      imported.push(record)
    })

    const batch = this.persistBatch({
      id: batchId,
      entityType: 'equipment',
      source: request.source,
      fileName: request.fileName ?? null,
      importedBy: request.importedBy,
      totalCount: request.rows.length,
      importedRecordIds: imported.map((item) => item.id),
      errors,
      createdAt: now,
      completedAt: this.deps.clock.now(),
      ruleInspectionTriggered: request.runRuleInspection !== false,
      generatedEventCount: 0,
      metadata: {
        duplicateErrorCount: errors.filter((item) => item.code === 'duplicate_record').length,
      },
    })

    if (batch.ruleInspectionTriggered) {
      batch.generatedEventCount = this.inspectCurrentData(batch.completedAt)
      this.deps.store.importBatches.set(batch.id, batch)
    }

    return {
      batch: toImportBatchDTO(batch),
      records: imported.map(toEquipmentAssetDTO),
    }
  }

  listImportBatches(query: ListImportBatchesQuery = {}) {
    return [...this.deps.store.importBatches.values()]
      .filter((batch) => {
        if (query.entityType && batch.entityType !== query.entityType) return false
        if (query.status && batch.status !== query.status) return false
        return true
      })
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
      .map(toImportBatchDTO)
  }

  getImportBatchDetail(batchId: string): ImportBatchDetailDTO {
    const batch = this.deps.store.importBatches.get(batchId)
    if (!batch) {
      throw new EntityNotFoundError('ImportBatch', batchId)
    }

    const chemicals = batch.entityType === 'chemical'
      ? batch.importedRecordIds
        .map((id) => this.deps.store.chemicals.get(id))
        .filter((item): item is ChemicalInventoryRecord => Boolean(item))
        .map(toChemicalInventoryDTO)
      : []
    const equipment = batch.entityType === 'equipment'
      ? batch.importedRecordIds
        .map((id) => this.deps.store.equipment.get(id))
        .filter((item): item is EquipmentAssetRecord => Boolean(item))
        .map(toEquipmentAssetDTO)
      : []

    return {
      batch: toImportBatchDTO(batch),
      chemicals,
      equipment,
    }
  }

  listChemicals(): ChemicalInventoryDTO[] {
    return [...this.deps.store.chemicals.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(toChemicalInventoryDTO)
  }

  listEquipment(): EquipmentAssetDTO[] {
    return [...this.deps.store.equipment.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(toEquipmentAssetDTO)
  }

  private validateChemicalRow(
    row: ChemicalImportRowDTO,
    rowNumber: number,
    seenKeys: Set<string>,
  ): ImportErrorRecord[] {
    const errors: ImportErrorRecord[] = []
    const name = normalizeText(row.name)
    if (!name) {
      errors.push({
        rowNumber,
        field: 'name',
        code: 'required',
        message: 'Chemical name is required.',
        rawValue: row.name,
      })
    }

    if (!Number.isFinite(row.currentQuantity) || row.currentQuantity < 0) {
      errors.push({
        rowNumber,
        field: 'currentQuantity',
        code: 'invalid_number',
        message: 'Current quantity must be a non-negative number.',
        rawValue: row.currentQuantity,
      })
    }

    if (row.threshold != null && (!Number.isFinite(row.threshold) || row.threshold < 0)) {
      errors.push({
        rowNumber,
        field: 'threshold',
        code: 'invalid_number',
        message: 'Threshold must be a non-negative number.',
        rawValue: row.threshold,
      })
    }

    const duplicateKey = `${row.recordId ?? ''}|${name ?? ''}|${normalizeText(row.labName) ?? ''}`
    if (seenKeys.has(duplicateKey)) {
      errors.push({
        rowNumber,
        field: 'recordId',
        code: 'duplicate_record',
        message: 'Duplicate chemical row detected in the same import batch.',
        rawValue: row.recordId ?? row.name,
      })
    } else {
      seenKeys.add(duplicateKey)
    }

    return errors
  }

  private validateEquipmentRow(
    row: EquipmentImportRowDTO,
    rowNumber: number,
    seenKeys: Set<string>,
  ): ImportErrorRecord[] {
    const errors: ImportErrorRecord[] = []
    const name = normalizeText(row.name)
    const status = normalizeText(row.status)

    if (!name) {
      errors.push({
        rowNumber,
        field: 'name',
        code: 'required',
        message: 'Equipment name is required.',
        rawValue: row.name,
      })
    }

    if (!status) {
      errors.push({
        rowNumber,
        field: 'status',
        code: 'required',
        message: 'Equipment status is required.',
        rawValue: row.status,
      })
    }

    const duplicateKey = `${row.recordId ?? ''}|${name ?? ''}|${normalizeText(row.labName) ?? ''}`
    if (seenKeys.has(duplicateKey)) {
      errors.push({
        rowNumber,
        field: 'recordId',
        code: 'duplicate_record',
        message: 'Duplicate equipment row detected in the same import batch.',
        rawValue: row.recordId ?? row.name,
      })
    } else {
      seenKeys.add(duplicateKey)
    }

    return errors
  }

  private upsertChemical(
    row: ChemicalImportRowDTO,
    settings: SystemSettingsDTO,
    now: string,
  ): ChemicalInventoryRecord {
    const id = row.recordId ?? this.deps.idGenerator.next('chemical')
    const threshold = row.threshold ?? settings.thresholds.defaultLowStockThreshold
    const current = this.deps.store.chemicals.get(id)
    const status = normalizeText(row.status)
      ?? (row.currentQuantity <= threshold ? 'low_stock' : 'normal')

    const record: ChemicalInventoryRecord = {
      id,
      name: row.name.trim(),
      casNumber: normalizeText(row.casNumber),
      category: normalizeText(row.category),
      spec: normalizeText(row.spec),
      currentQuantity: row.currentQuantity,
      threshold,
      status,
      labName: normalizeText(row.labName),
      ownerName: normalizeText(row.ownerName),
      updatedAt: normalizeText(row.updatedAt) ?? now,
      imageDataUrl: normalizeText(row.imageDataUrl),
      remark: normalizeText(row.remark),
      metadata: {
        ...current?.metadata,
        ...(row.metadata ?? {}),
      },
    }

    this.deps.store.chemicals.set(record.id, record)
    return record
  }

  private upsertEquipment(row: EquipmentImportRowDTO, now: string): EquipmentAssetRecord {
    const id = row.recordId ?? this.deps.idGenerator.next('equipment-asset')
    const current = this.deps.store.equipment.get(id)
    const status = normalizeText(row.status)
    if (!status) {
      throw new ValidationError('Equipment status is required.')
    }

    const record: EquipmentAssetRecord = {
      id,
      name: row.name.trim(),
      vendor: normalizeText(row.vendor),
      model: normalizeText(row.model),
      status,
      labName: normalizeText(row.labName),
      ownerName: normalizeText(row.ownerName),
      lastMaintenanceAt: normalizeText(row.lastMaintenanceAt),
      updatedAt: normalizeText(row.updatedAt) ?? now,
      imageDataUrl: normalizeText(row.imageDataUrl),
      remark: normalizeText(row.remark),
      metadata: {
        ...current?.metadata,
        ...(row.metadata ?? {}),
      },
    }

    this.deps.store.equipment.set(record.id, record)
    return record
  }

  private persistBatch(
    payload: Omit<ImportBatchRecord, 'status' | 'successCount' | 'failureCount'>,
  ): ImportBatchRecord {
    const batch: ImportBatchRecord = {
      ...payload,
      successCount: payload.importedRecordIds.length,
      failureCount: payload.errors.length,
      status: buildBatchStatus(payload.importedRecordIds.length, payload.errors.length),
    }

    this.deps.store.importBatches.set(batch.id, batch)
    return batch
  }

  private inspectCurrentData(now: string): number {
    const settings = this.deps.getSettings()
    const response = this.deps.inspectRules({
      chemicals: [...this.deps.store.chemicals.values()].map((item) => ({
        id: item.id,
        name: item.name,
        totalQuantity: item.currentQuantity,
        threshold: item.threshold,
      })),
      equipment: [...this.deps.store.equipment.values()].map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        lastMaintenanceAt: item.lastMaintenanceAt,
      })),
      config: {
        now,
        maintenanceOverdueDays: settings.thresholds.maintenanceOverdueDays,
      },
    })

    return response.items.length
  }
}
