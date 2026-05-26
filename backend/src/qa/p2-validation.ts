import { createAIApplicationServices } from '../services/api-factory'
import type { AuditActor } from '../domain/types'

interface ValidationResult {
  name: string
  passed: boolean
  detail: string
}

const actor: AuditActor = {
  type: 'system',
  id: 'qa-p2-runner',
  name: 'QA P2 Runner',
}

function assert(condition: boolean, detail: string): { passed: boolean; detail: string } {
  return {
    passed: condition,
    detail,
  }
}

async function validateSuccessfulReportDelivery(): Promise<ValidationResult[]> {
  const services = createAIApplicationServices()
  const report = (await services.generateReport({
    type: 'daily',
    now: '2026-04-22T10:00:00.000Z',
  })).report

  services.saveSupervisorEmailMapping({
    scopeType: 'lab',
    scopeId: 'lab-1',
    scopeName: '分析实验室',
    recipientName: '实验室主管',
    recipientEmail: 'director@example.com',
    enabled: true,
  })

  services.saveReportDeliveryConfig({
    reportType: 'daily',
    scopeType: 'lab',
    scopeId: 'lab-1',
    scopeName: '分析实验室',
    channel: 'email',
    enabled: true,
  })

  const result = await services.sendReport({
    reportId: report.id,
    actor,
  })

  const records = services.listReportDeliveryRecords()

  return [
    {
      name: '报告发送成功时会生成成功记录',
      ...assert(
        result.records.length === 1 &&
          result.records[0].status === 'success' &&
          records.some((item) => item.id === result.records[0].id),
        `Observed statuses=${result.records.map((item) => item.status).join(', ')}`,
      ),
    },
  ]
}

async function validateMissingMappingFailure(): Promise<ValidationResult[]> {
  const services = createAIApplicationServices()
  const report = (await services.generateReport({
    type: 'weekly',
    now: '2026-04-22T10:00:00.000Z',
  })).report

  services.saveReportDeliveryConfig({
    reportType: 'weekly',
    scopeType: 'department',
    scopeId: 'dept-1',
    scopeName: '设备组',
    channel: 'email',
    enabled: true,
  })

  const result = await services.sendReport({
    reportId: report.id,
    actor,
  })

  return [
    {
      name: '缺少邮箱映射时会生成失败记录',
      ...assert(
        result.records.length === 1 &&
          result.records[0].status === 'failed' &&
          (result.records[0].errorMessage ?? '').includes('No enabled email mapping'),
        `Observed status=${result.records[0]?.status ?? 'none'}, error=${result.records[0]?.errorMessage ?? 'none'}`,
      ),
    },
  ]
}

async function validateDisabledConfigIgnored(): Promise<ValidationResult[]> {
  const services = createAIApplicationServices()
  const report = (await services.generateReport({
    type: 'risk_summary',
    now: '2026-04-22T10:00:00.000Z',
  })).report

  services.saveSupervisorEmailMapping({
    scopeType: 'global',
    scopeName: '全局主管',
    recipientName: '总主管',
    recipientEmail: 'owner@example.com',
    enabled: true,
  })

  services.saveReportDeliveryConfig({
    reportType: 'risk_summary',
    scopeType: 'global',
    scopeName: '全局主管',
    channel: 'email',
    enabled: false,
  })

  let blocked = false
  try {
    await services.sendReport({
      reportId: report.id,
      actor,
    })
  } catch {
    blocked = true
  }

  return [
    {
      name: '禁用配置不会参与发送',
      ...assert(blocked, 'Observed validation error when no enabled config existed.'),
    },
  ]
}

async function runValidationSuite(): Promise<ValidationResult[]> {
  return [
    ...(await validateSuccessfulReportDelivery()),
    ...(await validateMissingMappingFailure()),
    ...(await validateDisabledConfigIgnored()),
  ]
}

void runValidationSuite().then((results) => {
  const failed = results.filter((result) => !result.passed)

  for (const result of results) {
    const prefix = result.passed ? '[PASS]' : '[FAIL]'
    console.log(`${prefix} ${result.name}: ${result.detail}`)
  }

  if (failed.length > 0) {
    console.error(`\nQA P2 validation failed with ${failed.length} failed checks.`)
    throw new Error(`QA P2 validation failed with ${failed.length} failed checks.`)
  } else {
    console.log(`\nQA P2 validation passed with ${results.length} checks.`)
  }
})
