import { useMemo, useState } from 'react'
import { useRole } from '../auth/RoleContext'
import { useAI } from '../ai/AIStateLive'
import { approvalStatusClass, approvalStatusLabel } from '../ai/labels'

export default function AIApprovals() {
  const { can } = useRole()
  const { approvals, tasks, events, activityLogs, resolveApproval } = useAI()
  const canProcessApprovals = can('approvals:write')
  const pendingApprovals = useMemo(() => approvals.filter((item) => item.status === 'pending'), [approvals])
  const [selectedApprovalId, setSelectedApprovalId] = useState<string>(approvals[0]?.id ?? '')
  const [draftComments, setDraftComments] = useState<Record<string, string>>({})

  const selectedApproval = approvals.find((approval) => approval.id === selectedApprovalId) ?? approvals[0]
  const relatedTask = tasks.find((item) => item.id === selectedApproval?.taskId)
  const relatedEvent =
    selectedApproval && relatedTask
      ? events.find(
          (event) => event.sourceType === relatedTask.sourceType && event.sourceId === relatedTask.sourceId,
        )
      : undefined
  const relatedLogs = activityLogs.filter(
    (log) => log.approvalId === selectedApproval?.id || log.taskId === relatedTask?.id,
  )

  const updateComment = (approvalId: string, value: string) => {
    setDraftComments((current) => ({ ...current, [approvalId]: value }))
  }

  const submitApproval = (approvalId: string, status: 'approved' | 'rejected' | 'needs_info') => {
    resolveApproval(approvalId, status, draftComments[approvalId])
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">AI 审批台</h1>
        </div>
        <div className="rounded-lg bg-tertiary-container px-4 py-3 text-sm text-on-tertiary-container">
          待审批 {pendingApprovals.length} 项
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface">
          <div className="border-b border-outline-variant bg-surface-container-high px-6 py-4">
            <h2 className="text-lg font-semibold text-on-surface">审批队列</h2>
          </div>
          <div className="divide-y divide-outline-variant">
            {approvals.map((approval) => {
              const task = tasks.find((item) => item.id === approval.taskId)
              return (
                <button
                  key={approval.id}
                  onClick={() => setSelectedApprovalId(approval.id)}
                  className={`w-full px-6 py-4 text-left transition-colors hover:bg-surface-container-low ${
                    selectedApproval?.id === approval.id ? 'bg-surface-container-low' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-on-surface">{approval.title}</p>
                      <p className="mt-1 text-sm text-on-surface-variant">{task?.title ?? approval.reason}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs ${approvalStatusClass[approval.status]}`}>
                      {approvalStatusLabel[approval.status]}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-lg border border-outline-variant bg-surface p-6">
          {selectedApproval ? (
            <>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-on-surface">{selectedApproval.title}</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">{selectedApproval.reason}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm ${approvalStatusClass[selectedApproval.status]}`}>
                  {approvalStatusLabel[selectedApproval.status]}
                </span>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <InfoCard label="关联任务" value={relatedTask?.title ?? '-'} />
                <InfoCard label="风险等级" value={selectedApproval.riskLevel} />
                <InfoCard label="发起时间" value={selectedApproval.createdAt} />
                <InfoCard label="任务状态" value={relatedTask?.status ?? '-'} />
              </div>

              {relatedEvent && (
                <div className="mb-4 rounded-lg bg-surface-container-low p-4">
                  <p className="mb-2 text-sm font-medium text-on-surface">审批触发依据</p>
                  <p className="text-sm text-on-surface">{relatedEvent.title}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{relatedEvent.summary}</p>
                </div>
              )}

              <div className="mb-4 rounded-lg bg-primary-container p-4 text-sm text-on-primary-container">
                AI 建议：该事项需要人工确认后再继续推进，以避免误操作影响库存或设备状态。
              </div>

              {canProcessApprovals ? (
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-on-surface">审批意见</label>
                  <textarea
                    value={draftComments[selectedApproval.id] ?? selectedApproval.comment ?? ''}
                    onChange={(event) => updateComment(selectedApproval.id, event.target.value)}
                    rows={4}
                    placeholder="填写批准、驳回或补充信息的原因..."
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              ) : (
                <div className="mb-4 rounded-lg bg-surface-container-low p-4 text-sm text-on-surface-variant">
                  当前为普通成员视角，仅可查看审批记录，不能填写或处理审批意见。
                </div>
              )}

              {selectedApproval.status === 'pending' && canProcessApprovals && (
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <button
                    onClick={() => submitApproval(selectedApproval.id, 'approved')}
                    className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary"
                  >
                    批准并继续
                  </button>
                  <button
                    onClick={() => submitApproval(selectedApproval.id, 'rejected')}
                    className="rounded-lg bg-error px-4 py-2 text-sm text-on-error"
                  >
                    驳回退回任务
                  </button>
                  <button
                    onClick={() => submitApproval(selectedApproval.id, 'needs_info')}
                    className="rounded-lg bg-surface-container-high px-4 py-2 text-sm text-on-surface"
                  >
                    要求补充信息
                  </button>
                </div>
              )}

              {selectedApproval.comment && (
                <div className="mb-4 rounded-lg bg-surface-container-low p-4 text-sm text-on-surface-variant">
                  当前审批意见：{selectedApproval.comment}
                </div>
              )}

              <div>
                <p className="mb-2 text-sm font-medium text-on-surface">审批活动日志</p>
                <div className="space-y-2">
                  {relatedLogs.map((log) => (
                    <div key={log.id} className="rounded-lg bg-surface-container-low p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-on-surface">{log.action}</p>
                        <span className="text-xs text-on-surface-variant">{log.timestamp}</span>
                      </div>
                      <p className="mt-1 text-on-surface-variant">{log.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-on-surface-variant">暂无可展示的审批项。</p>
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
