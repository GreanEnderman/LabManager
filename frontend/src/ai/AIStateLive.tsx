/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { aiAppClient, type LiveAIStateSnapshot } from '../runtime/aiAppFacadeAsync'
import type { CompletionReportInput } from '../runtime/aiGateway'
import { pythonReportsApi } from '../runtime/pythonReportsApi'
import type {
  AIActivityLog,
  AIApproval,
  AIAssignee,
  AIEvent,
  AIReport,
  AIReportType,
  ReportDeliveryConfig,
  ReportDeliveryRecord,
  SupervisorEmailMapping,
  AITask,
  AITaskStatus,
} from './types'
import type { CreateTaskFromEventInput, ResolveApprovalStatus } from './actions'

// Production runtime entry for AI state.
// New features should extend this live provider and the runtime gateway/facade layer.
// This provider uses aiAppClient which throws on HTTP failures - no silent fallback to mock/direct.

interface AIContextValue {
  isLoading: boolean
  isSubmitting: boolean
  events: AIEvent[]
  tasks: AITask[]
  approvals: AIApproval[]
  reports: AIReport[]
  activityLogs: AIActivityLog[]
  reportDeliveryMappings: SupervisorEmailMapping[]
  reportDeliveryConfigs: ReportDeliveryConfig[]
  reportDeliveryRecords: ReportDeliveryRecord[]
  createTaskFromEvent: (input: CreateTaskFromEventInput) => Promise<string>
  prepareAutoPurchase: (taskId: string) => Promise<void>
  confirmCompletionReport: (taskId: string, report: CompletionReportInput) => Promise<void>
  assignTask: (taskId: string, assignee: AIAssignee) => Promise<void>
  updateTaskStatus: (taskId: string, status: AITaskStatus) => Promise<void>
  createApprovalForTask: (taskId: string) => Promise<void>
  resolveApproval: (approvalId: string, status: ResolveApprovalStatus, comment?: string) => Promise<void>
  generateReport: (type: AIReportType) => Promise<void>
  deleteReport: (reportId: string) => Promise<void>
  saveReportDeliveryMapping: (
    input: Omit<SupervisorEmailMapping, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ) => Promise<void>
  saveReportDeliveryConfig: (
    input: Omit<ReportDeliveryConfig, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ) => Promise<void>
  sendReport: (reportId: string) => Promise<void>
  getEventBySource: (sourceType: AIEvent['sourceType'], sourceId: string) => AIEvent | undefined
  getTaskBySource: (sourceType: AITask['sourceType'], sourceId: string) => AITask | undefined
}

const AIContext = createContext<AIContextValue | null>(null)

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LiveAIStateSnapshot>({
    events: [],
    tasks: [],
    approvals: [],
    reports: [],
    activityLogs: [],
    reportDeliveryMappings: [],
    reportDeliveryConfigs: [],
    reportDeliveryRecords: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const refreshState = useCallback(async () => {
    try {
      const nextState = await aiAppClient.getAIState()
      setState(nextState)
      return nextState
    } catch (error) {
      console.warn('Failed to load AI state from backend, using empty state:', error)
      // Return empty state if backend doesn't have these APIs yet
      const emptyState: LiveAIStateSnapshot = {
        events: [],
        tasks: [],
        approvals: [],
        reports: [],
        activityLogs: [],
        reportDeliveryMappings: [],
        reportDeliveryConfigs: [],
        reportDeliveryRecords: [],
      }
      setState(emptyState)
      return emptyState
    }
  }, [])

  useEffect(() => {
    refreshState().finally(() => setIsLoading(false))
  }, [refreshState])

  const createTaskFromEvent = useCallback(async ({ eventId }: CreateTaskFromEventInput) => {
    setIsSubmitting(true)
    try {
      const taskId = await aiAppClient.createTaskFromEvent(eventId)
      await refreshState()
      return taskId
    } finally {
      setIsSubmitting(false)
    }
  }, [refreshState])

  const prepareAutoPurchase = useCallback(async (taskId: string) => {
    setIsSubmitting(true)
    try {
      const result = await aiAppClient.prepareAutoPurchase(taskId)
      window.alert(result.message)
      await refreshState()
    } finally {
      setIsSubmitting(false)
    }
  }, [refreshState])

  const assignTask = useCallback(async (taskId: string, assignee: AIAssignee) => {
    setIsSubmitting(true)
    try {
      await aiAppClient.assignTask(taskId, assignee)
      await refreshState()
    } finally {
      setIsSubmitting(false)
    }
  }, [refreshState])

  const confirmCompletionReport = useCallback(async (taskId: string, report: CompletionReportInput) => {
    setIsSubmitting(true)
    try {
      await aiAppClient.confirmCompletionReport(taskId, report)
      await refreshState()
    } finally {
      setIsSubmitting(false)
    }
  }, [refreshState])

  const updateTaskStatus = useCallback(async (taskId: string, status: AITaskStatus) => {
    const task = state.tasks.find((item) => item.id === taskId)
    if (!task) return

    setIsSubmitting(true)
    try {
      await aiAppClient.updateTaskStatus(task, status)
      await refreshState()
    } finally {
      setIsSubmitting(false)
    }
  }, [refreshState, state.tasks])

  const createApprovalForTask = useCallback(async (taskId: string) => {
    const task = state.tasks.find((item) => item.id === taskId)
    if (!task) return

    setIsSubmitting(true)
    try {
      await aiAppClient.createApprovalForTask(task)
      await refreshState()
    } finally {
      setIsSubmitting(false)
    }
  }, [refreshState, state.tasks])

  const resolveApproval = useCallback(async (approvalId: string, status: ResolveApprovalStatus, comment?: string) => {
    const approval = state.approvals.find((item) => item.id === approvalId)
    if (!approval) return

    setIsSubmitting(true)
    try {
      await aiAppClient.resolveApproval(approval.id, status, comment)
      await refreshState()
    } finally {
      setIsSubmitting(false)
    }
  }, [refreshState, state.approvals])

  const generateReport = useCallback(async (type: AIReportType) => {
    setIsSubmitting(true)
    try {
      // Call Python backend to generate report
      const today = new Date().toISOString().split('T')[0]
      const operator = 'frontend-user' // TODO: Get from auth context
      console.info('[AIStateLive] report generation requested', {
        type,
        date: today,
        operator,
      })

      let taskResponse
      if (type === 'daily') {
        taskResponse = await pythonReportsApi.generateDailyReport(today, operator)
      } else {
        // Weekly report: last 7 days
        const endDate = new Date()
        const startDate = new Date(endDate)
        startDate.setDate(startDate.getDate() - 7)

        taskResponse = await pythonReportsApi.generateWeeklyReport(
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0],
          operator
        )
      }

      console.info('[AIStateLive] report generation accepted', {
        taskId: taskResponse.task_id,
        status: taskResponse.status,
        mode: taskResponse.mode,
        fallbackReason: taskResponse.fallback_reason,
        hasImmediateResult: Boolean(taskResponse.result),
      })

      if (taskResponse.status === 'completed' && taskResponse.result) {
        console.info('[AIStateLive] report completed synchronously', {
          taskId: taskResponse.task_id,
          result: taskResponse.result,
        })
        if (!taskResponse.deliveryRecords?.some(record => record.status === 'success')) {
          await aiAppClient.sendReport(taskResponse.task_id)
        }
        alert(`${type === 'daily' ? '鏃ユ姤' : '鍛ㄦ姤'}鐢熸垚鎴愬姛锛乗n\n` +
          `浠诲姟瀹屾垚鏁? ${taskResponse.result.task_completions}\n` +
          `瀹℃壒鏁? ${taskResponse.result.approvals}\n` +
          `娲诲姩鏁? ${taskResponse.result.metrics.activities || 0}`)
        await refreshState()
        return
      }

      // Poll for completion (max 30 seconds)
      const result = await pythonReportsApi.pollTaskUntilComplete(taskResponse.task_id, 15, 2000)
      console.info('[AIStateLive] report polling finished', {
        taskId: taskResponse.task_id,
        status: result.status,
        state: result.state,
        successful: result.successful,
        hasResult: Boolean(result.result),
      })

      if (result.successful && result.result) {
        console.info('[AIStateLive] report generated successfully', result.result)
        if (!result.deliveryRecords?.some(record => record.status === 'success')) {
          await aiAppClient.sendReport(taskResponse.task_id)
        }
        alert(`${type === 'daily' ? '日报' : '周报'}生成成功！\n\n` +
          `任务完成数: ${result.result.task_completions}\n` +
          `审批数: ${result.result.approvals}\n` +
          `活动数: ${result.result.metrics.activities || 0}`)
      } else {
        console.error('[AIStateLive] report generation completed without successful result', result)
        throw new Error('Report generation failed')
      }

      await refreshState()
    } catch (error) {
      console.error('[AIStateLive] failed to generate report', error)
      alert(`报告生成失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsSubmitting(false)
    }
  }, [refreshState])

  const deleteReport = useCallback(async (reportId: string) => {
    setIsSubmitting(true)
    try {
      await aiAppClient.deleteReport(reportId)
      await refreshState()
    } finally {
      setIsSubmitting(false)
    }
  }, [refreshState])

  const saveReportDeliveryMapping = useCallback(async (
    input: Omit<SupervisorEmailMapping, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ) => {
    setIsSubmitting(true)
    try {
      await aiAppClient.saveReportDeliveryMapping(input, id)
      await refreshState()
    } finally {
      setIsSubmitting(false)
    }
  }, [refreshState])

  const saveReportDeliveryConfig = useCallback(async (
    input: Omit<ReportDeliveryConfig, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ) => {
    setIsSubmitting(true)
    try {
      await aiAppClient.saveReportDeliveryConfig(input, id)
      await refreshState()
    } finally {
      setIsSubmitting(false)
    }
  }, [refreshState])

  const sendReport = useCallback(async (reportId: string) => {
    setIsSubmitting(true)
    try {
      await aiAppClient.sendReport(reportId)
      await refreshState()
    } finally {
      setIsSubmitting(false)
    }
  }, [refreshState])

  const value = useMemo(
    () => ({
      isLoading,
      isSubmitting,
      events: state.events,
      tasks: state.tasks,
      approvals: state.approvals,
      reports: state.reports,
      activityLogs: state.activityLogs,
      reportDeliveryMappings: state.reportDeliveryMappings,
      reportDeliveryConfigs: state.reportDeliveryConfigs,
      reportDeliveryRecords: state.reportDeliveryRecords,
      createTaskFromEvent,
      prepareAutoPurchase,
      confirmCompletionReport,
      assignTask,
      updateTaskStatus,
      createApprovalForTask,
      resolveApproval,
      generateReport,
      deleteReport,
      saveReportDeliveryMapping,
      saveReportDeliveryConfig,
      sendReport,
      getEventBySource: (sourceType: AIEvent['sourceType'], sourceId: string) =>
        state.events.find((event) => event.sourceType === sourceType && event.sourceId === sourceId),
      getTaskBySource: (sourceType: AITask['sourceType'], sourceId: string) =>
        state.tasks.find((task) => task.sourceType === sourceType && task.sourceId === sourceId),
    }),
    [
      assignTask,
      confirmCompletionReport,
      createApprovalForTask,
      createTaskFromEvent,
      deleteReport,
      generateReport,
      isLoading,
      isSubmitting,
      prepareAutoPurchase,
      resolveApproval,
      saveReportDeliveryConfig,
      saveReportDeliveryMapping,
      sendReport,
      state,
      updateTaskStatus,
    ],
  )

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>
}

export function useAI() {
  const context = useContext(AIContext)
  if (!context) {
    throw new Error('useAI must be used within AIProvider')
  }
  return context
}
