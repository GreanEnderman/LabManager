import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { getAuthBannerMessage, getAuthErrorMessage, getAuthInvalidationReason } from './httpErrorPresentation.ts'

test('frontend auth invalidation only clears session for non-login 401 responses', () => {
  assert.equal(getAuthInvalidationReason(401, '/tasks'), 'unauthorized')
  assert.equal(getAuthInvalidationReason(401, '/auth/login'), null)
  assert.equal(getAuthInvalidationReason(403, '/tasks'), null)
  assert.equal(getAuthInvalidationReason(429, '/tasks'), null)
})

test('frontend auth banner messages stay stable for session and permission states', () => {
  assert.equal(getAuthBannerMessage('unauthorized'), '后端登录会话已失效，系统已停止自动重试。请重新登录或刷新后重新建立会话。')
  assert.equal(getAuthBannerMessage('forbidden'), '当前账号没有执行此操作的权限。')
  assert.equal(getAuthBannerMessage('throttled'), '登录尝试过于频繁，请稍后再试。')
  assert.equal(getAuthBannerMessage(null), null)
})

test('frontend auth error presentation maps stable backend codes', () => {
  assert.equal(getAuthErrorMessage(401, 'unauthorized', 'fallback'), '登录状态已失效，请重新登录后重试。')
  assert.equal(getAuthErrorMessage(403, 'forbidden', 'fallback'), '当前账号没有执行此操作的权限。')
  assert.equal(
    getAuthErrorMessage(422, 'password_policy_violation', 'fallback'),
    '密码不符合安全策略，请使用更强的密码后重试。',
  )
  assert.equal(getAuthErrorMessage(429, 'too_many_attempts', 'fallback'), '尝试次数过多，请稍后再试。')
  assert.equal(getAuthErrorMessage(500, 'internal_error', 'fallback'), 'fallback')
})
