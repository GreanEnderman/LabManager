import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { loadAppConfig } from './app-config'

test('loadAppConfig uses local runtime defaults without bootstrap users', () => {
  const config = loadAppConfig({})

  assert.equal(config.runtimeEnvironment, 'local')
  assert.equal(config.smtp.enabled, false)
  assert.equal(config.bootstrapUsersEnabled, false)
  assert.deepEqual(config.bootstrapUsers, [])
  assert.equal(config.jwtSecret, 'local-development-only-jwt-secret')
})

test('loadAppConfig accepts explicit bootstrap users in test runtime', () => {
  const config = loadAppConfig({
    AI_RUNTIME_ENV: 'test',
    BOOTSTRAP_USERS_ENABLED: 'true',
    BOOTSTRAP_USERS_JSON: JSON.stringify([
      {
        username: 'tester-admin',
        password: 'BetterPassword!234',
        name: 'Test Admin',
        role: 'admin',
      },
    ]),
  })

  assert.equal(config.runtimeEnvironment, 'test')
  assert.equal(config.bootstrapUsersEnabled, true)
  assert.equal(config.bootstrapUsers.length, 1)
  assert.equal(config.bootstrapUsers[0].username, 'tester-admin')
})

test('loadAppConfig rejects prohibited fixture bootstrap usernames', () => {
  assert.throws(
    () =>
      loadAppConfig({
        AI_RUNTIME_ENV: 'test',
        BOOTSTRAP_USERS_ENABLED: 'true',
        BOOTSTRAP_USERS_JSON: JSON.stringify([
          {
            username: 'admin',
            password: 'BetterPassword!234',
            name: 'Fixture Admin',
            role: 'admin',
          },
        ]),
      }),
    /prohibited fixture username/,
  )
})

test('loadAppConfig rejects prohibited fixture bootstrap passwords', () => {
  assert.throws(
    () =>
      loadAppConfig({
        AI_RUNTIME_ENV: 'test',
        BOOTSTRAP_USERS_ENABLED: 'true',
        BOOTSTRAP_USERS_JSON: JSON.stringify([
          {
            username: 'fixture-admin',
            password: 'admin123!',
            name: 'Fixture Admin',
            role: 'admin',
          },
        ]),
      }),
    /prohibited fixture password/,
  )
})

test('loadAppConfig rejects placeholder JWT secret in production', () => {
  assert.throws(
    () =>
      loadAppConfig({
        AI_RUNTIME_ENV: 'production',
        JWT_SECRET: 'change-me',
      }),
    /JWT_SECRET must be provided explicitly/,
  )
})

test('loadAppConfig rejects bootstrap seeding in staging', () => {
  assert.throws(
    () =>
      loadAppConfig({
        AI_RUNTIME_ENV: 'staging',
        JWT_SECRET: 'real-staging-secret-value',
        BOOTSTRAP_USERS_ENABLED: 'true',
        BOOTSTRAP_USERS_JSON: JSON.stringify([
          {
            username: 'stage-admin',
            password: 'SecureStagePassword!1',
            name: 'Stage Admin',
            role: 'admin',
          },
        ]),
      }),
    /Bootstrap user seeding must not be enabled/,
  )
})

test('loadAppConfig rejects enabled SMTP without credentials', () => {
  assert.throws(
    () =>
      loadAppConfig({
        SMTP_ENABLED: 'true',
      }),
    /SMTP_HOST is required when SMTP_ENABLED=true/,
  )
})

test('loadAppConfig rejects enabled LLM without api key', () => {
  assert.throws(
    () =>
      loadAppConfig({
        AI_LLM_ENABLED: 'true',
      }),
    /AI_LLM_API_KEY is required when AI_LLM_ENABLED=true/,
  )
})

test('loadAppConfig accepts fully injected production configuration', () => {
  const config = loadAppConfig({
    AI_RUNTIME_ENV: 'production',
    JWT_SECRET: 'prod-secret-value-123',
    JWT_EXPIRES_IN_MINUTES: '120',
    SMTP_ENABLED: 'true',
    SMTP_HOST: 'smtp.company.test',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'mailer',
    SMTP_PASSWORD: 'mailer-password',
    SMTP_FROM_ADDRESS: 'noreply@company.test',
    AI_LLM_ENABLED: 'true',
    AI_LLM_API_KEY: 'llm-api-key',
  })

  assert.equal(config.runtimeEnvironment, 'production')
  assert.equal(config.smtp.enabled, true)
  assert.equal(config.smtp.host, 'smtp.company.test')
  assert.equal(config.llm.enabled, true)
})

test('loadAppConfig rejects excessive token lifetime in staging or production', () => {
  assert.throws(
    () =>
      loadAppConfig({
        AI_RUNTIME_ENV: 'production',
        JWT_SECRET: 'prod-secret-value-123',
        JWT_EXPIRES_IN_MINUTES: '121',
      }),
    /must not exceed 120/,
  )
})
