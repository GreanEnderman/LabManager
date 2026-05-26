import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { AuthenticatedUserDTO, LoginRequest, LoginResponse } from '../contracts/shared'
import { getRoleCapabilities, hasCapability, type AppCapability } from '../domain/authz'
import type { UserRecord } from '../domain/models'
import type { AuditActor, UserRole } from '../domain/types'
import type { AppConfig, BootstrapUserConfig } from './app-config'
import type { AuthAuditEvent, AuthAuditEventType } from './auth-audit'
import { ForbiddenError, PasswordPolicyError, TooManyRequestsError, UnauthorizedError, ValidationError } from './errors'
import type { Clock } from './clock'
import type { IdGenerator } from './id-generator'
import type { AIDataStore } from './store'

interface AuthServiceOptions {
  store: AIDataStore
  idGenerator: IdGenerator
  clock: Clock
  config: AppConfig
}

interface TokenPayload {
  sub: string
  username: string
  name: string
  role: UserRole
  ver: number
  pwd: string
  iss: string
  aud: string
  exp: number
}

interface LoginAttemptState {
  count: number
  windowStartedAt: number
  blockedUntil: number | null
}

export const PROHIBITED_PASSWORDS = new Set<string>(['labmanager123!', 'password', '12345678', 'admin123'])
const PROHIBITED_DEPLOYMENT_USERNAMES = new Set<string>(['admin', 'demo', 'viewer', 'operator', 'manager'])
export const PASSWORD_MIN_LENGTH = 12
const SCRYPT_KEY_LENGTH = 64
const nodeRandomBytes = randomBytes as unknown as (size: number) => Buffer
const nodeScryptSync = scryptSync as unknown as (password: string, salt: string, keyLength: number) => Buffer

function toHex(input: ArrayLike<number>) {
  return Array.from(input, (value) => value.toString(16).padStart(2, '0')).join('')
}

function encodeBase64Url(input: string) {
  return Buffer.from(input, 'utf-8').toString('base64url')
}

function decodeBase64Url<T>(input: string): T {
  return JSON.parse(Buffer.from(input, 'base64url').toString('utf-8')) as T
}

function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex')
}

export function constantTimeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'utf-8')
  const rightBuffer = Buffer.from(right, 'utf-8')

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function buildScryptHash(password: string, salt = toHex(nodeRandomBytes(16))) {
  const derived = toHex(nodeScryptSync(password, salt, SCRYPT_KEY_LENGTH))

  return `scrypt$${salt}$${derived}`
}

export function isLegacySha256Hash(passwordHash: string) {
  return /^[a-f0-9]{64}$/i.test(passwordHash)
}

export function verifyPassword(passwordHash: string, password: string) {
  if (passwordHash.startsWith('scrypt$')) {
    const [, salt, storedHash] = passwordHash.split('$')
    if (!salt || !storedHash) {
      return false
    }

    const candidateHash = buildScryptHash(password, salt)
    return constantTimeEquals(candidateHash, passwordHash)
  }

  if (isLegacySha256Hash(passwordHash)) {
    return constantTimeEquals(passwordHash, sha256(password))
  }

  return false
}

export function validatePasswordPolicy(password: string, allowFixturePassword: boolean) {
  if (allowFixturePassword) {
    return
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new PasswordPolicyError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`)
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new PasswordPolicyError('Password must include upper, lower, numeric, and special characters.')
  }

  if (PROHIBITED_PASSWORDS.has(password.trim().toLowerCase())) {
    throw new PasswordPolicyError('Password uses a prohibited default value.')
  }
}

export class AuthService {
  private readonly store: AIDataStore
  private readonly idGenerator: IdGenerator
  private readonly clock: Clock
  private readonly config: AppConfig
  private readonly loginAttempts = new Map<string, LoginAttemptState>()
  private readonly auditEvents: AuthAuditEvent[] = []

  constructor(options: AuthServiceOptions) {
    this.store = options.store
    this.idGenerator = options.idGenerator
    this.clock = options.clock
    this.config = options.config
    this.seedBootstrapUsers(options.config.bootstrapUsers)
    this.validateDeploymentUsers()
  }

  login(request: LoginRequest): LoginResponse {
    if (!request.username?.trim() || !request.password?.trim()) {
      throw new ValidationError('Username and password are required.')
    }

    const username = request.username.trim()
    this.assertLoginAllowed(username)

    const user = Array.from(this.store.users.values()).find((item) => item.username === username)
    if (!user || !user.enabled) {
      this.recordFailedLogin(username)
      this.recordAuditEvent('login_failed', {
        reasonCode: 'invalid_credentials',
        username,
      })
      throw new UnauthorizedError('Invalid username or password.')
    }

    if (isLegacySha256Hash(user.passwordHash) && this.isDeploymentEnvironment()) {
      this.recordFailedLogin(username)
      this.recordAuditEvent('login_failed', {
        reasonCode: 'invalid_credentials',
        user,
      })
      throw new UnauthorizedError('Invalid username or password.')
    }

    if (!verifyPassword(user.passwordHash, request.password)) {
      this.recordFailedLogin(username)
      this.recordAuditEvent('login_failed', {
        reasonCode: 'invalid_credentials',
        user,
      })
      throw new UnauthorizedError('Invalid username or password.')
    }

    if (isLegacySha256Hash(user.passwordHash)) {
      user.passwordHash = buildScryptHash(request.password)
      user.passwordChangedAt = this.clock.now()
      user.tokenVersion += 1
      user.updatedAt = user.passwordChangedAt
    }

    this.loginAttempts.delete(username.toLowerCase())

    const token = this.signToken(user)
    const expiresAt = new Date(this.nowTimestamp() + this.config.auth.accessTokenTtlMinutes * 60 * 1000).toISOString()
    this.recordAuditEvent('login_succeeded', {
      reasonCode: 'authenticated',
      user,
      metadata: {
        expiresAt,
      },
    })

    return {
      token,
      user: this.toAuthenticatedUser(user),
      expiresAt,
    }
  }

  authenticate(authorizationHeader?: string): AuthenticatedUserDTO | null {
    if (!authorizationHeader?.startsWith('Bearer ')) {
      return null
    }

    const token = authorizationHeader.slice('Bearer '.length).trim()
    if (!token) {
      return null
    }

    const [encodedHeader, encodedPayload, signature] = token.split('.')
    if (!encodedHeader || !encodedPayload || !signature) {
      this.recordAuditEvent('token_invalidated', {
        reasonCode: 'malformed_token',
      })
      throw new UnauthorizedError('Authentication failed.')
    }

    const expectedSignature = createHmac('sha256', this.config.jwtSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url')

    if (!constantTimeEquals(signature, expectedSignature)) {
      this.recordAuditEvent('token_invalidated', {
        reasonCode: 'invalid_signature',
      })
      throw new UnauthorizedError('Authentication failed.')
    }

    let payload: TokenPayload

    try {
      payload = decodeBase64Url<TokenPayload>(encodedPayload)
    } catch {
      this.recordAuditEvent('token_invalidated', {
        reasonCode: 'malformed_token',
      })
      throw new UnauthorizedError('Authentication failed.')
    }

    if (payload.iss !== this.config.jwtIssuer || payload.aud !== this.config.jwtAudience) {
      this.recordAuditEvent('token_invalidated', {
        reasonCode: 'invalid_token_scope',
        userId: payload.sub,
        username: payload.username,
        role: payload.role,
      })
      throw new UnauthorizedError('Authentication failed.')
    }

    if (payload.exp * 1000 < this.nowTimestamp()) {
      this.recordAuditEvent('token_invalidated', {
        reasonCode: 'expired_token',
        userId: payload.sub,
        username: payload.username,
        role: payload.role,
      })
      throw new UnauthorizedError('Authentication failed.')
    }

    const user = this.store.users.get(payload.sub)
    if (!user || !user.enabled) {
      this.recordAuditEvent('token_invalidated', {
        reasonCode: 'user_state_changed',
        userId: payload.sub,
        username: payload.username,
        role: payload.role,
      })
      throw new UnauthorizedError('Authentication failed.')
    }

    if (payload.ver !== user.tokenVersion || payload.pwd !== user.passwordChangedAt) {
      this.recordAuditEvent('token_invalidated', {
        reasonCode: 'credential_version_changed',
        user,
      })
      throw new UnauthorizedError('Authentication failed.')
    }

    return this.toAuthenticatedUser(user)
  }

  requireAuthenticatedUser(user: AuthenticatedUserDTO | null): AuthenticatedUserDTO {
    if (!user) {
      throw new UnauthorizedError()
    }

    return user
  }

  requireCapability(user: AuthenticatedUserDTO | null, capability: AppCapability): AuthenticatedUserDTO {
    const authenticated = this.requireAuthenticatedUser(user)
    if (!hasCapability(authenticated.role, capability)) {
      throw new ForbiddenError()
    }

    return authenticated
  }

  recordForbiddenAction(user: AuthenticatedUserDTO, capability: AppCapability, metadata?: Record<string, unknown>) {
    this.recordAuditEvent('forbidden_action', {
      reasonCode: capability,
      userId: user.id,
      username: user.username,
      role: user.role,
      metadata,
    })
  }

  listAuditEvents() {
    return [...this.auditEvents]
  }

  requireAdmin(user: AuthenticatedUserDTO | null): AuthenticatedUserDTO {
    return this.requireCapability(user, 'settings:update')
  }

  toAuditActor(user: AuthenticatedUserDTO): AuditActor {
    return {
      id: user.id,
      name: user.name,
      type: 'user',
    }
  }

  private assertLoginAllowed(username: string) {
    const key = username.toLowerCase()
    const state = this.loginAttempts.get(key)
    const now = Date.now()

    if (state?.blockedUntil && state.blockedUntil > now) {
      this.recordAuditEvent('login_throttled', {
        reasonCode: 'too_many_attempts',
        username,
      })
      throw new TooManyRequestsError()
    }
  }

  private recordFailedLogin(username: string) {
    const key = username.toLowerCase()
    const now = Date.now()
    const windowMs = this.config.auth.loginRateLimitWindowMinutes * 60 * 1000
    const threshold = this.config.auth.loginRateLimitMaxAttempts
    const existing = this.loginAttempts.get(key)

    if (!existing || now - existing.windowStartedAt > windowMs) {
      this.loginAttempts.set(key, {
        count: 1,
        windowStartedAt: now,
        blockedUntil: null,
      })
      return
    }

    existing.count += 1
    if (existing.count >= threshold) {
      existing.blockedUntil = now + windowMs
    }
  }

  private seedBootstrapUsers(users: BootstrapUserConfig[]) {
    if (this.store.users.size > 0 || users.length === 0) {
      return
    }

    const allowFixturePassword = this.config.runtimeEnvironment === 'local' || this.config.runtimeEnvironment === 'test'

    users.forEach((user) => {
      validatePasswordPolicy(user.password, allowFixturePassword)
      const now = this.clock.now()
      const id = this.idGenerator.next('usr')
      this.store.users.set(id, {
        id,
        username: user.username.trim(),
        passwordHash: buildScryptHash(user.password),
        name: user.name,
        role: user.role,
        enabled: true,
        passwordChangedAt: now,
        tokenVersion: 1,
        createdAt: now,
        updatedAt: now,
      })
    })
  }

  private validateDeploymentUsers() {
    if (!this.isDeploymentEnvironment()) {
      return
    }

    for (const user of this.store.users.values()) {
      if (!user.enabled) {
        continue
      }

      if (PROHIBITED_DEPLOYMENT_USERNAMES.has(user.username.trim().toLowerCase())) {
        this.recordAuditEvent('token_invalidated', {
          reasonCode: 'deployment_fixture_account_blocked',
          user,
        })
        throw new Error(`Enabled default or demo account "${user.username}" is not allowed in deployment environments.`)
      }

      if (isLegacySha256Hash(user.passwordHash)) {
        this.recordAuditEvent('token_invalidated', {
          reasonCode: 'deployment_legacy_hash_blocked',
          user,
        })
        throw new Error(`Enabled user "${user.username}" still uses a legacy password hash and is not deployment-ready.`)
      }
    }
  }

  private signToken(user: UserRecord) {
    const now = Math.floor(this.nowTimestamp() / 1000)
    const header = encodeBase64Url(
      JSON.stringify({
        alg: 'HS256',
        typ: 'JWT',
      }),
    )
    const payload = encodeBase64Url(
      JSON.stringify({
        sub: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        ver: user.tokenVersion,
        pwd: user.passwordChangedAt,
        iss: this.config.jwtIssuer,
        aud: this.config.jwtAudience,
        exp: now + this.config.auth.accessTokenTtlMinutes * 60,
      } satisfies TokenPayload),
    )
    const signature = createHmac('sha256', this.config.jwtSecret).update(`${header}.${payload}`).digest('base64url')

    return `${header}.${payload}.${signature}`
  }

  private toAuthenticatedUser(user: UserRecord): AuthenticatedUserDTO {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      capabilities: getRoleCapabilities(user.role),
    }
  }

  private isDeploymentEnvironment() {
    return this.config.runtimeEnvironment === 'staging' || this.config.runtimeEnvironment === 'production'
  }

  private nowTimestamp() {
    return new Date(this.clock.now()).getTime()
  }

  private recordAuditEvent(
    type: AuthAuditEventType,
    input: {
      reasonCode: string
      user?: UserRecord
      userId?: string | null
      username?: string | null
      role?: string | null
      metadata?: Record<string, unknown>
    },
  ) {
    this.auditEvents.push({
      id: this.idGenerator.next('auth_audit'),
      type,
      occurredAt: this.clock.now(),
      reasonCode: input.reasonCode,
      userId: input.user?.id ?? input.userId ?? null,
      username: input.user?.username ?? input.username ?? null,
      role: input.user?.role ?? input.role ?? null,
      metadata: input.metadata ?? {},
    })
  }
}
