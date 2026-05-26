/**
 * Bridge file to provide backend types for frontend without importing backend code.
 * Keep permission-related runtime logic in sync with backend domain contracts.
 */

export type AppCapability =
  | 'chemicals:read'
  | 'equipment:read'
  | 'imports:read'
  | 'imports:create'
  | 'alerts:read'
  | 'tasks:read'
  | 'tasks:write'
  | 'approvals:read'
  | 'approvals:write'
  | 'reports:read'
  | 'reports:generate'
  | 'reports:delete'
  | 'report_delivery:read'
  | 'report_delivery:manage'
  | 'settings:read'
  | 'settings:update'
  | 'rules:inspect'
  | 'rules:execute'
  | 'agents:execute'

export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer'

const ALL_CAPABILITIES: AppCapability[] = [
  'chemicals:read',
  'equipment:read',
  'imports:read',
  'imports:create',
  'alerts:read',
  'tasks:read',
  'tasks:write',
  'approvals:read',
  'approvals:write',
  'reports:read',
  'reports:generate',
  'reports:delete',
  'report_delivery:read',
  'report_delivery:manage',
  'settings:read',
  'settings:update',
  'rules:inspect',
  'rules:execute',
  'agents:execute',
]

const MANAGER_CAPABILITIES: AppCapability[] = [
  'chemicals:read',
  'equipment:read',
  'imports:read',
  'alerts:read',
  'tasks:read',
  'tasks:write',
  'approvals:read',
  'approvals:write',
  'reports:read',
  'reports:generate',
  'report_delivery:read',
  'settings:read',
  'rules:inspect',
  'rules:execute',
  'agents:execute',
]

const OPERATOR_CAPABILITIES: AppCapability[] = [
  'chemicals:read',
  'equipment:read',
  'alerts:read',
  'tasks:read',
  'tasks:write',
  'approvals:read',
  'reports:read',
  'settings:read',
]

const VIEWER_CAPABILITIES: AppCapability[] = [
  'chemicals:read',
  'equipment:read',
  'alerts:read',
  'tasks:read',
  'approvals:read',
  'reports:read',
  'report_delivery:read',
  'settings:read',
]

const ROLE_CAPABILITIES: Record<UserRole, AppCapability[]> = {
  admin: ALL_CAPABILITIES,
  manager: MANAGER_CAPABILITIES,
  operator: OPERATOR_CAPABILITIES,
  viewer: VIEWER_CAPABILITIES,
}

export const getRoleCapabilities = (role: UserRole): AppCapability[] => ROLE_CAPABILITIES[role]
export const hasCapability = (role: UserRole, capability: AppCapability): boolean =>
  ROLE_CAPABILITIES[role].includes(capability)
export const createAIApplicationServices = () => ({})

export type AIApplicationServices = any
export type AIApprovalDTO = any
export type AIEventDTO = any
export type AIReportDTO = any
export type ReportDeliveryConfigDTO = any
export type ReportDeliveryRecordDTO = any
export type SupervisorEmailMappingDTO = any
export type AITaskActionDTO = any
export type AITaskDTO = any
export type ChemicalInventoryDTO = any
export type EquipmentAssetDTO = any
export type ImportBatchDTO = any
export type AuthenticatedUserDTO = any
export type LoginRequest = any
export type LoginResponse = any
export type ApprovalDecision = any
export type TaskTransitionName = any
