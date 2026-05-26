import type { HttpAuthInvalidationReason } from './httpAuthSession'

export function getAuthInvalidationReason(status: number, path: string): HttpAuthInvalidationReason | null {
  if (path === '/auth/login') {
    return null
  }

  if (status === 401) {
    return 'unauthorized'
  }

  return null
}

export function getAuthBannerMessage(reason: HttpAuthInvalidationReason | null) {
  if (reason === 'unauthorized') {
    return '后端登录会话已失效，系统已停止自动重试。请重新登录或刷新后重新建立会话。'
  }

  if (reason === 'throttled') {
    return '登录尝试过于频繁，请稍后再试。'
  }

  if (reason === 'forbidden') {
    return '当前账号没有执行此操作的权限。'
  }

  return null
}

export function getAuthErrorMessage(status: number, code: string, fallbackMessage: string) {
  if (status === 401 || code === 'unauthorized') {
    return '登录状态已失效，请重新登录后重试。'
  }

  if (status === 403 || code === 'forbidden') {
    return '当前账号没有执行此操作的权限。'
  }

  if (status === 422 || code === 'password_policy_violation') {
    return '密码不符合安全策略，请使用更强的密码后重试。'
  }

  if (status === 429 || code === 'too_many_attempts') {
    return '尝试次数过多，请稍后再试。'
  }

  return fallbackMessage
}
