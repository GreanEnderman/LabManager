import type {
  ActionReasonCode,
  AIActionType,
  AuditActor,
  AITaskStatus,
} from './types'
import type { AITaskActionRecord } from './models'

export interface BuildTaskActionLogInput {
  id: string
  taskId?: string | null
  approvalId?: string | null
  actionType: AIActionType
  actor: AuditActor
  detail: string
  createdAt: string
  reasonCodes?: ActionReasonCode[]
  toolName?: string | null
  fromStatus?: AITaskStatus | null
  toStatus?: AITaskStatus | null
  snapshot?: Record<string, unknown>
}

export function buildTaskActionLog(input: BuildTaskActionLogInput): AITaskActionRecord {
  return {
    id: input.id,
    taskId: input.taskId ?? null,
    approvalId: input.approvalId ?? null,
    actionType: input.actionType,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    actor: input.actor,
    reasonCodes: input.reasonCodes ?? [],
    detail: input.detail,
    toolName: input.toolName ?? null,
    snapshot: input.snapshot ?? {},
    createdAt: input.createdAt,
  }
}
