import type {
  CreateApprovalRequest,
  ListApprovalsQuery,
  ProcessApprovalRequest,
} from '../contracts/api'
import type {
  CreateApprovalResponse,
  ProcessApprovalResponse,
} from '../contracts/responses'
import { buildTaskActionLog } from '../domain/activity-log'
import { toApprovalDTO, toTaskDTO } from '../domain/mappers'
import type { AIApprovalRecord } from '../domain/models'
import { applyApprovalDecision } from '../domain/approval-state-machine'
import type { AuditActor } from '../domain/types'
import { EntityNotFoundError, ValidationError } from './errors'
import type { IdGenerator } from './id-generator'
import type { ActivityLogService } from './activity-log-service'
import type { Clock } from './clock'
import type { AIDataStore } from './store'

export interface ApprovalServiceDependencies {
  store: AIDataStore
  activityLogs: ActivityLogService
  idGenerator: IdGenerator
  clock: Clock
}

export class ApprovalService {
  constructor(private readonly deps: ApprovalServiceDependencies) {}

  listApprovals(query: ListApprovalsQuery = {}) {
    return [...this.deps.store.approvals.values()]
      .filter((approval) => {
        if (query.status && approval.status !== query.status) return false
        if (query.riskLevel && approval.riskLevel !== query.riskLevel) return false
        if (query.reviewerId && approval.reviewerId !== query.reviewerId) return false
        return true
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(toApprovalDTO)
  }

  createApproval(request: CreateApprovalRequest, actor: AuditActor): CreateApprovalResponse {
    const task = this.deps.store.tasks.get(request.taskId)
    if (!task) {
      throw new EntityNotFoundError('Task', request.taskId)
    }

    if (task.status !== 'pending_approval') {
      throw new ValidationError(`Task "${task.id}" must be in "pending_approval" before creating approval.`)
    }

    const now = this.deps.clock.now()
    const approval: AIApprovalRecord = {
      id: this.deps.idGenerator.next('approval'),
      taskId: task.id,
      title: request.title,
      reason: request.reason,
      status: 'pending',
      riskLevel: request.riskLevel,
      requestedBy: actor,
      reviewerId: null,
      reviewerName: null,
      comment: null,
      createdAt: now,
      updatedAt: now,
      decidedAt: null,
      metadata: request.metadata ?? {},
    }

    this.deps.store.approvals.set(approval.id, approval)

    const action = buildTaskActionLog({
      id: this.deps.idGenerator.next('action'),
      taskId: task.id,
      approvalId: approval.id,
      actionType: 'approval_requested',
      actor,
      detail: request.reason,
      createdAt: now,
      fromStatus: task.status,
      toStatus: task.status,
      reasonCodes: ['approval_required'],
      snapshot: {
        title: request.title,
        riskLevel: request.riskLevel,
      },
    })

    return {
      approval: toApprovalDTO(approval),
      task: toTaskDTO(task),
      actions: [this.deps.activityLogs.append(action)],
    }
  }

  processApproval(approvalId: string, request: ProcessApprovalRequest, actor: AuditActor): ProcessApprovalResponse {
    const approval = this.deps.store.approvals.get(approvalId)
    if (!approval) {
      throw new EntityNotFoundError('Approval', approvalId)
    }

    const task = this.deps.store.tasks.get(approval.taskId)
    if (!task) {
      throw new EntityNotFoundError('Task', approval.taskId)
    }

    const result = applyApprovalDecision({
      approval,
      task,
      decision: request.decision,
      actor,
      at: this.deps.clock.now(),
      comment: request.comment,
    })

    this.deps.store.approvals.set(approvalId, result.approval)
    this.deps.store.tasks.set(task.id, result.task)

    return {
      approval: toApprovalDTO(result.approval),
      task: toTaskDTO(result.task),
      action: this.deps.activityLogs.append(result.log),
    }
  }
}
