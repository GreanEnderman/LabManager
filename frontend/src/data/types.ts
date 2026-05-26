export interface ChemicalRecord {
  id: string
  name: string
  cas: string | null
  spec: string | null
  physicalForm: string | null
  totalQuantity: number
  openedQuantity: number
  sealedQuantity: number
  packageCount: number
  earliestExpiry: string | null
  latestOpenedAt: string | null
  remark: string | null
  image: string | null
  images: string[]
}

export interface MovementRecord {
  id: string
  date: string | null
  name: string
  type: '入库' | '出库'
  quantity: string | null
  operator: string
  reason: string
  image: string | null
}

export interface EquipmentRecord {
  id: string
  code: string | null
  name: string
  vendor: string | null
  model: string | null
  image: string | null
  images: string[]
  status: string
  lastMaintenanceAt: string | null
  remark: string | null
}
