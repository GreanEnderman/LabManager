import chemicalsJson from './generated/chemicals.json'
import equipmentJson from './generated/equipment.json'
import movementsJson from './generated/movements.json'
import type { ChemicalRecord, EquipmentRecord, MovementRecord } from './types'

export const chemicals = chemicalsJson as ChemicalRecord[]
export const equipment = equipmentJson as EquipmentRecord[]
export const movements = movementsJson as MovementRecord[]
