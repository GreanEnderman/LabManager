// API-facing contract exports must stay pass-through only. Shared DTO semantics
// are defined in ./shared and must not be redefined here.
export type {
  AIEventDTO,
  AITaskDTO,
  AIApprovalDTO,
  AITaskActionDTO,
  AIReportDTO,
  ListTasksQuery,
  CreateTaskRequest,
  AssignTaskRequest,
  UpdateTaskStatusRequest,
  ListApprovalsQuery,
  CreateApprovalRequest,
  ProcessApprovalRequest,
  BackendRouteContract,
} from './shared'

export { backendRouteContracts } from './shared'
