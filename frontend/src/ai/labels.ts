import type { AIApprovalStatus, AITaskStatus } from './types'

export const taskStatusLabel: Record<AITaskStatus, string> = {
  open: '未批准',
  in_progress: '未批准',
  pending_approval: '待审批',
  done: '已完成',
  closed: '已关闭',
}

export const taskStatusClass: Record<AITaskStatus, string> = {
  open: 'bg-surface-container text-on-surface',
  in_progress: 'bg-primary-container text-on-primary-container',
  pending_approval: 'bg-tertiary-container text-on-tertiary-container',
  done: 'bg-secondary-container text-on-secondary-container',
  closed: 'bg-surface-container-low text-on-surface-variant',
}

export const approvalStatusLabel: Record<AIApprovalStatus, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已驳回',
  needs_info: '待补充信息',
}

export const approvalStatusClass: Record<AIApprovalStatus, string> = {
  pending: 'bg-tertiary-container text-on-tertiary-container',
  approved: 'bg-secondary-container text-on-secondary-container',
  rejected: 'bg-error-container text-error',
  needs_info: 'bg-surface-container text-on-surface',
}

export const statusPillBaseClass =
  'inline-flex min-h-10 min-w-[9rem] items-center justify-center rounded-full px-4 py-2 text-sm font-medium leading-none whitespace-nowrap'
