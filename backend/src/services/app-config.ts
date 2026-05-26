import type { UserRole } from '../domain/types'

export interface BootstrapUserConfig {
  username: string
  password: string
  name: string
  role: UserRole
}

export interface SMTPConfig {
  enabled: boolean
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  fromAddress: string
  fromName: string
}

export interface AppConfig {
  runtimeEnvironment: 'local' | 'test' | 'staging' | 'production'
  storageDriver: 'memory' | 'postgres'
  databaseUrl: string
  jwtSecret: string
  jwtIssuer: string
  jwtAudience: string
  jwtExpiresInMinutes: number
  auth: {
    accessTokenTtlMinutes: number
    loginRateLimitMaxAttempts: number
    loginRateLimitWindowMinutes: number
  }
  llm: {
    enabled: boolean
    baseUrl: string
    apiKey: string
    model: string
    timeoutMs: number
  }
  smtp: SMTPConfig
  bootstrapUsersEnabled: boolean
  bootstrapUsers: BootstrapUserConfig[]
}

const DEVELOPMENT_JWT_FALLBACK = 'local-development-only-jwt-secret'
const PROHIBITED_SECRET_VALUES = new Set<string>([
  '',
  'change-me',
  'labmanager-dev-secret',
  'labmanager-prod-change-this-to-a-long-random-secret',
  DEVELOPMENT_JWT_FALLBACK,
])

const PROHIBITED_BOOTSTRAP_USERNAMES = new Set<string>(['admin', 'demo', 'viewer', 'operator', 'manager'])
const PROHIBITED_BOOTSTRAP_PASSWORDS = new Set<string>(['labmanager123!', 'admin123!', 'changeme123!'])

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback
  }

  return value === 'true'
}

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeRuntimeEnvironment(value: string | undefined): AppConfig['runtimeEnvironment'] {
  const normalized = value?.trim().toLowerCase()

  switch (normalized) {
    case 'production':
    case 'prod':
      return 'production'
    case 'staging':
    case 'stage':
    case 'preprod':
    case 'pre-production':
    case 'preview':
      return 'staging'
    case 'test':
      return 'test'
    case 'local':
    case 'development':
    case 'dev':
    case undefined:
    case '':
      return 'local'
    default:
      throw new Error(`Unsupported AI runtime environment "${value}".`)
  }
}

function parseBootstrapUsers(raw: string | undefined): BootstrapUserConfig[] {
  if (!raw?.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as BootstrapUserConfig[]
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
    }
  } catch {
    throw new Error('BOOTSTRAP_USERS_JSON must be valid JSON when bootstrap seeding is enabled.')
  }

  return []
}

function isPlaceholderSecret(value: string | undefined) {
  return PROHIBITED_SECRET_VALUES.has(value?.trim().toLowerCase() ?? '')
}

function requireNonPlaceholder(value: string, fieldName: string) {
  if (isPlaceholderSecret(value)) {
    throw new Error(`${fieldName} must be provided explicitly and cannot use a placeholder value.`)
  }
}

function validateBootstrapUsers(users: BootstrapUserConfig[]) {
  users.forEach((user, index) => {
    if (!user.username?.trim() || !user.password?.trim() || !user.name?.trim()) {
      throw new Error(`BOOTSTRAP_USERS_JSON entry ${index + 1} must include username, password, and name.`)
    }

    if (PROHIBITED_BOOTSTRAP_USERNAMES.has(user.username.trim().toLowerCase())) {
      throw new Error(`BOOTSTRAP_USERS_JSON entry ${index + 1} uses a prohibited fixture username.`)
    }

    if (PROHIBITED_BOOTSTRAP_PASSWORDS.has(user.password.trim().toLowerCase())) {
      throw new Error(`BOOTSTRAP_USERS_JSON entry ${index + 1} uses a prohibited fixture password.`)
    }
  })
}

function validateAppConfig(config: AppConfig) {
  const isDeploymentEnvironment =
    config.runtimeEnvironment === 'staging' || config.runtimeEnvironment === 'production'

  if (isDeploymentEnvironment) {
    requireNonPlaceholder(config.jwtSecret, 'JWT_SECRET')

    if (config.auth.accessTokenTtlMinutes > 120) {
      throw new Error('JWT_EXPIRES_IN_MINUTES must not exceed 120 in staging or production.')
    }
  }

  if (config.llm.enabled && isPlaceholderSecret(config.llm.apiKey)) {
    throw new Error('AI_LLM_API_KEY is required when AI_LLM_ENABLED=true.')
  }

  if (config.smtp.enabled) {
    if (!config.smtp.host.trim()) {
      throw new Error('SMTP_HOST is required when SMTP_ENABLED=true.')
    }

    if (!config.smtp.user.trim()) {
      throw new Error('SMTP_USER is required when SMTP_ENABLED=true.')
    }

    if (isPlaceholderSecret(config.smtp.password)) {
      throw new Error('SMTP_PASSWORD is required when SMTP_ENABLED=true.')
    }

    if (!config.smtp.fromAddress.trim()) {
      throw new Error('SMTP_FROM_ADDRESS is required when SMTP_ENABLED=true.')
    }
  }

  if (config.bootstrapUsersEnabled) {
    if (isDeploymentEnvironment) {
      throw new Error('Bootstrap user seeding must not be enabled in staging or production environments.')
    }

    if (config.bootstrapUsers.length === 0) {
      throw new Error('BOOTSTRAP_USERS_JSON is required when bootstrap user seeding is enabled.')
    }

    validateBootstrapUsers(config.bootstrapUsers)
  }
}

export function loadAppConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const runtimeEnvironment = normalizeRuntimeEnvironment(env.AI_RUNTIME_ENV ?? env.NODE_ENV)
  const bootstrapUsersEnabled = parseBoolean(env.BOOTSTRAP_USERS_ENABLED, false)
  const config: AppConfig = {
    runtimeEnvironment,
    storageDriver: env.AI_STORAGE_DRIVER === 'postgres' ? 'postgres' : 'memory',
    databaseUrl: env.DATABASE_URL ?? 'postgres://labmanager:labmanager@localhost:5432/labmanager',
    jwtSecret: env.JWT_SECRET ?? DEVELOPMENT_JWT_FALLBACK,
    jwtIssuer: env.JWT_ISSUER ?? 'labmanager-backend',
    jwtAudience: env.JWT_AUDIENCE ?? 'labmanager-web',
    jwtExpiresInMinutes: parseNumber(env.JWT_EXPIRES_IN_MINUTES, 720),
    auth: {
      accessTokenTtlMinutes: parseNumber(env.JWT_EXPIRES_IN_MINUTES, runtimeEnvironment === 'local' ? 120 : 60),
      loginRateLimitMaxAttempts: parseNumber(env.AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS, 5),
      loginRateLimitWindowMinutes: parseNumber(env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MINUTES, 15),
    },
    llm: {
      enabled: parseBoolean(env.AI_LLM_ENABLED, false),
      baseUrl: env.AI_LLM_BASE_URL ?? 'https://api.openai.com/v1',
      apiKey: env.AI_LLM_API_KEY ?? '',
      model: env.AI_LLM_MODEL ?? 'gpt-4o-mini',
      timeoutMs: parseNumber(env.AI_LLM_TIMEOUT_MS, 20000),
    },
    smtp: {
      enabled: parseBoolean(env.SMTP_ENABLED, false),
      host: env.SMTP_HOST ?? '',
      port: parseNumber(env.SMTP_PORT, 25),
      secure: parseBoolean(env.SMTP_SECURE, false),
      user: env.SMTP_USER ?? '',
      password: env.SMTP_PASSWORD ?? '',
      fromAddress: env.SMTP_FROM_ADDRESS ?? '',
      fromName: env.SMTP_FROM_NAME ?? 'LabManager',
    },
    bootstrapUsersEnabled,
    bootstrapUsers: bootstrapUsersEnabled ? parseBootstrapUsers(env.BOOTSTRAP_USERS_JSON) : [],
  }

  validateAppConfig(config)

  return config
}
