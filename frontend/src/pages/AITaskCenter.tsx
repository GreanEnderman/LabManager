import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useRole } from '../auth/RoleContext'
import { useAI } from '../ai/AIStateLive'
import {
  approvalStatusClass,
  approvalStatusLabel,
  statusPillBaseClass,
  taskStatusClass,
  taskStatusLabel,
} from '../ai/labels'
import type { AIAssignee, AITaskStatus } from '../ai/types'

const assignees: AIAssignee[] = ['库管', '采购', '设备管理员', '实验室管理员', 'AI 员工']

export default function AITaskCenter() {
  const { can } = useRole()
  const { events, tasks, approvals, activityLogs, assignTask, updateTaskStatus, createApprovalForTask } = useAI()
  const canManageTasks = can('tasks:write')
  const canCreateApproval = can('approvals:write')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<'全部状态' | AITaskStatus>('全部状态')
  const [selectedTaskId, setSelectedTaskId] = useState<string>(tasks[0]?.id ?? '')

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const matchedKeyword =
          keyword.trim() === '' ||
          task.title.includes(keyword.trim()) ||
          task.sourceName.includes(keyword.trim())
        const matchedStatus = status === '全部状态' || task.status === status
        return matchedKeyword && matchedStatus
      }),
    [tasks, keyword, status],
  )

  const selectedTask = filteredTasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0]
  const relatedEvent = selectedTask
    ? events.find((event) => event.sourceType === selectedTask.sourceType && event.sourceId === selectedTask.sourceId)
    : undefined
  const selectedLogs = activityLogs.filter((log) => log.taskId === selectedTask?.id)
  const selectedApprovals = approvals.filter((approval) => approval.taskId === selectedTask?.id)

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">AI 任务中心</h1>
        </div>
        <div className="rounded-lg bg-primary-container px-4 py-3 text-sm text-on-primary-container">
          当前任务数：{tasks.length}
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-outline-variant bg-surface p-4">
        <div className="flex gap-4">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索任务名称或来源对象..."
            className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as '全部状态' | AITaskStatus)}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2"
          >
            <option value="全部状态">全部状态</option>
            <option value="open">待处理</option>
            <option value="in_progress">处理中</option>
            <option value="pending_approval">待审批</option>
            <option value="done">已完成</option>
            <option value="closed">已关闭</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-[1fr,1.5fr] gap-6">
        <section className="rounded-lg border border-outline-variant bg-surface p-6">
          <div className="mb-4 flex items-center gap-3 border-b border-outline-variant pb-3">
            <button className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary">全部</button>
            <button className="rounded-lg px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low">
              待处理
            </button>
            <button className="rounded-lg px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low">
              处理中
            </button>
          </div>
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={`w-full rounded-lg border p-4 text-left transition-colors hover:border-primary ${
                  selectedTask?.id === task.id
                    ? 'border-primary bg-primary-container'
                    : 'border-outline-variant bg-surface'
                }`}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-on-surface">{task.title}</h3>
                  <span className={`${statusPillBaseClass} shrink-0 text-xs ${taskStatusClass[task.status]}`}>
                    {taskStatusLabel[task.status]}
                  </span>
                </div>
                <p className="mb-2 text-sm text-on-surface-variant">{task.createdAt}</p>
                <p className="text-sm text-on-surface-variant">{task.summary}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-outline-variant bg-surface p-6">
          {selectedTask ? (
            <>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold text-on-surface">{selectedTask.title}</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">{selectedTask.summary}</p>
                </div>
                <span className={`${statusPillBaseClass} shrink-0 self-start ${taskStatusClass[selectedTask.status]}`}>
                  {taskStatusLabel[selectedTask.status]}
                </span>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <InfoCard label="来源对象" value={selectedTask.sourceName} />
                <InfoCard label="风险等级" value={selectedTask.riskLevel} />
                <InfoCard label="截止时间" value={selectedTask.dueAt} />
                <InfoCard label="当前责任人" value={selectedTask.assignee} />
                <InfoCard label="任务类型" value={selectedTask.type} />
                <InfoCard label="创建时间" value={selectedTask.createdAt} />
                <InfoCard label="来源类型" value={selectedTask.sourceType} />
                <InfoCard label="审批要求" value={selectedTask.requiresApproval ? '需要审批' : '无需审批'} />
              </div>

              {relatedEvent && (
                <div className="mb-4 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                  <p className="mb-2 text-sm font-medium text-on-surface">触发依据</p>
                  <p className="text-sm text-on-surface">{relatedEvent.title}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{relatedEvent.summary}</p>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    事件时间：{relatedEvent.createdAt} · 优先级：{relatedEvent.priority}
                  </p>
                </div>
              )}

              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-on-surface">AI 建议动作</p>
                <div className="rounded-lg bg-primary-container p-4 text-sm text-on-primary-container">
                  {selectedTask.recommendation}
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-on-surface">证据与来源</p>
                <div className="rounded-lg bg-surface-container-low p-4">
                  <ul className="space-y-2 text-sm text-on-surface-variant">
                    {(selectedTask.evidence ?? relatedEvent?.evidence ?? []).length > 0 ? (
                      (selectedTask.evidence ?? relatedEvent?.evidence ?? []).map((evidence) => (
                        <li key={evidence}>• {evidence}</li>
                      ))
                    ) : (
                      <li>• 当前任务暂无补充证据，建议在处理过程中补充现场记录。</li>
                    )}
                  </ul>
                </div>
              </div>

              {canManageTasks ? (
                <div className="mb-4 grid gap-3">
                  <select
                    value={selectedTask.assignee}
                    onChange={(event) => assignTask(selectedTask.id, event.target.value as AIAssignee)}
                    className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2"
                  >
                    {assignees.map((assignee) => (
                      <option key={assignee} value={assignee}>
                        指派给：{assignee}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => updateTaskStatus(selectedTask.id, 'in_progress')}
                      className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary"
                    >
                      开始处理
                    </button>
                    <button
                      onClick={() => updateTaskStatus(selectedTask.id, 'done')}
                      className="rounded-lg bg-secondary-container px-4 py-2 text-sm text-on-secondary-container"
                    >
                      标记完成
                    </button>
                    {canCreateApproval ? (
                      <button
                        onClick={() => createApprovalForTask(selectedTask.id)}
                        className="rounded-lg bg-tertiary-container px-4 py-2 text-sm text-on-tertiary-container"
                      >
                        发起审批
                      </button>
                    ) : (
                      <div className="rounded-lg bg-surface-container-high px-4 py-2 text-sm text-on-surface">
                        当前角色不可发起审批
                      </div>
                    )}
                    <button
                      onClick={() => updateTaskStatus(selectedTask.id, 'closed')}
                      className="rounded-lg bg-surface-container-high px-4 py-2 text-sm text-on-surface"
                    >
                      关闭任务
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mb-4 rounded-lg bg-surface-container-low p-4 text-sm text-on-surface-variant">
                  当前为普通成员视角，可查看任务详情与处理轨迹，但不可执行指派、审批和状态更新操作。
                </div>
              )}

              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-on-surface">审批记录</p>
                  <Link to="/ai-approvals" className="text-sm text-primary">
                    前往审批台
                  </Link>
                </div>
                <div className="space-y-2">
                  {selectedApprovals.length > 0 ? (
                    selectedApprovals.map((approval) => (
                      <div key={approval.id} className="rounded-lg bg-surface-container-low p-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-on-surface">{approval.title}</p>
                          <span className={`rounded-full px-3 py-1 text-xs ${approvalStatusClass[approval.status]}`}>
                            {approvalStatusLabel[approval.status]}
                          </span>
                        </div>
                        <p className="mt-1 text-on-surface-variant">{approval.reason}</p>
                        <p className="mt-2 text-xs text-on-surface-variant">
                          发起时间：{approval.createdAt}
                          {approval.comment ? ` · 审批意见：${approval.comment}` : ''}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg bg-surface-container-low p-4 text-sm text-on-surface-variant">
                      当前没有待审批记录
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-on-surface">活动日志</p>
                <div className="space-y-2">
                  {selectedLogs.map((log) => (
                    <div key={log.id} className="rounded-lg bg-surface-container-low p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-on-surface">{log.action}</p>
                        <span className="text-xs text-on-surface-variant">{log.timestamp}</span>
                      </div>
                      <p className="mt-1 text-on-surface-variant">{log.detail}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">操作方：{log.actorName ?? 'AI 员工'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-on-surface-variant">暂无可展示的任务。</p>
          )}
        </section>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-container-low p-4">
      <p className="text-xs text-on-surface-variant">{label}</p>
      <p className="mt-1 font-medium text-on-surface">{value}</p>
    </div>
  )
}
