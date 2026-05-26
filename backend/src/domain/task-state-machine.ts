import type { AITaskRecord } from './models'
import type { AuditActor, AITaskStatus } from './types'
import { buildTaskActionLog } from './activity-log'

export type TaskTransitionName =
  | 'start_progress'
  | 'request_approval'
  | 'resume_after_info'
  | 'approve_completion'
  | 'reject_completion'
  | 'complete'
  | 'close'
  | 'reopen'

export interface TaskTransitionInput {
  task: AITaskRecord
  transition: TaskTransitionName
  actor: AuditActor
  at: string
  detail: string
  approvalId?: string | null
}

export interface TaskTransitionResult {
  task: AITaskRecord
  log: ReturnType<typeof buildTaskActionLog>
}

const TASK_TRANSITIONS: Record<TaskTransitionName, { from: AITaskStatus[]; to: AITaskStatus }> = {
  start_progress: { from: ['open'], to: 'in_progress' },
  request_approval: { from: ['in_progress'], to: 'pending_approval' },
  resume_after_info: { from: ['pending_approval'], to: 'open' },
  approve_completion: { from: ['pending_approval'], to: 'in_progress' },
  reject_completion: { from: ['pending_approval'], to: 'open' },
  complete: { from: ['in_progress'], to: 'done' },
  close: { from: ['done'], to: 'closed' },
  reopen: { from: ['closed'], to: 'open' },
}

export function canTransitionTaskStatus(status: AITaskStatus, transition: TaskTransitionName): boolean {
  return TASK_TRANSITIONS[transition].from.includes(status)
}

export function transitionTask(input: TaskTransitionInput): TaskTransitionResult {
  const { task, transition, actor, at, detail, approvalId } = input
  const rule = TASK_TRANSITIONS[transition]

  if (!rule.from.includes(task.status)) {
    throw new Error(`Invalid task transition "${transition}" from status "${task.status}".`)
  }

  const nextStatus = rule.to
  const nextTask: AITaskRecord = {
    ...task,
    status: nextStatus,
    updatedAt: at,
    closedAt: nextStatus === 'closed' ? at : task.closedAt,
  }

  const log = buildTaskActionLog({
    id: `action_${task.id}_${at}_${transition}`,
    taskId: task.id,
    approvalId: approvalId ?? null,
    actionType: nextStatus === 'closed' ? 'task_closed' : 'task_status_changed',
    actor,
    detail,
    createdAt: at,
    fromStatus: task.status,
    toStatus: nextStatus,
    reasonCodes: [],
    snapshot: {
      transition,
      requiresApproval: task.requiresApproval,
    },
  })

  return { task: nextTask, log }
}
