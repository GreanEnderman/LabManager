import type {
  ExecuteTaskSLARequest,
  ExecuteTaskSLAResponse,
  InspectTaskSLARequest,
  InspectTaskSLAResponse,
  TaskSLAInspectionItemDTO,
} from '../contracts/shared'
import { buildTaskActionLog } from '../domain/activity-log'
import type { AITaskRecord } from '../domain/models'
import { toTaskDTO } from '../domain/mappers'
import type { AuditActor, AITaskStatus } from '../domain/types'
import type { ActivityLogService } from './activity-log-service'
import type { IdGenerator } from './id-generator'
import type { AIDataStore } from './store'

export interface SLAServiceDependencies {
  store: AIDataStore
  activityLogs: ActivityLogService
  idGenerator: IdGenerator
}

function toMinutes(startAt: string, endAt: string) {
  const diff = new Date(endAt).getTime() - new Date(startAt).getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60)))
}

function getThresholdMinutes(status: AITaskStatus, config: InspectTaskSLARequest['config']) {
  switch (status) {
    case 'open':
      return config.openMinutes
    case 'in_progress':
      return config.inProgressMinutes
    case 'pending_approval':
      return config.pendingApprovalMinutes
    default:
      return Number.POSITIVE_INFINITY
  }
}

function getReminderCount(task: AITaskRecord) {
  const raw = task.metadata.slaReminderCount
  return typeof raw === 'number' ? raw : 0
}

function getEscalated(task: AITaskRecord) {
  return task.metadata.slaEscalated === true
}

function shouldInspectStatus(status: AITaskStatus) {
  return status === 'open' || status === 'in_progress' || status === 'pending_approval'
}

function inspectTask(task: AITaskRecord, request: InspectTaskSLARequest): TaskSLAInspectionItemDTO | null {
  if (!shouldInspectStatus(task.status)) {
    return null
  }

  const thresholdMinutes = getThresholdMinutes(task.status, request.config)
  if (!Number.isFinite(thresholdMinutes)) {
    return null
  }

  const startedAt = task.updatedAt || task.createdAt
  const overdueMinutes = toMinutes(startedAt, request.now)
  const reminderCount = getReminderCount(task)
  const escalated = getEscalated(task)
  const reachedThreshold = overdueMinutes >= thresholdMinutes
  const shouldRemind =
    reachedThreshold &&
    !escalated &&
    reminderCount < request.config.maxReminderCountBeforeEscalation
  const shouldEscalate =
    reachedThreshold &&
    !escalated &&
    reminderCount >= request.config.maxReminderCountBeforeEscalation

  if (!reachedThreshold) {
    return null
  }

  return {
    task: toTaskDTO(task),
    overdueMinutes,
    thresholdMinutes,
    reminderCount,
    shouldRemind,
    shouldEscalate,
  }
}

function buildReminderDetail(task: AITaskRecord, overdueMinutes: number) {
  return `Task ${task.id} exceeded SLA by ${overdueMinutes} minutes and requires reminder.`
}

function buildEscalationDetail(task: AITaskRecord, overdueMinutes: number) {
  return `Task ${task.id} exceeded SLA by ${overdueMinutes} minutes and has been escalated.`
}

function updateTaskSLAFlags(task: AITaskRecord, actor: AuditActor, actionAt: string, patch: Record<string, unknown>) {
  return {
    ...task,
    updatedAt: actionAt,
    metadata: {
      ...task.metadata,
      ...patch,
      lastSLAActorId: actor.id,
      lastSLAActorName: actor.name,
      lastSLAAt: actionAt,
    },
  }
}

export class SLAService {
  constructor(private readonly deps: SLAServiceDependencies) {}

  inspect(request: InspectTaskSLARequest): InspectTaskSLAResponse {
    const items = [...this.deps.store.tasks.values()]
      .map((task) => inspectTask(task, request))
      .filter((item): item is TaskSLAInspectionItemDTO => Boolean(item))
      .sort((left, right) => right.overdueMinutes - left.overdueMinutes)

    return { items }
  }

  execute(request: ExecuteTaskSLARequest): ExecuteTaskSLAResponse {
    const inspection = this.inspect({
      now: request.now,
      config: request.config,
    })

    const reminders: ExecuteTaskSLAResponse['reminders'] = []
    const escalations: ExecuteTaskSLAResponse['escalations'] = []

    for (const item of inspection.items) {
      const task = this.deps.store.tasks.get(item.task.id)
      if (!task) {
        continue
      }

      if (item.shouldRemind) {
        const reminderCount = getReminderCount(task) + 1
        const updatedTask = updateTaskSLAFlags(task, request.actor, request.now, {
          slaReminderCount: reminderCount,
          slaLastReminderAt: request.now,
        })
        this.deps.store.tasks.set(task.id, updatedTask)

        const action = this.deps.activityLogs.append(
          buildTaskActionLog({
            id: this.deps.idGenerator.next('action'),
            taskId: task.id,
            actionType: 'sla_reminder_sent',
            actor: request.actor,
            detail: buildReminderDetail(task, item.overdueMinutes),
            createdAt: request.now,
            fromStatus: task.status,
            toStatus: task.status,
            reasonCodes: ['sla_timeout', 'sla_reminder_due'],
            snapshot: {
              overdueMinutes: item.overdueMinutes,
              thresholdMinutes: item.thresholdMinutes,
              reminderCount,
            },
          }),
        )
        reminders.push(action)
        continue
      }

      if (item.shouldEscalate) {
        const updatedTask = updateTaskSLAFlags(task, request.actor, request.now, {
          slaEscalated: true,
          slaEscalatedAt: request.now,
        })
        this.deps.store.tasks.set(task.id, updatedTask)

        const action = this.deps.activityLogs.append(
          buildTaskActionLog({
            id: this.deps.idGenerator.next('action'),
            taskId: task.id,
            actionType: 'task_escalated',
            actor: request.actor,
            detail: buildEscalationDetail(task, item.overdueMinutes),
            createdAt: request.now,
            fromStatus: task.status,
            toStatus: task.status,
            reasonCodes: ['sla_timeout', 'sla_escalated'],
            snapshot: {
              overdueMinutes: item.overdueMinutes,
              thresholdMinutes: item.thresholdMinutes,
              reminderCount: item.reminderCount,
            },
          }),
        )
        escalations.push(action)
      }
    }

    return {
      reminders,
      escalations,
    }
  }
}
