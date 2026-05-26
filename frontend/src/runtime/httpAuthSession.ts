const TOKEN_KEY = 'labmanager.http.token'
const INVALIDATED_KEY = 'labmanager.http.invalidated'
const USER_KEY = 'labmanager.http.user'
const AUTH_EVENT = 'labmanager:http-auth-state'

export type HttpAuthInvalidationReason = 'unauthorized' | 'forbidden' | 'throttled' | 'manual'

export interface HttpAuthStateDetail {
  authenticated: boolean
  reason?: HttpAuthInvalidationReason
}

export interface HttpAuthUser {
  id: string
  username?: string
  name: string
  role: 'admin' | 'manager' | 'operator' | 'viewer'
  capabilities: string[]
}

function readStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}

export function readHttpAuthToken() {
  return readStorage()?.getItem(TOKEN_KEY) ?? null
}

export function readHttpAuthUser(): HttpAuthUser | null {
  const value = readStorage()?.getItem(USER_KEY)
  if (!value) return null

  try {
    return JSON.parse(value) as HttpAuthUser
  } catch {
    return null
  }
}

function dispatchAuthState(detail: HttpAuthStateDetail) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent<HttpAuthStateDetail>(AUTH_EVENT, { detail }))
}

export function writeHttpAuthToken(token: string) {
  const storage = readStorage()
  storage?.setItem(TOKEN_KEY, token)
  storage?.removeItem(INVALIDATED_KEY)
  dispatchAuthState({ authenticated: true })
}

export function writeHttpAuthSession(token: string, user: HttpAuthUser) {
  const storage = readStorage()
  storage?.setItem(TOKEN_KEY, token)
  storage?.setItem(USER_KEY, JSON.stringify(user))
  storage?.removeItem(INVALIDATED_KEY)
  dispatchAuthState({ authenticated: true })
}

export function clearHttpAuthToken() {
  const storage = readStorage()
  storage?.removeItem(TOKEN_KEY)
  storage?.removeItem(USER_KEY)
}

export function markHttpAuthInvalidated(reason: HttpAuthInvalidationReason) {
  const storage = readStorage()
  storage?.removeItem(TOKEN_KEY)
  storage?.removeItem(USER_KEY)
  storage?.setItem(INVALIDATED_KEY, reason)
  dispatchAuthState({ authenticated: false, reason })
}

export function readHttpAuthInvalidationReason() {
  const reason = readStorage()?.getItem(INVALIDATED_KEY)
  if (reason === 'unauthorized' || reason === 'forbidden' || reason === 'throttled' || reason === 'manual') {
    return reason
  }
  return null
}

export function resetHttpAuthInvalidation() {
  readStorage()?.removeItem(INVALIDATED_KEY)
}

export function subscribeHttpAuthState(listener: (detail: HttpAuthStateDetail) => void) {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<HttpAuthStateDetail>).detail
    if (detail) {
      listener(detail)
    }
  }

  window.addEventListener(AUTH_EVENT, handler as EventListener)
  return () => window.removeEventListener(AUTH_EVENT, handler as EventListener)
}
