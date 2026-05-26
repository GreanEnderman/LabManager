/**
 * Dashboard API Client
 * Fetches real-time dashboard statistics from Python backend
 */

const PYTHON_API_BASE = import.meta.env.VITE_PYTHON_API_BASE_URL || 'http://localhost:8001'

export interface DashboardStats {
  chemicalCount: number
  lowStockCount: number
  inboundCount: number
  outboundCount: number
  equipmentCount: number
  overdueEquipmentCount: number
}

export interface AIWorkflowStats {
  eventCount: number
  openTaskCount: number
  pendingApprovalCount: number
  reportCount: number
  highPriorityTaskCount: number
}

export interface DashboardOverview {
  inventory: DashboardStats
  aiWorkflow: AIWorkflowStats
  timestamp: string
}

export interface LowStockChemical {
  id: string
  name: string
  totalQuantity: number
  threshold?: number
  image?: string | null
}

export interface RecentMaintenance {
  id: string
  name: string
  lastMaintenanceAt: string | null
  status: string
  image?: string | null
}

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
    throw new Error(`Dashboard API Error: ${response.status} - ${error}`)
  }

  return response.json()
}

export const dashboardApi = {
  /**
   * Get dashboard overview statistics
   */
  async getOverview(): Promise<DashboardOverview> {
    return request<DashboardOverview>('/dashboard/overview')
  },

  /**
   * Get low stock chemicals for dashboard display
   */
  async getLowStockChemicals(limit = 4): Promise<{ data: LowStockChemical[] }> {
    return request<{ data: LowStockChemical[] }>(`/dashboard/low-stock-chemicals?limit=${limit}`)
  },

  /**
   * Get recent maintenance records for dashboard display
   */
  async getRecentMaintenance(limit = 4): Promise<{ data: RecentMaintenance[] }> {
    return request<{ data: RecentMaintenance[] }>(`/dashboard/recent-maintenance?limit=${limit}`)
  },
}
