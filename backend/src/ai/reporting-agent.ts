import type {
  ExecuteReportingAgentRequest,
  ExecuteReportingAgentResponse,
  ReportingAgentStateDTO,
} from '../contracts/shared'
import type { AIApplicationServices } from '../services/api-factory'

export interface ReportingAgentDependencies {
  services: Pick<AIApplicationServices, 'generateReport'>
}

function buildSummary(type: ExecuteReportingAgentRequest['type'], reportId: string, reportSummary: string) {
  return `Reporting agent generated ${type} report ${reportId}. ${reportSummary}`
}

export class ReportingAgentRunner {
  constructor(private readonly deps: ReportingAgentDependencies) {}

  async run(input: ExecuteReportingAgentRequest): Promise<ExecuteReportingAgentResponse> {
    const response = await this.deps.services.generateReport({
      type: input.type,
      now: input.now,
    })

    const summary = buildSummary(input.type, response.report.id, response.report.summary)
    const state: ReportingAgentStateDTO = {
      runId: input.runId,
      now: input.now,
      actor: input.actor,
      reportType: input.type,
      report: response.report,
      logs: [
        {
          step: 'generate_report',
          detail: `Generated ${input.type} report ${response.report.id} with title "${response.report.title}".`,
        },
        {
          step: 'summarize',
          detail: summary,
        },
      ],
      output: {
        status: 'completed',
        reportId: response.report.id,
        summary,
      },
    }

    return { state }
  }
}
