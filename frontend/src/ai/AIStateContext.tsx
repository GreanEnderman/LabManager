import { createContext, useContext, useMemo, useReducer } from 'react'
import { useCallback } from 'react'
import {
  initialAIActivityLogs,
  initialAIApprovals,
  initialAIEvents,
  initialAIReports,
  initialAITasks,
} from '../mock/ai'
import type {
  AIActivityLog,
  AIApproval,
  AIAssignee,
  AIEvent,
  AIReport,
  AIReportType,
  AITask,
  AITaskStatus,
} from './types'
import {
  type AIState,
  type CreateTaskFromEventInput,
  type ResolveApprovalStatus,
  aiReducer,
  createInitialAIState,
} from './actions'
import {
  buildActivityLog,
  buildApprovalForTask,
  buildReport,
  buildTaskFromEvent,
  getApprovalById,
  getEventBySource as findEventBySource,
  getTaskById,
  getTaskBySource as findTaskBySource,
  resolveApprovalState,
  updateTaskAssignment,
  updateTaskState,
} from './domain'

/* eslint-disable react-refresh/only-export-components */

// Demo-only legacy mock state.
// Do not wire new product features to this provider.
// Production and pre-release runtime must go through AIStateLive + HTTP gateway.

interface AIContextValue {
  events: AIEvent[]
  tasks: AITask[]
  approvals: AIApproval[]
  reports: AIReport[]
  activityLogs: AIActivityLog[]
  createTaskFromEvent: (input: CreateTaskFromEventInput) => string
  assignTask: (taskId: string, assignee: AIAssignee) => void
  updateTaskStatus: (taskId: string, status: AITaskStatus) => void
  createApprovalForTask: (taskId: string) => void
  resolveApproval: (approvalId: string, status: ResolveApprovalStatus, comment?: string) => void
  generateReport: (type: AIReportType) => void
  getEventBySource: (sourceType: AIEvent['sourceType'], sourceId: string) => AIEvent | undefined
  getTaskBySource: (sourceType: AITask['sourceType'], sourceId: string) => AITask | undefined
}

const AIContext = createContext<AIContextValue | null>(null)

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(
    aiReducer,
    createInitialAIState({
      events: initialAIEvents,
      tasks: initialAITasks,
      approvals: initialAIApprovals,
      reports: initialAIReports,
      activityLogs: initialAIActivityLogs,
    }),
  )

  const createTaskFromEvent = useCallback(({ eventId, assignee }: CreateTaskFromEventInput) => {
    const event = state.events.find((item) => item.id === eventId)
    if (!event) return ''

    const existingTask = findTaskBySource(state.tasks, event.sourceType, event.sourceId)
    if (existingTask) {
      dispatch({
        type: 'add_log',
        payload: buildActivityLog({
          action: '跳过重复任务',
          detail: `系统检测到 ${event.sourceName} 已存在未关闭任务，未重复创建。`,
          actorType: 'system',
          actorName: '任务判重规则',
          taskId: existingTask.id,
        }),
      })
      return existingTask.id
    }

    const nextTask = buildTaskFromEvent(event, assignee)
    dispatch({ type: 'add_task', payload: nextTask })
    dispatch({
      type: 'add_log',
      payload: buildActivityLog({
        action: '创建任务',
        detail: `AI 员工根据事件“${event.title}”创建了任务。`,
        taskId: nextTask.id,
      }),
    })
    return nextTask.id
  }, [state.events, state.tasks])

  const assignTask = useCallback((taskId: string, assignee: AIAssignee) => {
    const task = getTaskById(state.tasks, taskId)
    if (!task) return

    dispatch({ type: 'replace_task', payload: updateTaskAssignment(task, assignee) })
    dispatch({
      type: 'add_log',
      payload: buildActivityLog({
        action: '重新指派',
        detail: `任务“${task.title}”已重新分配给 ${assignee}。`,
        actorType: 'user',
        actorName: '任务中心',
        taskId,
      }),
    })
  }, [state.tasks])

  const updateTaskStatus = useCallback((taskId: string, status: AITaskStatus) => {
    const task = getTaskById(state.tasks, taskId)
    if (!task) return

    dispatch({ type: 'replace_task', payload: updateTaskState(task, status) })
    dispatch({
      type: 'add_log',
      payload: buildActivityLog({
        action: '更新任务状态',
        detail: `任务“${task.title}”状态已更新为 ${status}。`,
        actorType: 'user',
        actorName: '任务中心',
        taskId,
      }),
    })
  }, [state.tasks])

  const createApprovalForTask = useCallback((taskId: string) => {
    const task = getTaskById(state.tasks, taskId)
    if (!task) return

    const existingApproval = state.approvals.find(
      (approval) => approval.taskId === taskId && approval.status === 'pending',
    )
    if (existingApproval) {
      dispatch({
        type: 'add_log',
        payload: buildActivityLog({
          action: '跳过重复审批',
          detail: `任务“${task.title}”已有待审批记录，无需重复发起。`,
          actorType: 'system',
          actorName: '审批规则',
          taskId,
          approvalId: existingApproval.id,
        }),
      })
      return
    }

    const nextApproval = buildApprovalForTask(task)
    dispatch({ type: 'add_approval', payload: nextApproval })
    dispatch({ type: 'replace_task', payload: updateTaskState(task, 'pending_approval') })
    dispatch({
      type: 'add_log',
      payload: buildActivityLog({
        action: '发起审批',
        detail: `AI 员工为任务“${task.title}”发起了审批流程。`,
        taskId,
        approvalId: nextApproval.id,
      }),
    })
  }, [state.approvals, state.tasks])

  const resolveApproval = useCallback((approvalId: string, status: ResolveApprovalStatus, comment?: string) => {
    const approval = getApprovalById(state.approvals, approvalId)
    if (!approval) return

    dispatch({ type: 'replace_approval', payload: resolveApprovalState(approval, status, comment) })

    const task = getTaskById(state.tasks, approval.taskId)
    if (task && status === 'approved') {
      dispatch({ type: 'replace_task', payload: updateTaskState(task, 'in_progress') })
    }
    if (task && (status === 'rejected' || status === 'needs_info')) {
      dispatch({ type: 'replace_task', payload: updateTaskState(task, 'open') })
    }

    dispatch({
      type: 'add_log',
      payload: buildActivityLog({
        action: '处理审批',
        detail: comment?.trim()
          ? `审批“${approval.title}”已更新为 ${status}，审批意见：${comment.trim()}。`
          : `审批“${approval.title}”已更新为 ${status}。`,
        actorType: 'user',
        actorName: '审批人',
        taskId: approval.taskId,
        approvalId,
      }),
    })
  }, [state.approvals, state.tasks])

  const generateReport = useCallback((type: AIReportType) => {
    const report = buildReport(state as AIState, type)
    dispatch({ type: 'add_report', payload: report })
    dispatch({
      type: 'add_log',
      payload: buildActivityLog({
        action: '生成报告',
        detail: `AI 员工生成了${type === 'daily' ? '日报' : type === 'weekly' ? '周报' : '风险专题摘要'}。`,
      }),
    })
  }, [state])

  const value = useMemo(
    () => ({
      events: state.events,
      tasks: state.tasks,
      approvals: state.approvals,
      reports: state.reports,
      activityLogs: state.activityLogs,
      createTaskFromEvent,
      assignTask,
      updateTaskStatus,
      createApprovalForTask,
      resolveApproval,
      generateReport,
      getEventBySource: (sourceType: AIEvent['sourceType'], sourceId: string) =>
        findEventBySource(state.events, sourceType, sourceId),
      getTaskBySource: (sourceType: AITask['sourceType'], sourceId: string) =>
        findTaskBySource(state.tasks, sourceType, sourceId),
    }),
    [
      assignTask,
      createApprovalForTask,
      createTaskFromEvent,
      generateReport,
      resolveApproval,
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
