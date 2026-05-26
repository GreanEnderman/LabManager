import type { AIApplicationServices } from '../services/api-factory'
import { LangGraphV1Runner } from './graph-runner'
import { ReportingAgentRunner } from './reporting-agent'
import { TaskTrackingAgentRunner } from './task-tracking-agent'

export function createLangGraphV1Runner(services: AIApplicationServices) {
  return new LangGraphV1Runner({ services })
}

export function createTaskTrackingAgentRunner(services: AIApplicationServices) {
  return new TaskTrackingAgentRunner({ services })
}

export function createReportingAgentRunner(services: AIApplicationServices) {
  return new ReportingAgentRunner({ services })
}
