export type AuthAuditEventType =
  | 'login_succeeded'
  | 'login_failed'
  | 'login_throttled'
  | 'forbidden_action'
  | 'token_invalidated'

export interface AuthAuditEvent {
  id: string
  type: AuthAuditEventType
  occurredAt: string
  reasonCode: string
  userId: string | null
  username: string | null
  role: string | null
  metadata: Record<string, unknown>
}
