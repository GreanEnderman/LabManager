import type { UserRole } from './types'

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
  'imports:create',
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
  'imports:read',
  'imports:create',
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

export const ROLE_CAPABILITIES: Record<UserRole, AppCapability[]> = {
  admin: ALL_CAPABILITIES,
  manager: MANAGER_CAPABILITIES,
  operator: OPERATOR_CAPABILITIES,
  viewer: VIEWER_CAPABILITIES,
}

export function getRoleCapabilities(role: UserRole): AppCapability[] {
  return ROLE_CAPABILITIES[role]
}

export function hasCapability(role: UserRole, capability: AppCapability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability)
}
