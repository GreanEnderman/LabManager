import type { AISettings } from './types'
import type { ChemicalImportRecord } from '../imports/types'

type ChemicalThresholdSource = Pick<ChemicalImportRecord, 'name' | 'threshold'>

export function getEffectiveChemicalThreshold(chemical: ChemicalThresholdSource, settings: AISettings) {
  const override = settings.thresholds.chemicalThresholdOverrides[chemical.name]
  if (Number.isFinite(override) && override > 0) return override

  if (Number.isFinite(chemical.threshold) && chemical.threshold > 0) return chemical.threshold

  return settings.thresholds.defaultLowStockThreshold
}
