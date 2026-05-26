import type {
  AIApprovalRecord,
  AIReportRecord,
  AITaskActionRecord,
  AITaskRecord,
  ChemicalInventoryRecord,
  EquipmentAssetRecord,
  ImportBatchRecord,
  ReportDeliveryConfigRecord,
  ReportDeliveryRecord,
  SupervisorEmailMappingRecord,
  UserRecord,
} from '../domain/models'
import type { SystemSettingsDTO } from '../contracts/shared'
import type { AIDataStore } from './store'
import type { FormalTableName } from '../domain/models'
import {
  formalPersistenceAuditPolicy,
  formalPersistenceSchemaArtifacts,
} from './formal-persistence-schema'

export interface FormalPersistenceTarget {
  readonly authoritativeTables: FormalTableName[]
  readonly snapshotMode: 'compatibility_only' | 'not_applicable'
  readonly schemaArtifacts: typeof formalPersistenceSchemaArtifacts
  readonly transitionNotes: string[]
}

export interface AIRepository {
  readonly tasks: Map<string, AITaskRecord>
  readonly approvals: Map<string, AIApprovalRecord>
  readonly actions: Map<string, AITaskActionRecord>
  readonly reports: Map<string, AIReportRecord>
  readonly reportDeliveryMappings: Map<string, SupervisorEmailMappingRecord>
  readonly reportDeliveryConfigs: Map<string, ReportDeliveryConfigRecord>
  readonly reportDeliveryRecords: Map<string, ReportDeliveryRecord>
  readonly users: Map<string, UserRecord>
  readonly chemicals: Map<string, ChemicalInventoryRecord>
  readonly equipment: Map<string, EquipmentAssetRecord>
  readonly importBatches: Map<string, ImportBatchRecord>
  settings: SystemSettingsDTO | null
  readonly persistenceTarget: FormalPersistenceTarget
}

export class InMemoryAIRepository implements AIRepository {
  constructor(private readonly store: AIDataStore) {}

  readonly persistenceTarget: FormalPersistenceTarget = {
    authoritativeTables: formalPersistenceSchemaArtifacts.map((artifact) => artifact.table),
    snapshotMode: 'not_applicable',
    schemaArtifacts: formalPersistenceSchemaArtifacts,
    transitionNotes: ['内存仓储仅用于演示与本地进程态运行，不代表正式持久化真相。'],
  }

  get tasks() {
    return this.store.tasks
  }

  get approvals() {
    return this.store.approvals
  }

  get actions() {
    return this.store.actions
  }

  get reports() {
    return this.store.reports
  }

  get reportDeliveryMappings() {
    return this.store.reportDeliveryMappings
  }

  get reportDeliveryConfigs() {
    return this.store.reportDeliveryConfigs
  }

  get reportDeliveryRecords() {
    return this.store.reportDeliveryRecords
  }

  get users() {
    return this.store.users
  }

  get chemicals() {
    return this.store.chemicals
  }

  get equipment() {
    return this.store.equipment
  }

  get importBatches() {
    return this.store.importBatches
  }

  get settings() {
    return this.store.settings
  }

  set settings(value: SystemSettingsDTO | null) {
    this.store.settings = value
  }
}

export class PostgresAIRepository implements AIRepository {
  readonly tasks = new Map<string, AITaskRecord>()
  readonly approvals = new Map<string, AIApprovalRecord>()
  readonly actions = new Map<string, AITaskActionRecord>()
  readonly reports = new Map<string, AIReportRecord>()
  readonly reportDeliveryMappings = new Map<string, SupervisorEmailMappingRecord>()
  readonly reportDeliveryConfigs = new Map<string, ReportDeliveryConfigRecord>()
  readonly reportDeliveryRecords = new Map<string, ReportDeliveryRecord>()
  readonly users = new Map<string, UserRecord>()
  readonly chemicals = new Map<string, ChemicalInventoryRecord>()
  readonly equipment = new Map<string, EquipmentAssetRecord>()
  readonly importBatches = new Map<string, ImportBatchRecord>()
  settings: SystemSettingsDTO | null = null
  readonly persistenceTarget: FormalPersistenceTarget = {
    authoritativeTables: formalPersistenceSchemaArtifacts.map((artifact) => artifact.table),
    snapshotMode: formalPersistenceAuditPolicy.transitionStorage,
    schemaArtifacts: formalPersistenceSchemaArtifacts,
    transitionNotes: formalPersistenceAuditPolicy.notes,
  }

  constructor(readonly connectionString: string) {}
}
