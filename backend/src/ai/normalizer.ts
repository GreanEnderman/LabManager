import type { AIEventDTO } from '../contracts/shared'
import type { AIEventType, AIPriority, AIRiskLevel, AISourceType } from '../domain/types'
import { ValidationError } from '../services/errors'

export interface NormalizeEventInput {
  id: string
  type: AIEventType
  sourceType: AISourceType
  sourceId: string
  sourceName: string
  title: string
  summary: string
  createdAt: string
  priority?: AIPriority
  riskLevel?: AIRiskLevel
  evidence?: AIEventDTO['evidence']
  metadata?: Record<string, unknown>
}

const DEFAULT_PRIORITY_BY_EVENT: Record<AIEventType, AIPriority> = {
  low_stock: 'P1',
  maintenance_overdue: 'P1',
  equipment_fault: 'P0',
}

const DEFAULT_RISK_BY_EVENT: Record<AIEventType, AIRiskLevel> = {
  low_stock: 'medium',
  maintenance_overdue: 'medium',
  equipment_fault: 'high',
}

export function normalizeEvent(input: NormalizeEventInput): AIEventDTO {
  if (!input.id.trim()) throw new ValidationError('Event id is required.')
  if (!input.sourceId.trim()) throw new ValidationError('Event sourceId is required.')
  if (!input.sourceName.trim()) throw new ValidationError('Event sourceName is required.')
  if (!input.title.trim()) throw new ValidationError('Event title is required.')
  if (!input.summary.trim()) throw new ValidationError('Event summary is required.')

  return {
    id: input.id,
    type: input.type,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    title: input.title,
    summary: input.summary,
    priority: input.priority ?? DEFAULT_PRIORITY_BY_EVENT[input.type],
    riskLevel: input.riskLevel ?? DEFAULT_RISK_BY_EVENT[input.type],
    evidence: input.evidence ?? [],
    metadata: input.metadata ?? {},
    createdAt: input.createdAt,
  }
}
