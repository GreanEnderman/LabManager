import type { AITaskActionDTO } from '../contracts/api'
import { toTaskActionDTO } from '../domain/mappers'
import type { AITaskActionRecord } from '../domain/models'
import type { AIRepository } from './repositories'

export class ActivityLogService {
  constructor(private readonly store: AIRepository) {}

  append(action: AITaskActionRecord): AITaskActionDTO {
    this.store.actions.set(action.id, action)
    return toTaskActionDTO(action)
  }

  listByTaskId(taskId: string): AITaskActionDTO[] {
    return [...this.store.actions.values()]
      .filter((action) => action.taskId === taskId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(toTaskActionDTO)
  }
}
