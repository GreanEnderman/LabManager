import type {
  DeleteReportResponse,
  GenerateReportRequest,
  GenerateReportResponse,
  ListReportsQuery,
} from '../contracts/shared'
import { toReportDTO } from '../domain/mappers'
import type { AIReportRecord } from '../domain/models'
import type { AIReportType } from '../domain/types'
import type { Clock } from './clock'
import { EntityNotFoundError } from './errors'
import type { IdGenerator } from './id-generator'
import type { LLMService } from './llm-service'
import type { AIDataStore } from './store'

export interface ReportServiceDependencies {
  store: AIDataStore
  idGenerator: IdGenerator
  clock: Clock
  llm: LLMService
}

function isReportInWindow(timestamp: string, startAt: Date, endAt: Date) {
  const value = new Date(timestamp).getTime()
  return value >= startAt.getTime() && value <= endAt.getTime()
}

function getReportWindow(type: AIReportType, now: string) {
  const endAt = new Date(now)
  const startAt = new Date(now)

  if (type === 'daily') {
    startAt.setUTCDate(startAt.getUTCDate() - 1)
  } else {
    startAt.setUTCDate(startAt.getUTCDate() - 7)
  }

  return { startAt, endAt }
}

function buildHighlights(input: {
  openTasks: number
  inProgressTasks: number
  pendingApprovals: number
  highRiskTasks: number
  completedTasks: number
  escalatedTasks: number
}) {
  return [
    `待处理任务：${input.openTasks} 项`,
    `进行中任务：${input.inProgressTasks} 项`,
    `待审批事项：${input.pendingApprovals} 项`,
    `高风险任务：${input.highRiskTasks} 项`,
    `已完成任务：${input.completedTasks} 项`,
    `已升级任务：${input.escalatedTasks} 项`,
  ]
}

function buildSummary(type: AIReportType, input: {
  openTasks: number
  inProgressTasks: number
  pendingApprovals: number
  highRiskTasks: number
  completedTasks: number
  escalatedTasks: number
}) {
  if (type === 'risk_summary') {
    return `风险专题摘要已生成：当前高风险任务 ${input.highRiskTasks} 项，待审批事项 ${input.pendingApprovals} 项，已升级任务 ${input.escalatedTasks} 项。`
  }

  return `${type === 'daily' ? '日报' : '周报'}已生成：当前待处理任务 ${input.openTasks} 项，进行中任务 ${input.inProgressTasks} 项，已完成任务 ${input.completedTasks} 项。`
}

function buildTitle(type: AIReportType, now: string) {
  switch (type) {
    case 'daily':
      return `AI 日报 ${now.slice(0, 10)}`
    case 'weekly':
      return `AI 周报 ${now.slice(0, 10)}`
    case 'risk_summary':
      return `AI 风险专题 ${now.slice(0, 10)}`
  }
}

export class ReportService {
  constructor(private readonly deps: ReportServiceDependencies) {}

  listReports(query: ListReportsQuery = {}) {
    return [...this.deps.store.reports.values()]
      .filter((report) => {
        if (query.type && report.type !== query.type) {
          return false
        }
        return true
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(toReportDTO)
  }

  deleteReport(reportId: string): DeleteReportResponse {
    const report = this.deps.store.reports.get(reportId)
    if (!report) {
      throw new EntityNotFoundError('Report', reportId)
    }

    this.deps.store.reports.delete(reportId)

    for (const [recordId, record] of this.deps.store.reportDeliveryRecords.entries()) {
      if (record.reportId === reportId) {
        this.deps.store.reportDeliveryRecords.delete(recordId)
      }
    }

    return {
      deletedReportId: reportId,
    }
  }

  async generateReport(request: GenerateReportRequest): Promise<GenerateReportResponse> {
    const now = request.now || this.deps.clock.now()
    const { startAt, endAt } = getReportWindow(request.type, now)
    const tasks = [...this.deps.store.tasks.values()].filter((task) => isReportInWindow(task.createdAt, startAt, endAt))
    const approvals = [...this.deps.store.approvals.values()].filter((approval) =>
      isReportInWindow(approval.createdAt, startAt, endAt),
    )

    const openTasks = tasks.filter((task) => task.status === 'open').length
    const inProgressTasks = tasks.filter((task) => task.status === 'in_progress').length
    const completedTasks = tasks.filter((task) => task.status === 'done' || task.status === 'closed').length
    const highRiskTasks = tasks.filter((task) => task.riskLevel === 'high').length
    const pendingApprovals = approvals.filter((approval) => approval.status === 'pending').length
    const escalatedTasks = tasks.filter((task) => task.metadata.slaEscalated === true).length

    const fallbackSummary = buildSummary(request.type, {
      openTasks,
      inProgressTasks,
      pendingApprovals,
      highRiskTasks,
      completedTasks,
      escalatedTasks,
    })
    const fallbackHighlights = buildHighlights({
      openTasks,
      inProgressTasks,
      pendingApprovals,
      highRiskTasks,
      completedTasks,
      escalatedTasks,
    })
    const narrativeResult = await this.deps.llm.generateReportNarrative(
      {
        type: request.type,
        title: buildTitle(request.type, now),
        now,
        stats: {
          openTasks,
          inProgressTasks,
          pendingApprovals,
          highRiskTasks,
          completedTasks,
          escalatedTasks,
          taskCount: tasks.length,
          approvalCount: approvals.length,
        },
      },
      {
        summary: fallbackSummary,
        highlights: fallbackHighlights,
      },
    )
    const narrative = narrativeResult.content

    const report: AIReportRecord = {
      id: this.deps.idGenerator.next('report'),
      type: request.type,
      title: buildTitle(request.type, now),
      summary: narrative.summary,
      highlights: narrative.highlights,
      createdAt: now,
      metadata: {
        windowStartAt: startAt.toISOString(),
        windowEndAt: endAt.toISOString(),
        taskCount: tasks.length,
        approvalCount: approvals.length,
        llmUsed: narrativeResult.meta.llmUsed,
        llmFallbackReason: narrativeResult.meta.fallbackReason,
        llmProvider: narrativeResult.meta.provider,
        llmModel: narrativeResult.meta.model,
        sections: [
          {
            title: '摘要',
            content: narrative.summary,
          },
          {
            title: '重点条目',
            content: narrative.highlights.join('；'),
          },
        ],
      },
    }

    this.deps.store.reports.set(report.id, report)

    return {
      report: toReportDTO(report),
    }
  }
}
