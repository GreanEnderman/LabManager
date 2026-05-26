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
  UserRecord,
} from '../domain/models'
import type { SystemSettingsDTO } from '../contracts/shared'

export interface AIDataStore {
  tasks: Map<string, AITaskRecord>
  approvals: Map<string, AIApprovalRecord>
  actions: Map<string, AITaskActionRecord>
  reports: Map<string, AIReportRecord>
  reportDeliveryMappings: Map<string, SupervisorEmailMappingRecord>
  reportDeliveryConfigs: Map<string, ReportDeliveryConfigRecord>
  reportDeliveryRecords: Map<string, ReportDeliveryRecord>
  users: Map<string, UserRecord>
  chemicals: Map<string, ChemicalInventoryRecord>
  equipment: Map<string, EquipmentAssetRecord>
  importBatches: Map<string, ImportBatchRecord>
  settings: SystemSettingsDTO | null
}

export function createInMemoryAIDataStore(): AIDataStore {
  return {
    tasks: new Map<string, AITaskRecord>(),
    approvals: new Map<string, AIApprovalRecord>(),
    actions: new Map<string, AITaskActionRecord>(),
    reports: new Map<string, AIReportRecord>(),
    reportDeliveryMappings: new Map<string, SupervisorEmailMappingRecord>(),
    reportDeliveryConfigs: new Map<string, ReportDeliveryConfigRecord>(),
    reportDeliveryRecords: new Map<string, ReportDeliveryRecord>(),
    users: new Map<string, UserRecord>(),
    chemicals: new Map<string, ChemicalInventoryRecord>(),
    equipment: new Map<string, EquipmentAssetRecord>(),
    importBatches: new Map<string, ImportBatchRecord>(),
    settings: null,
  }
}
