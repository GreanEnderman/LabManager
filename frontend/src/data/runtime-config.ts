import inventoryConfigData from './inventory-config.json'

export type InventoryConfig = {
  defaultLowStockThreshold: number
  maintenanceOverdueDays: number
  chemicalThresholdOverrides: Record<string, number>
}

export const inventoryConfig: InventoryConfig = inventoryConfigData

export function getChemicalThreshold(name: string) {
  return inventoryConfig.chemicalThresholdOverrides[name] ?? inventoryConfig.defaultLowStockThreshold
}
