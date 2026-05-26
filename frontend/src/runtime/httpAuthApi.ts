import type { ApiEnvelope, AuthenticatedUserDTO, LoginResponse } from '../../../backend/src/contracts/shared'
import { readHttpAuthToken, resetHttpAuthInvalidation, writeHttpAuthSession } from './httpAuthSession'

function getBaseUrl() {
  return import.meta.env.VITE_AI_API_BASE_URL?.trim() || '/api/ai'
}

export async function loginWithCredentials(username: string, password: string) {
  const response = await fetch(`${getBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })

  let payload: ApiEnvelope<LoginResponse> | null = null
  try {
    payload = (await response.json()) as ApiEnvelope<LoginResponse>
  } catch {
    payload = null
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.error?.message || '登录失败，请检查账号和密码。')
  }

  resetHttpAuthInvalidation()
  writeHttpAuthSession(payload.data.token, payload.data.user)
  return payload.data.user
}

export async function listAuthUsers() {
  const token = readHttpAuthToken()
  const response = await fetch(`${getBaseUrl()}/auth/users`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  const payload = (await response.json()) as ApiEnvelope<AuthenticatedUserDTO[]>
  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message || '用户列表加载失败。')
  }

  return payload.data
}
