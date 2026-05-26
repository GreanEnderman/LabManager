export interface ChemicalInventoryInput {
  id: string
  name: string
  totalQuantity: number
  threshold: number
}

export interface EquipmentMonitoringInput {
  id: string
  name: string
  status: string
  lastMaintenanceAt: string | null
}

export interface EventGenerationInput {
  chemicals?: ChemicalInventoryInput[]
  equipment?: EquipmentMonitoringInput[]
}

export interface EventGenerationConfig {
  now: string
  maintenanceOverdueDays: number
}
