import { Pool } from 'pg'
import type { AIDataStore } from './store'
import type { SystemSettingsDTO } from '../contracts/shared'
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
import {
  formalPersistenceAuditPolicy,
  getFormalPersistenceSchemaSql,
} from './formal-persistence-schema'

interface SnapshotPayload {
  tasks: AITaskRecord[]
  approvals: AIApprovalRecord[]
  actions: AITaskActionRecord[]
  reports: AIReportRecord[]
  reportDeliveryMappings: SupervisorEmailMappingRecord[]
  reportDeliveryConfigs: ReportDeliveryConfigRecord[]
  reportDeliveryRecords: ReportDeliveryRecord[]
  users: UserRecord[]
  chemicals: ChemicalInventoryRecord[]
  equipment: EquipmentAssetRecord[]
  importBatches: ImportBatchRecord[]
  settings: SystemSettingsDTO | null
}

function toSnapshot(store: AIDataStore): SnapshotPayload {
  return {
    tasks: [...store.tasks.values()],
    approvals: [...store.approvals.values()],
    actions: [...store.actions.values()],
    reports: [...store.reports.values()],
    reportDeliveryMappings: [...store.reportDeliveryMappings.values()],
    reportDeliveryConfigs: [...store.reportDeliveryConfigs.values()],
    reportDeliveryRecords: [...store.reportDeliveryRecords.values()],
    users: [...store.users.values()],
    chemicals: [...store.chemicals.values()],
    equipment: [...store.equipment.values()],
    importBatches: [...store.importBatches.values()],
    settings: store.settings,
  }
}

function replaceMapValues<T extends { id: string }>(target: Map<string, T>, items: T[]) {
  target.clear()
  items.forEach((item) => target.set(item.id, item))
}

export class PostgresSnapshotStore {
  private readonly pool: Pool

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
    })
  }

  async initialize() {
    // Formal relational tables are initialized first; snapshot storage remains
    // compatibility-only for prototype hydration and rollback support.
    await this.pool.query(getFormalPersistenceSchemaSql())
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ai_state_snapshots (
        snapshot_key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  }

  async hydrate(store: AIDataStore, snapshotKey = 'ai_main') {
    const result = await this.pool.query<{ payload: SnapshotPayload }>(
      'SELECT payload FROM ai_state_snapshots WHERE snapshot_key = $1',
      [snapshotKey],
    )

    if (result.rowCount === 0) {
      return
    }

    const payload = result.rows[0]?.payload
    if (!payload) {
      return
    }

    replaceMapValues(store.tasks, payload.tasks ?? [])
    replaceMapValues(store.approvals, payload.approvals ?? [])
    replaceMapValues(store.actions, payload.actions ?? [])
    replaceMapValues(store.reports, payload.reports ?? [])
    replaceMapValues(store.reportDeliveryMappings, payload.reportDeliveryMappings ?? [])
    replaceMapValues(store.reportDeliveryConfigs, payload.reportDeliveryConfigs ?? [])
    replaceMapValues(store.reportDeliveryRecords, payload.reportDeliveryRecords ?? [])
    replaceMapValues(store.users, payload.users ?? [])
    replaceMapValues(store.chemicals, payload.chemicals ?? [])
    replaceMapValues(store.equipment, payload.equipment ?? [])
    replaceMapValues(store.importBatches, payload.importBatches ?? [])
    store.settings = payload.settings ?? null
  }

  async persist(store: AIDataStore, snapshotKey = 'ai_main') {
    const payload = JSON.stringify(toSnapshot(store))
    await this.pool.query(
      `
        INSERT INTO ai_state_snapshots (snapshot_key, payload, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (snapshot_key)
        DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      `,
      [snapshotKey, payload],
    )
  }

  getMode() {
    return formalPersistenceAuditPolicy.transitionStorage
  }
}
