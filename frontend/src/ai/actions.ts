import type {
  AIActivityLog,
  AIApproval,
  AIEvent,
  AIReport,
  AITask,
  AIAssignee,
  AIApprovalStatus,
} from './types'

export interface CreateTaskFromEventInput {
  eventId: string
  assignee?: AIAssignee
}

export type ResolveApprovalStatus = Exclude<AIApprovalStatus, 'pending'>

export interface AIState {
  events: AIEvent[]
  tasks: AITask[]
  approvals: AIApproval[]
  reports: AIReport[]
  activityLogs: AIActivityLog[]
}

export type AIAction =
  | { type: 'add_task'; payload: AITask }
  | { type: 'replace_task'; payload: AITask }
  | { type: 'add_approval'; payload: AIApproval }
  | { type: 'replace_approval'; payload: AIApproval }
  | { type: 'add_report'; payload: AIReport }
  | { type: 'add_log'; payload: AIActivityLog }

export function aiReducer(state: AIState, action: AIAction): AIState {
  switch (action.type) {
    case 'add_task':
      return { ...state, tasks: [action.payload, ...state.tasks] }
    case 'replace_task':
      return {
        ...state,
        tasks: state.tasks.map((task) => (task.id === action.payload.id ? action.payload : task)),
      }
    case 'add_approval':
      return { ...state, approvals: [action.payload, ...state.approvals] }
    case 'replace_approval':
      return {
        ...state,
        approvals: state.approvals.map((approval) => (approval.id === action.payload.id ? action.payload : approval)),
      }
    case 'add_report':
      return { ...state, reports: [action.payload, ...state.reports] }
    case 'add_log':
      return { ...state, activityLogs: [action.payload, ...state.activityLogs] }
    default:
      return state
  }
}

export function createInitialAIState(state: AIState): AIState {
  return state
}
