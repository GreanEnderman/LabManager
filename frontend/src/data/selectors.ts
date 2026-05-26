import { chemicals, equipment, movements } from './index'
import { getChemicalThreshold, inventoryConfig } from './runtime-config'

export const DEFAULT_ALERT_THRESHOLD = inventoryConfig.defaultLowStockThreshold
export const MAINTENANCE_OVERDUE_DAYS = inventoryConfig.maintenanceOverdueDays
const TODAY = new Date('2026-04-15')

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

export function getChemicalInventoryStatus(totalQuantity: number, name: string) {
  return totalQuantity <= getChemicalThreshold(name) ? '低库存' : '库存充足'
}

export function getLowStockChemicals() {
  return chemicals
    .filter((item) => getChemicalInventoryStatus(item.totalQuantity, item.name) === '低库存')
    .sort((a, b) => a.totalQuantity - b.totalQuantity)
}

export function getOverdueEquipment() {
  return equipment
    .map((item) => {
      const lastMaintenance = parseFlexibleDate(item.lastMaintenanceAt)
      const overdueDays = lastMaintenance ? diffDays(lastMaintenance, TODAY) : null
      return {
        ...item,
        overdueDays,
      }
    })
    .filter((item) => item.overdueDays !== null && item.overdueDays > MAINTENANCE_OVERDUE_DAYS)
    .sort((a, b) => (b.overdueDays ?? 0) - (a.overdueDays ?? 0))
}

export function getFaultEquipment() {
  return equipment.filter((item) => item.status !== '正常')
}

export function getRecentMaintenance() {
  return [...equipment]
    .filter((item) => item.lastMaintenanceAt)
    .sort((a, b) => {
      const aTime = parseFlexibleDate(a.lastMaintenanceAt)?.getTime() ?? 0
      const bTime = parseFlexibleDate(b.lastMaintenanceAt)?.getTime() ?? 0
      return bTime - aTime
    })
    .slice(0, 4)
}

export function getMaintenanceRecords() {
  return [...equipment]
    .map((item) => {
      const lastMaintenance = parseFlexibleDate(item.lastMaintenanceAt)
      const overdueDays = lastMaintenance ? diffDays(lastMaintenance, TODAY) : null
      const isFault = item.status !== '正常'
      const isOverdue = overdueDays !== null && overdueDays > MAINTENANCE_OVERDUE_DAYS
      const status = isFault ? '异常' : isOverdue ? '待维护' : '已维护'
      const summary = isFault
        ? `设备状态为${item.status}，建议优先安排人工检查和维修。`
        : isOverdue
          ? `距离上次维护已超过 ${MAINTENANCE_OVERDUE_DAYS} 天，建议尽快安排例行维护。`
          : '当前维护记录正常，可继续按照计划周期执行下一次维护。'

      return {
        ...item,
        overdueDays,
        status,
        summary,
        engineer: '系统导入',
      }
    })
    .sort((a, b) => {
      const aTime = parseFlexibleDate(a.lastMaintenanceAt)?.getTime() ?? 0
      const bTime = parseFlexibleDate(b.lastMaintenanceAt)?.getTime() ?? 0
      return bTime - aTime
    })
}

export function getMovementStats() {
  const inbound = movements.filter((item) => item.type === '入库')
  const outbound = movements.filter((item) => item.type === '出库')
  return {
    inboundCount: inbound.length,
    outboundCount: outbound.length,
  }
}

export function getDashboardStats() {
  const lowStockChemicals = getLowStockChemicals()
  const overdueEquipment = getOverdueEquipment()
  const movementStats = getMovementStats()

  return {
    chemicalCount: chemicals.length,
    lowStockCount: lowStockChemicals.length,
    inboundCount: movementStats.inboundCount,
    outboundCount: movementStats.outboundCount,
    equipmentCount: equipment.length,
    overdueEquipmentCount: overdueEquipment.length,
  }
}
