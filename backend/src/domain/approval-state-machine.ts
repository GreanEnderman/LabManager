import type { AIApprovalRecord, AITaskRecord } from './models'
import type { AIApprovalStatus, AuditActor } from './types'
import { buildTaskActionLog } from './activity-log'

export type ApprovalDecision = 'approve' | 'reject' | 'request_info'

export interface ApplyApprovalDecisionInput {
  approval: AIApprovalRecord
  task: AITaskRecord
  decision: ApprovalDecision
  actor: AuditActor
  at: string
  comment: string
}

export interface ApprovalDecisionResult {
  approval: AIApprovalRecord
  task: AITaskRecord
  log: ReturnType<typeof buildTaskActionLog>
}

const APPROVAL_STATUS_TRANSITIONS: Record<ApprovalDecision, AIApprovalStatus> = {
  approve: 'approved',
  reject: 'rejected',
  request_info: 'needs_info',
}

export function canProcessApproval(status: AIApprovalStatus): boolean {
  return status === 'pending'
}

export function applyApprovalDecision(input: ApplyApprovalDecisionInput): ApprovalDecisionResult {
  const { approval, task, decision, actor, at, comment } = input

  if (!canProcessApproval(approval.status)) {
    throw new Error(`Approval "${approval.id}" is already finalized with status "${approval.status}".`)
  }

  if (task.id !== approval.taskId) {
    throw new Error(`Approval "${approval.id}" does not match task "${task.id}".`)
  }

  if (task.status !== 'pending_approval') {
    throw new Error(`Task "${task.id}" is not waiting for approval.`)
  }

  const nextApprovalStatus = APPROVAL_STATUS_TRANSITIONS[decision]
  const nextTaskStatus =
    decision === 'approve' ? 'in_progress' : 'open'

  const nextApproval: AIApprovalRecord = {
    ...approval,
    status: nextApprovalStatus,
    reviewerId: actor.id,
    reviewerName: actor.name,
    comment,
    updatedAt: at,
    decidedAt: at,
  }

  const nextTask: AITaskRecord = {
    ...task,
    status: nextTaskStatus,
    updatedAt: at,
  }

  const log = buildTaskActionLog({
    id: `approval_${approval.id}_${at}_${decision}`,
    taskId: task.id,
    approvalId: approval.id,
    actionType: 'approval_processed',
    actor,
    detail: comment,
    createdAt: at,
    fromStatus: task.status,
    toStatus: nextTaskStatus,
    reasonCodes:
      decision === 'approve'
        ? ['approval_approved']
        : decision === 'reject'
          ? ['approval_rejected']
          : ['approval_needs_info'],
    snapshot: {
      approvalStatusBefore: approval.status,
      approvalStatusAfter: nextApprovalStatus,
      decision,
    },
  })

  return {
    approval: nextApproval,
    task: nextTask,
    log,
  }
}
