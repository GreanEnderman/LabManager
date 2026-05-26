export const inventoryConfig = {
  defaultLowStockThreshold: 2,
  maintenanceOverdueDays: 180,
  chemicalThresholdOverrides: {
    '75%酒精': 1,
    'pH缓冲液': 1,
    'TDS笔': 3,
  } as Record<string, number>,
}

export function getChemicalThreshold(name: string) {
  return inventoryConfig.chemicalThresholdOverrides[name] ?? inventoryConfig.defaultLowStockThreshold
}
