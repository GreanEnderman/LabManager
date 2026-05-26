import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAIHttpRouter } from './router'
import { createAIApplicationServices } from '../services/api-factory'
import type {
  ApiEnvelope,
  LoginResponse,
  ProcessApprovalResponse,
  SystemSettingsDTO,
  UpdateTaskStatusResponse,
} from '../contracts/shared'
import type { AppConfig } from '../services/app-config'
import type { AuditActor } from '../domain/types'

function createConfig(): AppConfig {
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
      loginRateLimitMaxAttempts: 5,
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
        username: 'admin.user',
        password: 'BetterPassword!234',
        name: 'Admin User',
        role: 'admin',
      },
      {
        username: 'manager.user',
        password: 'BetterPassword!234',
        name: 'Manager User',
        role: 'manager',
      },
      {
        username: 'operator.user',
        password: 'BetterPassword!234',
        name: 'Operator User',
        role: 'operator',
      },
      {
        username: 'viewer.user',
        password: 'BetterPassword!234',
        name: 'Viewer User',
        role: 'viewer',
      },
    ],
  }
}

async function createHarness(options: { withPendingApproval?: boolean } = {}) {
  const services = createAIApplicationServices({ config: createConfig() })
  const router = createAIHttpRouter(services)
  const actor: AuditActor = { id: 'usr_seed', name: 'Seed User', type: 'user' }

  const createdTask = services.createTask(
    {
      eventId: null,
      type: 'maintenance',
      title: 'Seed maintenance task',
      summary: 'Seed task for capability tests',
      recommendation: 'Review equipment state',
      priority: 'P1',
      riskLevel: 'medium',
      sourceType: 'equipment',
      sourceId: 'equipment-seed-001',
      sourceName: 'Centrifuge A-01',
      requiresApproval: true,
      dueAt: '2026-05-01T10:00:00.000Z',
    },
    actor,
  )

  let approvalId: string | null = null
  if (options.withPendingApproval) {
    services.updateTaskStatus(
      createdTask.task.id,
      {
        transition: 'start_progress',
        detail: 'Seed task has started.',
      },
      actor,
    )

    services.updateTaskStatus(
      createdTask.task.id,
      {
        transition: 'request_approval',
        detail: 'Seed task is ready for approval.',
      },
      actor,
    )

    const createdApproval = services.createApproval(
      {
        taskId: createdTask.task.id,
        title: 'Approval for seed maintenance task',
        reason: 'Need approval before maintenance window',
        riskLevel: 'medium',
      },
      actor,
    )
    approvalId = createdApproval.approval.id
  }

  async function login(username: string) {
    const response = await router.handle({
      method: 'POST',
      path: '/api/ai/auth/login',
      body: {
        username,
        password: 'BetterPassword!234',
      },
    })

    assert.equal(response.status, 201)
    const data = readData<LoginResponse>(response)
    assert.ok(data.token)
    return data.token
  }

  return {
    services,
    router,
    taskId: createdTask.task.id,
    approvalId,
    login,
  }
}

function readData<T>(response: { body: ApiEnvelope<unknown> }) {
  return response.body.data as T
}

test('admin can update system settings while manager is forbidden', { concurrency: false }, async () => {
  const { router, login } = await createHarness()
  const adminToken = await login('admin.user')
  const managerToken = await login('manager.user')

  const adminResponse = await router.handle({
    method: 'PATCH',
    path: '/api/ai/settings',
    headers: { authorization: `Bearer ${adminToken}` },
    body: {
      thresholds: {
        defaultLowStockThreshold: 8,
      },
    },
  })

  assert.equal(adminResponse.status, 200)
  const adminData = readData<{ settings: SystemSettingsDTO }>(adminResponse)
  assert.equal(adminData.settings.thresholds.defaultLowStockThreshold, 8)

  const managerResponse = await router.handle({
    method: 'PATCH',
    path: '/api/ai/settings',
    headers: { authorization: `Bearer ${managerToken}` },
    body: {
      thresholds: {
        defaultLowStockThreshold: 9,
      },
    },
  })

  assert.equal(managerResponse.status, 403)
  assert.equal(managerResponse.body.error?.code, 'forbidden')
})

test('manager can process approvals while operator is forbidden', { concurrency: false }, async () => {
  const { router, login, approvalId } = await createHarness({ withPendingApproval: true })
  assert.ok(approvalId)
  const managerToken = await login('manager.user')
  const operatorToken = await login('operator.user')

  const managerResponse = await router.handle({
    method: 'PATCH',
    path: `/api/ai/approvals/${approvalId}/process`,
    headers: { authorization: `Bearer ${managerToken}` },
    body: {
      decision: 'approve',
      comment: 'Manager approved the change.',
    },
  })

  assert.equal(managerResponse.status, 200)
  const managerData = readData<ProcessApprovalResponse>(managerResponse)
  assert.equal(managerData.approval.status, 'approved')
  assert.equal(managerData.task.status, 'in_progress')

  const operatorResponse = await router.handle({
    method: 'PATCH',
    path: `/api/ai/approvals/${approvalId}/process`,
    headers: { authorization: `Bearer ${operatorToken}` },
    body: {
      decision: 'approve',
      comment: 'Operator should not be allowed.',
    },
  })

  assert.equal(operatorResponse.status, 403)
  assert.equal(operatorResponse.body.error?.code, 'forbidden')
})

test('operator can update task status while viewer is forbidden', { concurrency: false }, async () => {
  const { router, login, taskId } = await createHarness()
  const operatorToken = await login('operator.user')
  const viewerToken = await login('viewer.user')

  const operatorResponse = await router.handle({
    method: 'PATCH',
    path: `/api/ai/tasks/${taskId}/status`,
    headers: { authorization: `Bearer ${operatorToken}` },
    body: {
      transition: 'start_progress',
      detail: 'Operator started the task.',
    },
  })

  assert.equal(operatorResponse.status, 200)
  const operatorData = readData<UpdateTaskStatusResponse>(operatorResponse)
  assert.equal(operatorData.task.status, 'in_progress')

  const viewerResponse = await router.handle({
    method: 'PATCH',
    path: `/api/ai/tasks/${taskId}/status`,
    headers: { authorization: `Bearer ${viewerToken}` },
    body: {
      transition: 'complete',
      detail: 'Viewer should not be allowed.',
    },
  })

  assert.equal(viewerResponse.status, 403)
  assert.equal(viewerResponse.body.error?.code, 'forbidden')
})

test('viewer keeps read access but unauthenticated access is unauthorized', { concurrency: false }, async () => {
  const { router, login } = await createHarness()
  const viewerToken = await login('viewer.user')

  const viewerResponse = await router.handle({
    method: 'GET',
    path: '/api/ai/tasks',
    headers: { authorization: `Bearer ${viewerToken}` },
  })

  assert.equal(viewerResponse.status, 200)
  assert.ok(Array.isArray(readData<unknown[]>(viewerResponse)))

  const anonymousResponse = await router.handle({
    method: 'GET',
    path: '/api/ai/tasks',
  })

  assert.equal(anonymousResponse.status, 401)
  assert.equal(anonymousResponse.body.error?.code, 'unauthorized')
})

test('login throttling returns stable too_many_attempts error code', { concurrency: false }, async () => {
  const services = createAIApplicationServices({
    config: {
      ...createConfig(),
      auth: {
        accessTokenTtlMinutes: 60,
        loginRateLimitMaxAttempts: 2,
        loginRateLimitWindowMinutes: 15,
      },
    },
  })
  const router = createAIHttpRouter(services)

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await router.handle({
      method: 'POST',
      path: '/api/ai/auth/login',
      body: {
        username: 'manager.user',
        password: 'wrong-password',
      },
    })

    assert.equal(response.status, 401)
    assert.equal(response.body.error?.code, 'unauthorized')
  }

  const throttledResponse = await router.handle({
    method: 'POST',
    path: '/api/ai/auth/login',
    body: {
      username: 'manager.user',
      password: 'BetterPassword!234',
    },
  })

  assert.equal(throttledResponse.status, 429)
  assert.equal(throttledResponse.body.error?.code, 'too_many_attempts')
})

test('malformed bearer tokens return stable unauthorized error code', { concurrency: false }, async () => {
  const { router, services } = await createHarness()

  const response = await router.handle({
    method: 'GET',
    path: '/api/ai/tasks',
    headers: { authorization: 'Bearer malformed.token.value' },
  })

  assert.equal(response.status, 401)
  assert.equal(response.body.error?.code, 'unauthorized')
  assert.equal(
    services.listAuthAuditEvents().some((event) => event.type === 'token_invalidated' && event.reasonCode === 'invalid_signature'),
    true,
  )
})

test('forbidden routes record audit-safe forbidden_action evidence', { concurrency: false }, async () => {
  const { router, login, services } = await createHarness()
  const viewerToken = await login('viewer.user')

  const response = await router.handle({
    method: 'PATCH',
    path: '/api/ai/settings',
    headers: { authorization: `Bearer ${viewerToken}` },
    body: {
      thresholds: {
        defaultLowStockThreshold: 12,
      },
    },
  })

  assert.equal(response.status, 403)
  assert.equal(response.body.error?.code, 'forbidden')
  assert.equal(
    services
      .listAuthAuditEvents()
      .some(
        (event) =>
          event.type === 'forbidden_action' &&
          event.reasonCode === 'settings:update' &&
          JSON.stringify(event).includes(viewerToken) === false,
      ),
    true,
  )
})
