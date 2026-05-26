import type { AIEventDTO, DomainContextDTO } from '../contracts/shared'
import type { AIReportType } from '../domain/types'
import type { AppConfig } from './app-config'

export interface RecommendationBundle {
  reason: string
  riskSummary: string
  actionSummary: string
}

export interface LLMExecutionMeta {
  llmUsed: boolean
  fallbackReason: string | null
  provider: 'disabled' | 'openai_compatible'
  model: string | null
}

export interface RecommendationResult {
  content: RecommendationBundle
  meta: LLMExecutionMeta
}

export interface ReportNarrativeInput {
  type: AIReportType
  title: string
  now: string
  stats: {
    openTasks: number
    inProgressTasks: number
    pendingApprovals: number
    highRiskTasks: number
    completedTasks: number
    escalatedTasks: number
    taskCount: number
    approvalCount: number
  }
}

export interface ReportNarrative {
  summary: string
  highlights: string[]
}

export interface ReportNarrativeResult {
  content: ReportNarrative
  meta: LLMExecutionMeta
}

export interface LLMService {
  isEnabled(): boolean
  generateRecommendationBundle(event: AIEventDTO, context: DomainContextDTO, fallback: RecommendationBundle): Promise<RecommendationResult>
  generateReportNarrative(input: ReportNarrativeInput, fallback: ReportNarrative): Promise<ReportNarrativeResult>
}

interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

function cleanLine(value: unknown, fallback: string) {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized || fallback
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }

    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function disabledMeta(reason: string): LLMExecutionMeta {
  return {
    llmUsed: false,
    fallbackReason: reason,
    provider: 'disabled',
    model: null,
  }
}

class OpenAICompatibleLLMService implements LLMService {
  constructor(private readonly config: AppConfig['llm']) {}

  isEnabled() {
    return this.config.enabled && Boolean(this.config.apiKey.trim())
  }

  async generateRecommendationBundle(event: AIEventDTO, context: DomainContextDTO, fallback: RecommendationBundle) {
    if (!this.isEnabled()) {
      return {
        content: fallback,
        meta: disabledMeta('llm_disabled'),
      }
    }

    const result = await this.completeJson('recommendation_bundle', [
      {
        role: 'system',
        content:
          'You are a laboratory AI operations coordinator. Return JSON only with keys reason, riskSummary, actionSummary. Be concise, auditable, and do not invent facts.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'Generate task reason, risk summary, and next action for a lab event.',
          event,
          context,
          fallback,
        }),
      },
    ], fallback)

    return {
      content: {
        reason: cleanLine(result.content.reason, fallback.reason),
        riskSummary: cleanLine(result.content.riskSummary, fallback.riskSummary),
        actionSummary: cleanLine(result.content.actionSummary, fallback.actionSummary),
      },
      meta: result.meta,
    }
  }

  async generateReportNarrative(input: ReportNarrativeInput, fallback: ReportNarrative) {
    if (!this.isEnabled()) {
      return {
        content: fallback,
        meta: disabledMeta('llm_disabled'),
      }
    }

    const result = await this.completeJson('report_narrative', [
      {
        role: 'system',
        content:
          'You are a laboratory reporting agent. Return JSON only with keys summary and highlights. summary must be one concise paragraph. highlights must be an array of 3 to 5 short items.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'Generate report summary and highlights for lab operations.',
          input,
          fallback,
        }),
      },
    ], fallback)

    const rawHighlights = Array.isArray(result.content.highlights) ? result.content.highlights : fallback.highlights
    const highlights = rawHighlights.map((item) => cleanLine(item, '')).filter(Boolean).slice(0, 5)

    return {
      content: {
        summary: cleanLine(result.content.summary, fallback.summary),
        highlights: highlights.length > 0 ? highlights : fallback.highlights,
      },
      meta: result.meta,
    }
  }

  private async completeJson(
    operation: string,
    messages: ChatMessage[],
    fallback: object,
  ): Promise<{ content: Record<string, unknown>; meta: LLMExecutionMeta }> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)

    try {
      console.log('[llm] request', {
        operation,
        provider: 'openai_compatible',
        baseUrl: this.config.baseUrl,
        model: this.config.model,
      })

      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const reason = `http_${response.status}`
        console.warn('[llm] fallback', { operation, model: this.config.model, reason })
        return {
          content: fallback as Record<string, unknown>,
          meta: {
            llmUsed: false,
            fallbackReason: reason,
            provider: 'openai_compatible',
            model: this.config.model,
          },
        }
      }

      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const content = payload.choices?.[0]?.message?.content
      if (!content) {
        console.warn('[llm] fallback', { operation, model: this.config.model, reason: 'empty_content' })
        return {
          content: fallback as Record<string, unknown>,
          meta: {
            llmUsed: false,
            fallbackReason: 'empty_content',
            provider: 'openai_compatible',
            model: this.config.model,
          },
        }
      }

      const parsed = parseJsonObject(content)
      if (!parsed) {
        console.warn('[llm] fallback', { operation, model: this.config.model, reason: 'invalid_json' })
        return {
          content: fallback as Record<string, unknown>,
          meta: {
            llmUsed: false,
            fallbackReason: 'invalid_json',
            provider: 'openai_compatible',
            model: this.config.model,
          },
        }
      }

      console.log('[llm] success', { operation, model: this.config.model })
      return {
        content: parsed,
        meta: {
          llmUsed: true,
          fallbackReason: null,
          provider: 'openai_compatible',
          model: this.config.model,
        },
      }
    } catch (error) {
      const reason = error instanceof Error ? error.name || 'request_failed' : 'request_failed'
      console.warn('[llm] fallback', { operation, model: this.config.model, reason })
      return {
          content: fallback as Record<string, unknown>,
        meta: {
          llmUsed: false,
          fallbackReason: reason,
          provider: 'openai_compatible',
          model: this.config.model,
        },
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}

class DisabledLLMService implements LLMService {
  isEnabled() {
    return false
  }

  async generateRecommendationBundle(_event: AIEventDTO, _context: DomainContextDTO, fallback: RecommendationBundle) {
    return {
      content: fallback,
      meta: disabledMeta('llm_disabled'),
    }
  }

  async generateReportNarrative(_input: ReportNarrativeInput, fallback: ReportNarrative) {
    return {
      content: fallback,
      meta: disabledMeta('llm_disabled'),
    }
  }
}

export function createLLMService(config: AppConfig): LLMService {
  if (!config.llm.enabled || !config.llm.apiKey.trim()) {
    return new DisabledLLMService()
  }

  return new OpenAICompatibleLLMService(config.llm)
}
