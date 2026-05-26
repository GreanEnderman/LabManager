/**
 * 预警 API 客户端
 * 连接到 Python 后端进行实时预警检测和任务创建
 */

const PYTHON_API_BASE = import.meta.env.VITE_PYTHON_API_BASE_URL || 'http://localhost:8001'

export interface AlertEvent {
  id: string
  type: 'low_stock' | 'maintenance_overdue' | 'equipment_fault'
  sourceType: 'chemical' | 'equipment'
  sourceId: string
  sourceName: string
  title: string
  summary: string
  priority: string
  riskLevel: string
  createdAt: string
  evidence: Array<{ label: string; value: string | number }>
  metadata: Record<string, any>
}

export interface AlertDecision {
  event: AlertEvent
  decision: string
}

export interface InspectRulesRequest {
  input: {
    chemicals?: Array<{
      id: string
      name: string
      totalQuantity: number
      threshold: number
    }>
    equipment?: Array<{
      id: string
      name: string
      status: string
      lastMaintenanceAt?: string | null
    }>
  }
  config: {
    now: string
    maintenanceOverdueDays: number
  }
}

export interface InspectRulesResponse {
  data: {
    items: AlertDecision[]
  }
}

export interface ExecuteRuleRequest {
  event: AlertEvent
  actor: {
    id: string
    name: string
    type: string
  }
  runId: string
}

export interface ExecuteRuleResponse {
  data: {
    state: {
      output: {
        taskId?: string
      }
      context: {
        existingOpenTask?: { id: string } | null
      }
      recommendation?: {
        reason?: string
        riskSummary?: string
        actionSummary?: string | string[]
        llmUsed?: boolean
        fallbackReason?: string | null
        provider?: string | null
        model?: string | null
      }
      task?: any
      taskDraft?: any
      approvalDraft?: any
      approval?: any
      activityLogCount?: number
    }
  }
}

export type PreviewRuleResponse = ExecuteRuleResponse

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${PYTHON_API_BASE}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`预警 API 错误: ${response.status} - ${error}`)
  }

  return response.json()
}

export const alertsApi = {
  /**
   * 检查当前数据并生成预警事件
   */
  async inspectRules(requestData: InspectRulesRequest): Promise<InspectRulesResponse> {
    return request<InspectRulesResponse>('/api/ai/rules/inspect', {
      method: 'POST',
      body: JSON.stringify(requestData),
    })
  },

  /**
   * 执行规则事件并使用 LLM 推荐创建任务
   */
  async executeRule(requestData: ExecuteRuleRequest): Promise<ExecuteRuleResponse> {
    return request<ExecuteRuleResponse>('/api/ai/rules/execute', {
      method: 'POST',
      body: JSON.stringify(requestData),
    })
  },

  async previewRule(requestData: ExecuteRuleRequest): Promise<PreviewRuleResponse> {
    return request<PreviewRuleResponse>('/api/ai/rules/preview', {
      method: 'POST',
      body: JSON.stringify(requestData),
    })
  },
}
