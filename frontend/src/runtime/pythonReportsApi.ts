/**
 * Python Backend API Client for Reports
 * Calls the Python FastAPI backend at port 8001
 */

const PYTHON_API_BASE = import.meta.env.VITE_PYTHON_API_BASE_URL || 'http://localhost:8001'

interface DailyReportRequest {
  date: string // ISO date format: "2026-05-01"
  operator: string
}

interface WeeklyReportRequest {
  start_date: string
  end_date: string
  operator: string
}

interface ReportTaskResponse {
  task_id: string
  status: string
  mode?: 'async' | 'sync'
  fallback_reason?: string
  result?: TaskStatusResponse['result']
  deliveryRecords?: Array<{ status?: 'success' | 'failed' }>
  deliveryStatus?: 'success' | 'failed'
}

interface TaskStatusResponse {
  task_id: string
  status: string
  state: string
  ready: boolean
  successful: boolean | null
  deliveryRecords?: Array<{ status?: 'success' | 'failed' }>
  deliveryStatus?: 'success' | 'failed'
  result: {
    date?: string
    start_date?: string
    end_date?: string
    task_completions: number
    approvals: number
    metrics: Record<string, number>
    daily_breakdown?: Array<{
      date: string
      task_completions: number
      approvals: number
      activities: number
    }>
    metadata: {
      operator: string
      timestamp: string
      run_id: string
    }
  } | null
}

interface ApiEnvelope<T> {
  data: T
  error: { code: string; message: string } | null
}

function unwrapEnvelope<T>(payload: T | ApiEnvelope<T>): T {
  if (payload && typeof payload === 'object' && 'data' in payload && 'error' in payload) {
    const envelope = payload as ApiEnvelope<T>
    if (envelope.error) {
      throw new Error(envelope.error.message)
    }
    return envelope.data
  }
  return payload as T
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${PYTHON_API_BASE}${path}`
  console.info('[Reports API] request', {
    method: options?.method || 'GET',
    path,
    url,
  })
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[Reports API] request failed', {
      path,
      status: response.status,
      error,
    })
    throw new Error(`Python API Error: ${response.status} - ${error}`)
  }

  const payload = await response.json()
  const data = unwrapEnvelope<T>(payload)
  console.info('[Reports API] response', {
    path,
    status: response.status,
    data,
  })
  return data
}

export const pythonReportsApi = {
  /**
   * Generate daily report
   */
  async generateDailyReport(date: string, operator: string): Promise<ReportTaskResponse> {
    console.info('[Reports API] generateDailyReport started', { date, operator })
    return request<ReportTaskResponse>('/api/ai/reports/daily', {
      method: 'POST',
      body: JSON.stringify({ date, operator } as DailyReportRequest),
    })
  },

  /**
   * Generate weekly report
   */
  async generateWeeklyReport(
    startDate: string,
    endDate: string,
    operator: string,
  ): Promise<ReportTaskResponse> {
    console.info('[Reports API] generateWeeklyReport started', { startDate, endDate, operator })
    return request<ReportTaskResponse>('/api/ai/reports/weekly', {
      method: 'POST',
      body: JSON.stringify({
        start_date: startDate,
        end_date: endDate,
        operator,
      } as WeeklyReportRequest),
    })
  },

  /**
   * Get task status and result
   */
  async getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    if (!taskId) {
      throw new Error('Report task id is missing')
    }
    return request<TaskStatusResponse>(`/api/ai/reports/tasks/${taskId}`)
  },

  /**
   * Poll task until completion (with timeout)
   */
  async pollTaskUntilComplete(
    taskId: string,
    maxAttempts = 30,
    intervalMs = 2000,
  ): Promise<TaskStatusResponse> {
    if (!taskId) {
      throw new Error('Report task id is missing')
    }

    for (let i = 0; i < maxAttempts; i++) {
      console.info('[Reports API] polling task status', {
        taskId,
        attempt: i + 1,
        maxAttempts,
      })
      const status = await this.getTaskStatus(taskId)
      console.info('[Reports API] poll result', {
        taskId,
        attempt: i + 1,
        status: status.status,
        state: status.state,
        ready: status.ready,
        successful: status.successful,
        hasResult: Boolean(status.result),
      })

      if (status.ready) {
        return status
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    throw new Error(`Task ${taskId} did not complete within timeout`)
  },
}
