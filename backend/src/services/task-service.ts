import type {
  AssignTaskRequest,
  CreateTaskRequest,
  ListTasksQuery,
  UpdateTaskStatusRequest,
} from '../contracts/api'
import type {
  AssignTaskResponse,
  CreateTaskResponse,
  TaskDetailDTO,
  UpdateTaskStatusResponse,
} from '../contracts/responses'
import { buildTaskActionLog } from '../domain/activity-log'
import { toApprovalDTO, toTaskDTO } from '../domain/mappers'
import type { AITaskRecord } from '../domain/models'
import { transitionTask } from '../domain/task-state-machine'
import type { AuditActor } from '../domain/types'
import { EntityNotFoundError, ValidationError } from './errors'
import type { IdGenerator } from './id-generator'
import type { ActivityLogService } from './activity-log-service'
import type { Clock } from './clock'
import type { AIDataStore } from './store'

export interface TaskServiceDependencies {
  store: AIDataStore
  activityLogs: ActivityLogService
  idGenerator: IdGenerator
  clock: Clock
}

export class TaskService {
  constructor(private readonly deps: TaskServiceDependencies) {}

  listTasks(query: ListTasksQuery = {}) {
    return [...this.deps.store.tasks.values()]
      .filter((task) => {
        if (query.status && task.status !== query.status) return false
        if (query.type && task.type !== query.type) return false
        if (query.priority && task.priority !== query.priority) return false
        if (query.sourceType && task.sourceType !== query.sourceType) return false
        if (query.assigneeId && task.assigneeId !== query.assigneeId) return false
        return true
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(toTaskDTO)
  }

  getTaskDetail(taskId: string): TaskDetailDTO {
    const task = this.getTaskRecord(taskId)
    const approval = [...this.deps.store.approvals.values()].find((item) => item.taskId === taskId) ?? null

    return {
      task: toTaskDTO(task),
      approval: approval ? toApprovalDTO(approval) : null,
      actions: this.deps.activityLogs.listByTaskId(taskId),
    }
  }

  createTask(request: CreateTaskRequest, actor: AuditActor): CreateTaskResponse {
    const now = this.deps.clock.now()
    const taskId = this.deps.idGenerator.next('task')

    const task: AITaskRecord = {
      id: taskId,
      eventId: request.eventId,
      type: request.type,
      title: request.title,
      summary: request.summary,
      recommendation: request.recommendation,
      status: 'open',
      priority: request.priority,
      riskLevel: request.riskLevel,
      sourceType: request.sourceType,
      sourceId: request.sourceId,
      sourceName: request.sourceName,
      assigneeId: request.assigneeId ?? null,
      assigneeName: request.assigneeName ?? null,
      assigneeRole: request.assigneeRole ?? null,
      requiresApproval: request.requiresApproval,
      dueAt: request.dueAt ?? null,
      createdAt: now,
      updatedAt: now,
      closedAt: null,
      metadata: {
        ...request.metadata,
        evidence: request.evidence ?? [],
      },
    }

    this.deps.store.tasks.set(task.id, task)

    const action = buildTaskActionLog({
      id: this.deps.idGenerator.next('action'),
      taskId: task.id,
      actionType: 'task_created',
      actor,
      detail: request.summary,
      createdAt: now,
      toStatus: task.status,
      reasonCodes: ['manual_request'],
      snapshot: {
        type: task.type,
        sourceType: task.sourceType,
        sourceId: task.sourceId,
      },
    })

    return {
      task: toTaskDTO(task),
      actions: [this.deps.activityLogs.append(action)],
    }
  }

  assignTask(taskId: string, request: AssignTaskRequest, actor: AuditActor): AssignTaskResponse {
    const task = this.getTaskRecord(taskId)
    const now = this.deps.clock.now()
    const updatedTask: AITaskRecord = {
      ...task,
      assigneeId: request.assigneeId,
      assigneeName: request.assigneeName,
      assigneeRole: request.assigneeRole,
      updatedAt: now,
    }

    this.deps.store.tasks.set(taskId, updatedTask)

    const action = buildTaskActionLog({
      id: this.deps.idGenerator.next('action'),
      taskId,
      actionType: 'task_assigned',
      actor,
      detail: `Assigned to ${request.assigneeName}`,
      createdAt: now,
      fromStatus: task.status,
      toStatus: updatedTask.status,
      snapshot: {
        assigneeId: request.assigneeId,
        assigneeName: request.assigneeName,
        assigneeRole: request.assigneeRole,
      },
    })

    return {
      task: toTaskDTO(updatedTask),
      action: this.deps.activityLogs.append(action),
    }
  }

  updateTaskStatus(taskId: string, request: UpdateTaskStatusRequest, actor: AuditActor): UpdateTaskStatusResponse {
    const task = this.getTaskRecord(taskId)

    if (
      request.transition === 'request_approval' &&
      !task.requiresApproval
    ) {
      throw new ValidationError(`Task "${taskId}" does not require approval.`)
    }

    const result = transitionTask({
      task,
      transition: request.transition,
      actor,
      at: this.deps.clock.now(),
      detail: request.detail,
    })

    this.deps.store.tasks.set(taskId, result.task)

    return {
      task: toTaskDTO(result.task),
      action: this.deps.activityLogs.append(result.log),
    }
  }

  private getTaskRecord(taskId: string): AITaskRecord {
    const task = this.deps.store.tasks.get(taskId)
    if (!task) {
      throw new EntityNotFoundError('Task', taskId)
    }
    return task
  }
}
