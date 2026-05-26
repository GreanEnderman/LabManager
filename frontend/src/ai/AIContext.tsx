import { createContext, useContext, useMemo, useState } from 'react'
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
  AIApprovalStatus,
  AIAssignee,
  AIEvent,
  AIReport,
  AIReportType,
  AITask,
  AITaskStatus,
} from './types'

/* eslint-disable react-refresh/only-export-components */

// Demo-only legacy mock state.
// Do not wire new product features to this provider.
// Production and pre-release runtime must go through AIStateLive + HTTP gateway.

interface CreateTaskInput {
  eventId: string
  assignee?: AIAssignee
}

interface AIContextValue {
  events: AIEvent[]
  tasks: AITask[]
  approvals: AIApproval[]
  reports: AIReport[]
  activityLogs: AIActivityLog[]
  createTaskFromEvent: (input: CreateTaskInput) => string
  assignTask: (taskId: string, assignee: AIAssignee) => void
  updateTaskStatus: (taskId: string, status: AITaskStatus) => void
  createApprovalForTask: (taskId: string) => void
  resolveApproval: (approvalId: string, status: Exclude<AIApprovalStatus, 'pending'>) => void
  generateReport: (type: AIReportType) => void
  getEventBySource: (sourceType: AIEvent['sourceType'], sourceId: string) => AIEvent | undefined
  getTaskBySource: (sourceType: AITask['sourceType'], sourceId: string) => AITask | undefined
}

const AIContext = createContext<AIContextValue | null>(null)

function timestamp() {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function defaultAssignee(event: AIEvent): AIAssignee {
  if (event.type === 'low_stock') {
    return '采购'
  }
  if (event.type === 'maintenance_overdue' || event.type === 'equipment_fault') {
    return '设备管理员'
  }
  return '实验室管理员'
}

function taskTitleFromEvent(event: AIEvent) {
  if (event.suggestedTaskType === 'chemical_purchase') {
    return `采购药品：${event.sourceName}`
  }
  if (event.suggestedTaskType === 'equipment_maintenance') {
    return `设备维护：${event.sourceName}`
  }
  if (event.suggestedTaskType === 'restock') {
    return `补货：${event.sourceName}`
  }
  if (event.suggestedTaskType === 'maintenance') {
    return `维护：${event.sourceName}`
  }
  if (event.suggestedTaskType === 'anomaly_review') {
    return `排查：${event.sourceName}`
  }
  return `处理：${event.sourceName}`
}

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [events] = useState(initialAIEvents)
  const [tasks, setTasks] = useState(initialAITasks)
  const [approvals, setApprovals] = useState(initialAIApprovals)
  const [reports, setReports] = useState(initialAIReports)
  const [activityLogs, setActivityLogs] = useState(initialAIActivityLogs)

  const addLog = useCallback((log: Omit<AIActivityLog, 'id' | 'timestamp'>) => {
    setActivityLogs((current) => [
      {
        id: createId('log'),
        timestamp: timestamp(),
        ...log,
      },
      ...current,
    ])
  }, [])

  const getTaskBySource = useCallback(
    (sourceType: AITask['sourceType'], sourceId: string) =>
      tasks.find((task) => task.sourceType === sourceType && task.sourceId === sourceId && task.status !== 'closed'),
    [tasks],
  )

  const getEventBySource = useCallback(
    (sourceType: AIEvent['sourceType'], sourceId: string) =>
      events.find((event) => event.sourceType === sourceType && event.sourceId === sourceId),
    [events],
  )

  const createTaskFromEvent = useCallback(({ eventId, assignee }: CreateTaskInput) => {
    const event = events.find((item) => item.id === eventId)
    if (!event) {
      return ''
    }

    const existingTask = getTaskBySource(event.sourceType, event.sourceId)
    if (existingTask) {
      addLog({
        action: '跳过重复任务',
        detail: `系统检测到 ${event.sourceName} 已存在未关闭任务，未重复创建。`,
        taskId: existingTask.id,
      })
      return existingTask.id
    }

    const taskId = createId('task')
    const now = timestamp()
    const nextTask: AITask = {
      id: taskId,
      type: event.suggestedTaskType,
      title: taskTitleFromEvent(event),
      summary: event.summary,
      status: 'open',
      priority: event.priority,
      riskLevel: event.riskLevel,
      assignee: assignee ?? defaultAssignee(event),
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      sourceName: event.sourceName,
      dueAt: '2026-04-18 18:00',
      createdAt: now,
      updatedAt: now,
      recommendation: `建议优先处理 ${event.sourceName}，并在完成后补充处理记录。`,
    }

    setTasks((current) => [nextTask, ...current])
    addLog({
      action: '创建任务',
      detail: `AI 员工根据事件“${event.title}”创建了任务。`,
      taskId,
    })
    return taskId
  }, [addLog, events, getTaskBySource])

  const assignTask = useCallback((taskId: string, assignee: AIAssignee) => {
    let taskTitle = ''
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) {
          return task
        }
        taskTitle = task.title
        return {
          ...task,
          assignee,
          updatedAt: timestamp(),
        }
      }),
    )
    addLog({
      action: '重新指派',
      detail: `任务“${taskTitle}”已重新分配给 ${assignee}。`,
      taskId,
    })
  }, [addLog])

  const updateTaskStatus = useCallback((taskId: string, status: AITaskStatus) => {
    let taskTitle = ''
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) {
          return task
        }
        taskTitle = task.title
        return {
          ...task,
          status,
          updatedAt: timestamp(),
        }
      }),
    )
    addLog({
      action: '更新任务状态',
      detail: `任务“${taskTitle}”状态已更新为 ${status}。`,
      taskId,
    })
  }, [addLog])

  const createApprovalForTask = useCallback((taskId: string) => {
    const task = tasks.find((item) => item.id === taskId)
    if (!task) {
      return
    }

    const existingApproval = approvals.find((approval) => approval.taskId === taskId && approval.status === 'pending')
    if (existingApproval) {
      addLog({
        action: '跳过重复审批',
        detail: `任务“${task.title}”已存在待审批记录。`,
        taskId,
        approvalId: existingApproval.id,
      })
      return
    }

    const approvalId = createId('approval')
    const now = timestamp()
    const nextApproval: AIApproval = {
      id: approvalId,
      taskId,
      title: `${task.title} 待审批`,
      reason: `任务“${task.title}”涉及${task.riskLevel === 'high' ? '高风险' : '中风险'}处理动作，需要人工审批确认。`,
      status: 'pending',
      riskLevel: task.riskLevel,
      createdAt: now,
      updatedAt: now,
    }

    setApprovals((current) => [nextApproval, ...current])
    updateTaskStatus(taskId, 'pending_approval')
    addLog({
      action: '发起审批',
      detail: `AI 员工为任务“${task.title}”发起了审批流程。`,
      taskId,
      approvalId,
    })
  }, [addLog, approvals, tasks, updateTaskStatus])

  const resolveApproval = useCallback((approvalId: string, status: Exclude<AIApprovalStatus, 'pending'>) => {
    const approval = approvals.find((item) => item.id === approvalId)
    if (!approval) {
      return
    }

    setApprovals((current) =>
      current.map((item) =>
        item.id === approvalId
          ? {
              ...item,
              status,
              updatedAt: timestamp(),
            }
          : item,
      ),
    )

    if (status === 'approved') {
      updateTaskStatus(approval.taskId, 'in_progress')
    }
    if (status === 'rejected') {
      updateTaskStatus(approval.taskId, 'open')
    }
    addLog({
      action: '处理审批',
      detail: `审批“${approval.title}”已更新为 ${status}。`,
      taskId: approval.taskId,
      approvalId,
    })
  }, [addLog, approvals, updateTaskStatus])

  const generateReport = useCallback((type: AIReportType) => {
    const report: AIReport = {
      id: createId('report'),
      type,
      title: type === 'daily' ? 'AI 员工自动日报' : 'AI 员工自动周报',
      createdAt: timestamp(),
      summary:
        type === 'daily'
          ? `当前共有 ${tasks.length} 个任务，待审批 ${approvals.filter((item) => item.status === 'pending').length} 项。`
          : `本周期累计处理 ${tasks.filter((item) => item.status === 'done' || item.status === 'closed').length} 个任务。`,
      highlights: [
        `风险事件 ${events.length} 条`,
        `进行中任务 ${tasks.filter((item) => item.status === 'in_progress').length} 个`,
        `待审批事项 ${approvals.filter((item) => item.status === 'pending').length} 项`,
      ],
    }
    setReports((current) => [report, ...current])
    addLog({
      action: '生成报告',
      detail: `AI 员工生成了${type === 'daily' ? '日报' : '周报'}。`,
    })
  }, [addLog, approvals, events, tasks])

  const value = useMemo(
    () => ({
      events,
      tasks,
      approvals,
      reports,
      activityLogs,
      createTaskFromEvent,
      assignTask,
      updateTaskStatus,
      createApprovalForTask,
      resolveApproval,
      generateReport,
      getEventBySource,
      getTaskBySource,
    }),
    [
      activityLogs,
      approvals,
      assignTask,
      createApprovalForTask,
      createTaskFromEvent,
      events,
      generateReport,
      getEventBySource,
      getTaskBySource,
      reports,
      resolveApproval,
      tasks,
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
