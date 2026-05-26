import * as assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { test } from 'node:test'
import type { AppConfig } from './app-config'
import type { Clock } from './clock'
import { createIncrementalIdGenerator } from './id-generator'
import { AuthService, buildScryptHash, PASSWORD_MIN_LENGTH, validatePasswordPolicy, verifyPassword } from './auth-service'
import { PasswordPolicyError, TooManyRequestsError, UnauthorizedError } from './errors'
import { createInMemoryAIDataStore } from './store'

const clock: Clock = {
  now: () => '2026-04-29T10:00:00.000Z',
}

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    runtimeEnvironment: 'test',
    storageDriver: 'memory',
    databaseUrl: 'postgres://labmanager:labmanager@localhost:5432/labmanager',
    jwtSecret: 'test-secret-value',
    jwtIssuer: 'labmanager-backend',
    jwtAudience: 'labmanager-web',
    jwtExpiresInMinutes: 60,
    auth: {
      accessTokenTtlMinutes: 60,
      loginRateLimitMaxAttempts: 3,
      loginRateLimitWindowMinutes: 15,
    },
    llm: {
      enabled: false,
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-4o-mini',
      timeoutMs: 20000,
    },
    smtp: {
      enabled: false,
      host: '',
      port: 25,
      secure: false,
      user: '',
      password: '',
      fromAddress: '',
      fromName: 'LabManager',
    },
    bootstrapUsersEnabled: true,
    bootstrapUsers: [
      {
        username: 'manager.user',
        password: 'BetterPassword!234',
        name: 'Manager User',
        role: 'manager',
      },
    ],
    ...overrides,
  }
}

function createService(configOverrides: Partial<AppConfig> = {}) {
  const store = createInMemoryAIDataStore()
  const config = createConfig(configOverrides)
  const service = new AuthService({
    store,
    idGenerator: createIncrementalIdGenerator(),
    clock,
    config,
  })

  return { service, store, config }
}

function createServiceWithStoreUsers(users: Array<{
  id: string
  username: string
  passwordHash: string
  name: string
  role: 'admin' | 'manager' | 'operator' | 'viewer'
  enabled: boolean
  passwordChangedAt: string
  tokenVersion: number
  createdAt: string
  updatedAt: string
}>, configOverrides: Partial<AppConfig> = {}) {
  const store = createInMemoryAIDataStore()
  users.forEach((user) => {
    store.users.set(user.id, user)
  })
  const config = createConfig(configOverrides)

  return new AuthService({
    store,
    idGenerator: createIncrementalIdGenerator(),
    clock,
    config,
  })
}

function updateTokenPayload(token: string, update: (payload: Record<string, unknown>) => Record<string, unknown>, secret = 'test-secret-value') {
  const [encodedHeader, encodedPayload] = token.split('.')
  assert.ok(encodedHeader)
  assert.ok(encodedPayload)

  const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf-8')) as Record<string, unknown>
  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8')) as Record<string, unknown>
  const nextPayload = update(payload)
  const signedHeader = Buffer.from(JSON.stringify(header), 'utf-8').toString('base64url')
  const signedPayload = Buffer.from(JSON.stringify(nextPayload), 'utf-8').toString('base64url')
  const signature = createHmac('sha256', secret).update(`${signedHeader}.${signedPayload}`).digest('base64url')

  return `${signedHeader}.${signedPayload}.${signature}`
}

test('login returns capabilities for the current role', () => {
  const { service } = createService()

  const response = service.login({
    username: 'manager.user',
    password: 'BetterPassword!234',
  })

  assert.equal(response.user.role, 'manager')
  assert.equal(response.user.capabilities.includes('approvals:write'), true)
  assert.equal(response.user.capabilities.includes('settings:update'), false)
})

test('password helpers accept strong passwords and verify scrypt hashes', () => {
  const password = 'StrongPassword!234'
  validatePasswordPolicy(password, false)

  const hash = buildScryptHash(password, 'fixed-salt-value')
  assert.equal(hash.startsWith('scrypt$fixed-salt-value$'), true)
  assert.equal(verifyPassword(hash, password), true)
  assert.equal(verifyPassword(hash, 'WrongPassword!234'), false)
})

test('password policy rejects weak or default passwords outside fixture mode', () => {
  assert.throws(() => validatePasswordPolicy('Short1!', false), PasswordPolicyError)
  assert.throws(() => validatePasswordPolicy('labmanager123!', false), PasswordPolicyError)
  assert.throws(
    () =>
      validatePasswordPolicy(
        `A${'b'.repeat(PASSWORD_MIN_LENGTH - 3)}!`,
        false,
      ),
    PasswordPolicyError,
  )
})

test('authenticate rejects tokens after user disablement', () => {
  const { service, store } = createService()
  const login = service.login({
    username: 'manager.user',
    password: 'BetterPassword!234',
  })

  const user = Array.from(store.users.values())[0]
  user.enabled = false

  assert.throws(() => service.authenticate(`Bearer ${login.token}`), UnauthorizedError)
})

test('authenticate rejects tokens after token version changes', () => {
  const { service, store } = createService()
  const login = service.login({
    username: 'manager.user',
    password: 'BetterPassword!234',
  })

  const user = Array.from(store.users.values())[0]
  user.tokenVersion += 1

  assert.throws(() => service.authenticate(`Bearer ${login.token}`), UnauthorizedError)
})

test('authenticate rejects malformed tokens', () => {
  const { service } = createService()

  assert.throws(() => service.authenticate('Bearer malformed.token.value'), UnauthorizedError)
  assert.throws(() => service.authenticate('Bearer just-two-parts'), UnauthorizedError)
})

test('authenticate rejects expired tokens', () => {
  const { service } = createService()
  const login = service.login({
    username: 'manager.user',
    password: 'BetterPassword!234',
  })

  const expiredToken = updateTokenPayload(login.token, (payload) => ({
    ...payload,
    exp: 1,
  }))

  assert.throws(() => service.authenticate(`Bearer ${expiredToken}`), UnauthorizedError)
})

test('authenticate rejects tokens with wrong issuer or audience', () => {
  const { service } = createService()
  const login = service.login({
    username: 'manager.user',
    password: 'BetterPassword!234',
  })

  const wrongIssuer = updateTokenPayload(login.token, (payload) => ({
    ...payload,
    iss: 'unexpected-issuer',
  }))
  const wrongAudience = updateTokenPayload(login.token, (payload) => ({
    ...payload,
    aud: 'unexpected-audience',
  }))

  assert.throws(() => service.authenticate(`Bearer ${wrongIssuer}`), UnauthorizedError)
  assert.throws(() => service.authenticate(`Bearer ${wrongAudience}`), UnauthorizedError)
})

test('authenticate uses current stored role after role downgrade', () => {
  const { service, store } = createService()
  const login = service.login({
    username: 'manager.user',
    password: 'BetterPassword!234',
  })

  const user = Array.from(store.users.values())[0]
  user.role = 'viewer'

  const authenticated = service.authenticate(`Bearer ${login.token}`)

  assert.equal(authenticated?.role, 'viewer')
  assert.equal(authenticated?.capabilities.includes('approvals:write'), false)
})

test('authenticate rejects tokens after password reset timestamp changes', () => {
  const { service, store } = createService()
  const login = service.login({
    username: 'manager.user',
    password: 'BetterPassword!234',
  })

  const user = Array.from(store.users.values())[0]
  user.passwordChangedAt = '2026-04-29T11:00:00.000Z'

  assert.throws(() => service.authenticate(`Bearer ${login.token}`), UnauthorizedError)
})

test('login throttles repeated failed attempts', () => {
  const { service } = createService()

  for (let attempt = 0; attempt < 3; attempt += 1) {
    assert.throws(
      () =>
        service.login({
          username: 'manager.user',
          password: 'wrong-password',
        }),
      UnauthorizedError,
    )
  }

  assert.throws(
    () =>
      service.login({
        username: 'manager.user',
        password: 'BetterPassword!234',
      }),
    TooManyRequestsError,
  )

  const auditEvents = service.listAuditEvents()
  assert.equal(auditEvents.some((event) => event.type === 'login_throttled' && event.reasonCode === 'too_many_attempts'), true)
})

test('auth audit records stay generic and omit raw secrets', () => {
  const { service } = createService()

  assert.throws(
    () =>
      service.login({
        username: 'manager.user',
        password: 'wrong-password',
      }),
    UnauthorizedError,
  )

  const login = service.login({
    username: 'manager.user',
    password: 'BetterPassword!234',
  })

  assert.throws(() => service.authenticate('Bearer malformed.token.value'), UnauthorizedError)

  const events = service.listAuditEvents()
  assert.equal(events.some((event) => event.type === 'login_failed' && event.reasonCode === 'invalid_credentials'), true)
  assert.equal(events.some((event) => event.type === 'login_succeeded' && event.reasonCode === 'authenticated'), true)
  assert.equal(events.some((event) => event.type === 'token_invalidated' && event.reasonCode === 'invalid_signature'), true)
  assert.equal(
    events.every((event) => {
      const serialized = JSON.stringify(event)
      return (
        serialized.includes('wrong-password') === false &&
        serialized.includes('BetterPassword!234') === false &&
        serialized.includes(login.token) === false
      )
    }),
    true,
  )
})

test('production rejects legacy sha256 password hashes', () => {
  const { service, store } = createService({
    runtimeEnvironment: 'production',
    bootstrapUsersEnabled: false,
    bootstrapUsers: [],
  })

  store.users.set('usr_legacy', {
    id: 'usr_legacy',
    username: 'legacy.admin',
    passwordHash: '9ef23e3d0ed9e3fdfcfa13d5fe2f2f54da237f867f5e57e3a6a8996f57cb6f54',
    name: 'Legacy Admin',
    role: 'admin',
    enabled: true,
    passwordChangedAt: '2026-04-29T10:00:00.000Z',
    tokenVersion: 1,
    createdAt: '2026-04-29T10:00:00.000Z',
    updatedAt: '2026-04-29T10:00:00.000Z',
  })

  assert.throws(
    () =>
      service.login({
        username: 'legacy.admin',
        password: 'BetterPassword!234',
      }),
    UnauthorizedError,
  )
})

test('deployment startup rejects enabled demo usernames', () => {
  assert.throws(
    () =>
      createServiceWithStoreUsers(
        [
          {
            id: 'usr_demo',
            username: 'admin',
            passwordHash:
              'scrypt$9e5f1d7332c4d92cb4e91b5956ef8051$97bc820f8486b31cb6be3b6463624193207b30f5688d4fbce4f9cb8371d66180e766f7348d1f61c2d3c20d4306ab1405ba8e94ce0c24220c950b05650e44bcb4',
            name: 'Demo Admin',
            role: 'admin',
            enabled: true,
            passwordChangedAt: '2026-04-29T10:00:00.000Z',
            tokenVersion: 1,
            createdAt: '2026-04-29T10:00:00.000Z',
            updatedAt: '2026-04-29T10:00:00.000Z',
          },
        ],
        {
          runtimeEnvironment: 'production',
          bootstrapUsersEnabled: false,
          bootstrapUsers: [],
        },
      ),
    /not allowed in deployment environments/,
  )
})

test('deployment startup rejects enabled users with legacy password hashes', () => {
  assert.throws(
    () =>
      createServiceWithStoreUsers(
        [
          {
            id: 'usr_legacy',
            username: 'alice',
            passwordHash: '9ef23e3d0ed9e3fdfcfa13d5fe2f2f54da237f867f5e57e3a6a8996f57cb6f54',
            name: 'Alice',
            role: 'manager',
            enabled: true,
            passwordChangedAt: '2026-04-29T10:00:00.000Z',
            tokenVersion: 1,
            createdAt: '2026-04-29T10:00:00.000Z',
            updatedAt: '2026-04-29T10:00:00.000Z',
          },
        ],
        {
          runtimeEnvironment: 'staging',
          bootstrapUsersEnabled: false,
          bootstrapUsers: [],
        },
      ),
    /legacy password hash/,
  )
})
