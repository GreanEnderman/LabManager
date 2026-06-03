import type {
  AIApprovalDTO,
  AIReportDTO,
  AITaskActionDTO,
  AITaskDTO,
} from '../contracts/api'
import type {
  ChemicalInventoryDTO,
  EquipmentAssetDTO,
  ImportBatchDTO,
} from '../contracts/shared'
import type {
  AIApprovalRecord,
  ChemicalInventoryRecord,
  EquipmentAssetRecord,
  ImportBatchRecord,
  AIReportRecord,
  ReportDeliveryConfigRecord,
  ReportDeliveryRecord,
  SupervisorEmailMappingRecord,
  AITaskActionRecord,
  AITaskRecord,
} from './models'

export function toTaskDTO(task: AITaskRecord): AITaskDTO {
  return { ...task }
}

export function toApprovalDTO(approval: AIApprovalRecord): AIApprovalDTO {
  return { ...approval }
}

export function toTaskActionDTO(action: AITaskActionRecord): AITaskActionDTO {
  return { ...action }
}

export function toReportDTO(report: AIReportRecord): AIReportDTO {
  return { ...report }
}

export function toChemicalInventoryDTO(record: ChemicalInventoryRecord): ChemicalInventoryDTO {
  return {
    id: record.id,
    name: record.name,
    casNumber: record.casNumber,
    category: record.category,
    spec: record.spec,
    currentQuantity: record.currentQuantity,
    threshold: record.threshold,
    status: record.status,
    ownerName: record.ownerName,
    updatedAt: record.updatedAt,
    imageDataUrl: record.imageDataUrl,
    remark: record.remark,
    metadata: record.metadata,
  }
}

export function toEquipmentAssetDTO(record: EquipmentAssetRecord): EquipmentAssetDTO {
  return { ...record }
}

export function toImportBatchDTO(record: ImportBatchRecord): ImportBatchDTO {
  return {
    ...record,
    errors: record.errors.map((error) => ({ ...error })),
  }
}

export function toSupervisorEmailMappingDTO(record: SupervisorEmailMappingRecord) {
  return { ...record }
}

export function toReportDeliveryConfigDTO(record: ReportDeliveryConfigRecord) {
  return { ...record }
}

export function toReportDeliveryRecordDTO(record: ReportDeliveryRecord) {
  return { ...record }
}
