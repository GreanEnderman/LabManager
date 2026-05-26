import type {
  ExportReportPdfResponse,
  ListReportDeliveryConfigsQuery,
  ListReportDeliveryRecordsQuery,
  ListSupervisorEmailMappingsQuery,
  SendReportRequest,
  SendReportResponse,
  UpsertReportDeliveryConfigRequest,
  UpsertSupervisorEmailMappingRequest,
} from '../contracts/shared'
import { buildTaskActionLog } from '../domain/activity-log'
import {
  toReportDeliveryConfigDTO,
  toReportDeliveryRecordDTO,
  toSupervisorEmailMappingDTO,
} from '../domain/mappers'
import type {
  ReportDeliveryConfigRecord,
  ReportDeliveryRecord,
  SupervisorEmailMappingRecord,
} from '../domain/models'
import { EntityNotFoundError, ValidationError } from './errors'
import type { ActivityLogService } from './activity-log-service'
import type { Clock } from './clock'
import type { EmailSender } from './email-sender'
import type { IdGenerator } from './id-generator'
import type { AIRepository } from './repositories'

export interface ReportDeliveryServiceDependencies {
  repository: AIRepository
  idGenerator: IdGenerator
  clock: Clock
  activityLogs: ActivityLogService
  emailSender: EmailSender
  exportReportPdf: (reportId: string) => Promise<ExportReportPdfResponse>
}

export class ReportDeliveryService {
  constructor(private readonly deps: ReportDeliveryServiceDependencies) {}

  listMappings(query: ListSupervisorEmailMappingsQuery = {}) {
    return [...this.deps.repository.reportDeliveryMappings.values()]
      .filter((mapping) => {
        if (query.scopeType && mapping.scopeType !== query.scopeType) return false
        if (query.enabled && String(mapping.enabled) !== query.enabled) return false
        return true
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(toSupervisorEmailMappingDTO)
  }

  saveMapping(request: UpsertSupervisorEmailMappingRequest, mappingId?: string) {
    if (!request.recipientEmail.trim()) {
      throw new ValidationError('Recipient email is required.')
    }

    const now = this.deps.clock.now()
    const record: SupervisorEmailMappingRecord = {
      id: mappingId ?? this.deps.idGenerator.next('mapping'),
      scopeType: request.scopeType,
      scopeId: request.scopeId ?? null,
      scopeName: request.scopeName,
      recipientName: request.recipientName,
      recipientEmail: request.recipientEmail,
      enabled: request.enabled,
      createdAt: this.deps.repository.reportDeliveryMappings.get(mappingId ?? '')?.createdAt ?? now,
      updatedAt: now,
    }

    this.deps.repository.reportDeliveryMappings.set(record.id, record)
    return toSupervisorEmailMappingDTO(record)
  }

  listConfigs(query: ListReportDeliveryConfigsQuery = {}) {
    return [...this.deps.repository.reportDeliveryConfigs.values()]
      .filter((config) => {
        if (query.reportType && config.reportType !== query.reportType) return false
        if (query.enabled && String(config.enabled) !== query.enabled) return false
        return true
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(toReportDeliveryConfigDTO)
  }

  saveConfig(request: UpsertReportDeliveryConfigRequest, configId?: string) {
    const now = this.deps.clock.now()
    const record: ReportDeliveryConfigRecord = {
      id: configId ?? this.deps.idGenerator.next('delivery_config'),
      reportType: request.reportType,
      scopeType: request.scopeType,
      scopeId: request.scopeId ?? null,
      scopeName: request.scopeName,
      channel: request.channel,
      enabled: request.enabled,
      createdAt: this.deps.repository.reportDeliveryConfigs.get(configId ?? '')?.createdAt ?? now,
      updatedAt: now,
    }

    this.deps.repository.reportDeliveryConfigs.set(record.id, record)
    return toReportDeliveryConfigDTO(record)
  }

  listRecords(query: ListReportDeliveryRecordsQuery = {}) {
    return [...this.deps.repository.reportDeliveryRecords.values()]
      .filter((record) => {
        if (query.reportType && record.reportType !== query.reportType) return false
        if (query.status && record.status !== query.status) return false
        return true
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(toReportDeliveryRecordDTO)
  }

  async sendReport(request: SendReportRequest): Promise<SendReportResponse> {
    const report = this.deps.repository.reports.get(request.reportId)
    if (!report) {
      throw new EntityNotFoundError('Report', request.reportId)
    }

    const configs = [...this.deps.repository.reportDeliveryConfigs.values()].filter(
      (config) => config.enabled && config.reportType === report.type,
    )

    if (configs.length === 0) {
      throw new ValidationError(`No enabled delivery config found for report type "${report.type}".`)
    }

    this.deps.activityLogs.append(
      buildTaskActionLog({
        id: this.deps.idGenerator.next('action'),
        actionType: 'report_delivery_requested',
        actor: request.actor,
        detail: `Report ${report.id} delivery requested.`,
        createdAt: this.deps.clock.now(),
        reasonCodes: ['report_delivery_requested'],
        snapshot: {
          reportId: report.id,
          reportType: report.type,
          configCount: configs.length,
        },
      }),
    )

    const pdfAttachment = await this.deps.exportReportPdf(report.id)
    const records = (
      await Promise.all(
        configs.map(async (config) => {
          const mappings = [...this.deps.repository.reportDeliveryMappings.values()].filter(
            (mapping) =>
              mapping.enabled &&
              mapping.scopeType === config.scopeType &&
              (mapping.scopeId ?? null) === (config.scopeId ?? null),
          )

          if (mappings.length === 0) {
            return [
              this.createRecord({
                reportId: report.id,
                reportTitle: report.title,
                reportType: report.type,
                recipientName: config.scopeName,
                recipientEmail: '',
                channel: config.channel,
                status: 'failed',
                errorMessage: `No enabled email mapping found for scope "${config.scopeName}".`,
                actor: request.actor,
              }),
            ]
          }

          return await Promise.all(
            mappings.map(async (mapping) => {
              const sendResult = await this.deps.emailSender.send({
                recipientEmail: mapping.recipientEmail,
                recipientName: mapping.recipientName,
                subject: report.title,
                text: `${report.summary}\n\n${report.highlights.join('\n')}`,
                html: this.buildReportEmailHtml(report.title, report.summary, report.highlights),
                attachments: [
                  {
                    filename: pdfAttachment.fileName,
                    contentBase64: pdfAttachment.contentBase64,
                    contentType: pdfAttachment.mimeType,
                  },
                ],
              })

              return this.createRecord({
                reportId: report.id,
                reportTitle: report.title,
                reportType: report.type,
                recipientName: mapping.recipientName,
                recipientEmail: mapping.recipientEmail,
                channel: config.channel,
                status: sendResult.success ? 'success' : 'failed',
                errorMessage: sendResult.errorMessage,
                actor: request.actor,
              })
            }),
          )
        }),
      )
    ).flat()

    return {
      records: records.map(toReportDeliveryRecordDTO),
    }
  }

  private createRecord(input: {
    reportId: string
    reportTitle: string
    reportType: ReportDeliveryRecord['reportType']
    recipientName: string
    recipientEmail: string
    channel: ReportDeliveryRecord['channel']
    status: ReportDeliveryRecord['status']
    errorMessage: string | null
    actor: SendReportRequest['actor']
  }) {
    const now = this.deps.clock.now()
    const record: ReportDeliveryRecord = {
      id: this.deps.idGenerator.next('delivery_record'),
      reportId: input.reportId,
      reportTitle: input.reportTitle,
      reportType: input.reportType,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      channel: input.channel,
      status: input.status,
      errorMessage: input.errorMessage,
      triggeredBy: input.actor,
      triggerMode: 'manual',
      sentAt: now,
      createdAt: now,
    }

    this.deps.repository.reportDeliveryRecords.set(record.id, record)
    this.deps.activityLogs.append(
      buildTaskActionLog({
        id: this.deps.idGenerator.next('action'),
        actionType: input.status === 'success' ? 'report_delivery_succeeded' : 'report_delivery_failed',
        actor: input.actor,
        detail:
          input.status === 'success'
            ? `Delivered report ${input.reportId} to ${input.recipientEmail}.`
            : `Failed to deliver report ${input.reportId}: ${input.errorMessage ?? 'Unknown error'}.`,
        createdAt: now,
        reasonCodes: [
          input.status === 'success' ? 'report_delivery_succeeded' : 'report_delivery_failed',
        ],
        snapshot: {
          reportId: input.reportId,
          recipientEmail: input.recipientEmail,
          deliveryRecordId: record.id,
        },
      }),
    )

    return record
  }

  private buildReportEmailHtml(title: string, summary: string, highlights: string[]) {
    return `
      <div style="font-family: Arial, sans-serif; color: #1e293b;">
        <h1 style="font-size: 20px;">${title}</h1>
        <p style="line-height: 1.6;">${summary}</p>
        <h2 style="font-size: 16px; margin-top: 24px;">Highlights</h2>
        <ul>
          ${highlights.map((highlight) => `<li>${highlight}</li>`).join('')}
        </ul>
      </div>
    `.trim()
  }
}
