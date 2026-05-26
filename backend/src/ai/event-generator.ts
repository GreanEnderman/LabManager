import type { AIEventDTO } from '../contracts/shared'
import type { AITaskRecord } from '../domain/models'
import { normalizeEvent } from './normalizer'
import type { ChemicalInventoryInput, EquipmentMonitoringInput, EventGenerationConfig, EventGenerationInput } from './business-types'

function parseFlexibleDate(value: string | null): Date | null {
  if (!value) {
    return null
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`)
  }

  if (/^\d{4}-\d{2}$/.test(value)) {
    return new Date(`${value}-01T00:00:00`)
  }

  if (/^\d{4}\.\d{1,2}$/.test(value)) {
    const [year, month] = value.split('.')
    return new Date(`${year}-${month.padStart(2, '0')}-01T00:00:00`)
  }

  return null
}

function diffDays(from: Date, to: Date) {
  const milliseconds = to.getTime() - from.getTime()
  return Math.floor(milliseconds / (1000 * 60 * 60 * 24))
}

function buildLowStockEvent(chemical: ChemicalInventoryInput, now: string): AIEventDTO {
  return normalizeEvent({
    id: `event_low_stock_${chemical.id}`,
    type: 'low_stock',
    sourceType: 'chemical',
    sourceId: chemical.id,
    sourceName: chemical.name,
    title: `${chemical.name} 库存偏低`,
    summary: `${chemical.name} 当前库存 ${chemical.totalQuantity}，低于安全阈值 ${chemical.threshold}。`,
    createdAt: now,
    priority: chemical.totalQuantity === 0 ? 'P0' : 'P1',
    riskLevel: chemical.totalQuantity === 0 ? 'high' : 'medium',
    evidence: [
      { kind: 'metric', label: 'currentStock', value: String(chemical.totalQuantity) },
      { kind: 'metric', label: 'threshold', value: String(chemical.threshold) },
    ],
    metadata: {
      currentStock: chemical.totalQuantity,
      threshold: chemical.threshold,
      suggestedTaskType: 'chemical_purchase',
    },
  })
}

function buildMaintenanceOverdueEvent(
  equipment: EquipmentMonitoringInput,
  overdueDays: number,
  now: string,
  maintenanceOverdueDays: number,
): AIEventDTO {
  return normalizeEvent({
    id: `event_maintenance_overdue_${equipment.id}`,
    type: 'maintenance_overdue',
    sourceType: 'equipment',
    sourceId: equipment.id,
    sourceName: equipment.name,
    title: `${equipment.name} 维护超期`,
    summary: `${equipment.name} 距离上次维护已 ${overdueDays} 天，超过阈值 ${maintenanceOverdueDays} 天。`,
    createdAt: now,
    priority: overdueDays > maintenanceOverdueDays * 2 ? 'P0' : 'P1',
    riskLevel: overdueDays > maintenanceOverdueDays * 2 ? 'high' : 'medium',
    evidence: [
      { kind: 'metric', label: 'overdueDays', value: String(overdueDays) },
      { kind: 'metric', label: 'thresholdDays', value: String(maintenanceOverdueDays) },
      { kind: 'text', label: 'lastMaintenanceAt', value: equipment.lastMaintenanceAt ?? 'unknown' },
    ],
    metadata: {
      overdueDays,
      lastMaintenanceAt: equipment.lastMaintenanceAt,
      suggestedTaskType: 'equipment_repair',
    },
  })
}

function buildFaultEvent(equipment: EquipmentMonitoringInput, now: string): AIEventDTO {
  return normalizeEvent({
    id: `event_equipment_fault_${equipment.id}`,
    type: 'equipment_fault',
    sourceType: 'equipment',
    sourceId: equipment.id,
    sourceName: equipment.name,
    title: `${equipment.name} 状态异常`,
    summary: `${equipment.name} 当前状态为 ${equipment.status}，建议优先人工排查。`,
    createdAt: now,
    priority: 'P0',
    riskLevel: 'high',
    evidence: [
      { kind: 'text', label: 'status', value: equipment.status },
    ],
    metadata: {
      status: equipment.status,
      suggestedTaskType: 'equipment_maintenance',
    },
  })
}

export function generateLowStockEvents(
  chemicals: ChemicalInventoryInput[],
  config: Pick<EventGenerationConfig, 'now'>,
): AIEventDTO[] {
  return chemicals
    .filter((chemical) => chemical.totalQuantity <= chemical.threshold)
    .sort((left, right) => left.totalQuantity - right.totalQuantity)
    .map((chemical) => buildLowStockEvent(chemical, config.now))
}

export function generateMaintenanceOverdueEvents(
  equipmentList: EquipmentMonitoringInput[],
  config: EventGenerationConfig,
): AIEventDTO[] {
  const now = new Date(config.now)

  return equipmentList
    .map((item) => {
      const lastMaintenance = parseFlexibleDate(item.lastMaintenanceAt)
      const overdueDays = lastMaintenance ? diffDays(lastMaintenance, now) : null
      return { item, overdueDays }
    })
    .filter((entry) => entry.overdueDays !== null && entry.overdueDays > config.maintenanceOverdueDays)
    .sort((left, right) => (right.overdueDays ?? 0) - (left.overdueDays ?? 0))
    .map((entry) =>
      buildMaintenanceOverdueEvent(
        entry.item,
        entry.overdueDays ?? 0,
        config.now,
        config.maintenanceOverdueDays,
      ),
    )
}

export function generateFaultEvents(
  equipmentList: EquipmentMonitoringInput[],
  config: Pick<EventGenerationConfig, 'now'>,
): AIEventDTO[] {
  return equipmentList
    .filter((item) => item.status !== '正常')
    .map((item) => buildFaultEvent(item, config.now))
}

export function generateRuleEvents(input: EventGenerationInput, config: EventGenerationConfig): AIEventDTO[] {
  return [
    ...generateLowStockEvents(input.chemicals ?? [], config),
    ...generateMaintenanceOverdueEvents(input.equipment ?? [], config),
    ...generateFaultEvents(input.equipment ?? [], config),
  ]
}

export function findDuplicateOpenTask(
  event: AIEventDTO,
  openTasks: AITaskRecord[],
): AITaskRecord | null {
  const expectedTaskType =
    event.type === 'low_stock'
      ? 'chemical_purchase'
      : event.type === 'maintenance_overdue'
        ? 'equipment_maintenance'
        : 'equipment_repair'

  return (
    openTasks.find((task) => {
      return (
        task.sourceType === event.sourceType &&
        task.sourceId === event.sourceId &&
        task.type === expectedTaskType &&
        task.status !== 'done' &&
        task.status !== 'closed'
      )
    }) ?? null
  )
}
