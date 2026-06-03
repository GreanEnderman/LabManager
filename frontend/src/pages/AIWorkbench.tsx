import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useRole } from '../auth/RoleContext'
import { useAI } from '../ai/AIStateLive'
import { useAISettingsRuntime } from '../ai/AISettingsRuntimeLive'
import { getAIOverviewStats, getTaskSLAView } from '../ai/selectors'
import { aiAppClient } from '../runtime/aiAppFacadeAsync'
import { formatLocalDateTime } from '../runtime/dateTime'
import type { CompletionReportInput } from '../runtime/aiGateway'
import type {
  AIActivityLog,
  AIAnalysisSummary,
  AIApproval,
  AIApprovalStatus,
  AIAssignee,
  AIEvent,
  AIReport,
  AISLAStatus,
  AITask,
  AITaskStatus,
} from '../ai/types'

type WorkbenchTab = 'tasks' | 'approvals' | 'reports' | 'analysis'

const tabs: Array<{ key: WorkbenchTab; label: string; icon: string }> = [
  { key: 'tasks', label: '\u4efb\u52a1', icon: 'task' },
  { key: 'approvals', label: '\u5ba1\u6279', icon: 'approval' },
  { key: 'reports', label: '\u62a5\u544a', icon: 'summarize' },
  { key: 'analysis', label: '\u5206\u6790', icon: 'insights' },
]

const assignees: AIAssignee[] = [
  '库管',
  '采购',
  '设备管理员',
  '实验室管理员',
  'AI 员工',
]

const taskStatusMeta: Record<AITaskStatus, { label: string; className: string }> = {
  open: { label: '未批准', className: 'bg-error-container text-error' },
  in_progress: { label: '未批准', className: 'bg-error-container text-error' },
  pending_approval: { label: '\u5f85\u5ba1\u6279', className: 'bg-tertiary-container text-on-tertiary-container' },
  done: { label: '\u5df2\u5b8c\u6210', className: 'bg-secondary-container text-on-secondary-container' },
  closed: { label: '\u5df2\u5173\u95ed', className: 'bg-surface-container-low text-on-surface-variant' },
}

const taskTypeLabel: Record<AITask['type'], string> = {
  chemical_purchase: '采购药品',
  equipment_maintenance: '设备维护',
  equipment_repair: '设备维修',
  restock: '采购药品',
  maintenance: '设备维护',
  anomaly_review: '设备维护',
  data_fix: '数据修正',
  report: '报告生成',
}

const priorityLabel: Record<string, string> = {
  P0: '最高优先级',
  P1: '高优先级',
  P2: '普通优先级',
  low: '低优先级',
  medium: '中优先级',
  high: '高优先级',
  urgent: '紧急',
}

const riskLevelLabel: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  critical: '严重风险',
}

const assigneeLabel: Record<string, string> = {
  'equipment-manager': '设备管理员',
  'warehouse-manager': '库管',
  'lab-manager': '实验室管理员',
  'ai-operator': 'AI 员工',
  'AI Employee': 'AI 员工',
}

const taskTitleLabel: Record<string, string> = {
  'Maintenance overdue': '设备维护逾期',
  'Low stock detected': '库存不足',
  'Equipment fault detected': '设备故障',
}

function translateTaskText(text: string): string {
  if (taskTitleLabel[text]) {
    return taskTitleLabel[text]
  }
  if (text === 'Review stock and prepare a restock request.') {
    return '检查库存并准备补货申请。'
  }
  if (text === 'Review stock and prepare a restock request') {
    return '检查库存并准备补货申请。'
  }
  if (text === 'Schedule maintenance and confirm equipment availability.') {
    return '安排设备维护，并确认设备可用状态。'
  }
  if (text === 'Equipment status requires review.') {
    return '设备状态需要复核。'
  }
  const maintenanceMatch = text.match(/^Last maintenance is older than (\d+) days\.?$/)
  if (maintenanceMatch) {
    return `上次维护已超过 ${maintenanceMatch[1]} 天`
  }
  const slaReminderMatch = text.match(/^Task (.+) exceeded SLA by (\d+) minutes and requires reminder\.$/)
  if (slaReminderMatch) {
    return `任务 ${slaReminderMatch[1]} 已超过 SLA ${slaReminderMatch[2]} 分钟，需要发送催办。`
  }
  const lowStockMatch = text.match(/^Current quantity (.+) is below or equal to threshold (.+)\.?$/)
  if (lowStockMatch) {
    return `当前库存 ${lowStockMatch[1]} 已低于或等于阈值 ${lowStockMatch[2]}`
  }
  const lowStockBelowMatch = text.match(/^Current quantity (.+) is below threshold (.+)\.$/)
  if (lowStockBelowMatch) {
    return `当前库存 ${lowStockBelowMatch[1]} 已低于阈值 ${lowStockBelowMatch[2]}。`
  }
  const lowStockDetectedMatch = text.match(/^Low stock detected$/)
  if (lowStockDetectedMatch) {
    return '库存不足'
  }
  const approvalTitleMatch = text.match(/^(.+) approval$/)
  if (approvalTitleMatch) {
    return `${translateTaskText(approvalTitleMatch[1])}审批`
  }
  if (text === 'High-risk event requires supervisor approval.') {
    return '该事项需要人工确认后再继续推进。'
  }
  return text
}

function getAssigneeLabel(value: string | null | undefined) {
  if (!value) {
    return '未分配'
  }
  return assigneeLabel[value] ?? value
}

function getPriorityLabel(value: string) {
  return priorityLabel[value] ?? value
}

function getRiskLevelLabel(value: string) {
  return riskLevelLabel[value] ?? value
}

function isChemicalPurchaseTask(task: AITask) {
  return task.type === 'chemical_purchase' || task.type === 'restock'
}

function getAutoPurchaseStatus(task: AITask) {
  const autoPurchase = task.metadata?.autoPurchase
  if (!autoPurchase || typeof autoPurchase !== 'object') {
    return '未触发'
  }
  const status = String((autoPurchase as Record<string, unknown>).status ?? '')
  if (status === 'submitted') {
    return '采购请求已提交'
  }
  if (status === 'reserved') {
    return '接口已预留'
  }
  return status || '未触发'
}

function getTaskMetadataRecord(task: AITask, key: string) {
  const value = task.metadata?.[key]
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function getAutoPurchaseDetail(task: AITask) {
  return getTaskMetadataRecord(task, 'autoPurchase')
}

function getCompletionReportDetail(task: AITask) {
  return getTaskMetadataRecord(task, 'completionReport')
}

function isEquipmentServiceTask(task: AITask) {
  return task.type === 'equipment_maintenance' || task.type === 'equipment_repair' || task.type === 'maintenance' || task.type === 'anomaly_review'
}

function downloadBase64File(fileName: string, mimeType: string, contentBase64: string) {
  const link = document.createElement('a')
  link.href = `data:${mimeType};base64,${contentBase64}`
  link.download = fileName
  link.click()
}

const approvalStatusMeta: Record<AIApprovalStatus, { label: string; className: string }> = {
  pending: { label: '\u5f85\u5ba1\u6279', className: 'bg-tertiary-container text-on-tertiary-container' },
  approved: { label: '\u5df2\u6279\u51c6', className: 'bg-secondary-container text-on-secondary-container' },
  rejected: { label: '\u5df2\u9a73\u56de', className: 'bg-error-container text-error' },
  needs_info: { label: '\u5f85\u8865\u5145\u4fe1\u606f', className: 'bg-surface-container text-on-surface' },
}

function getWorkbenchSummary(
  activeTab: WorkbenchTab,
  overview: ReturnType<typeof getAIOverviewStats>,
  approvals: AIApproval[],
  reports: AIReport[],
) {
  switch (activeTab) {
    case 'tasks':
      return {
        title: '\u4efb\u52a1\u63a8\u8fdb\u6982\u51b5',
        cards: [
          { label: '未批准', value: `${overview.openTaskCount}`, tone: 'primary' as const },
          { label: '\u5df2\u8d85\u65f6', value: `${overview.overdueTaskCount}`, tone: 'plain' as const },
          { label: '\u5df2\u5347\u7ea7', value: `${overview.escalatedTaskCount}`, tone: 'plain' as const },
        ],
      }
    case 'approvals':
      return {
        title: '\u5ba1\u6279\u95e8\u7981\u6982\u51b5',
        cards: [
          { label: '\u5f85\u5ba1\u6279', value: `${overview.pendingApprovalCount}`, tone: 'primary' as const },
          { label: '\u5df2\u6279\u51c6', value: `${approvals.filter((item) => item.status === 'approved').length}`, tone: 'plain' as const },
          { label: '\u5f85\u8865\u5145', value: `${approvals.filter((item) => item.status === 'needs_info').length}`, tone: 'plain' as const },
        ],
      }
    case 'reports':
      return {
        title: '\u62a5\u544a\u6c89\u6dc0\u6982\u51b5',
        cards: [
          { label: '\u62a5\u544a\u603b\u6570', value: `${overview.reportCount}`, tone: 'primary' as const },
          { label: '\u65e5\u62a5', value: `${reports.filter((item) => item.type === 'daily').length}`, tone: 'plain' as const },
          { label: '\u5468\u62a5', value: `${reports.filter((item) => item.type === 'weekly').length}`, tone: 'plain' as const },
        ],
      }
    case 'analysis':
      return {
        title: '\u5206\u6790\u89c6\u89d2\u6982\u51b5',
        cards: [
          { label: '\u98ce\u9669\u4e8b\u4ef6', value: `${overview.eventCount}`, tone: 'primary' as const },
          { label: '\u5f85\u5ba1\u6279', value: `${overview.pendingApprovalCount}`, tone: 'plain' as const },
          { label: '\u6570\u636e\u6765\u6e90', value: '\u5b9e\u65f6', tone: 'plain' as const },
        ],
      }
    default:
      return {
        title: '\u4efb\u52a1\u63a8\u8fdb\u6982\u51b5',
        cards: [
          { label: '未批准', value: `${overview.openTaskCount}`, tone: 'primary' as const },
          { label: '\u8d85\u65f6\u4efb\u52a1', value: `${overview.overdueTaskCount}`, tone: 'plain' as const },
          { label: '\u5df2\u5347\u7ea7', value: `${overview.escalatedTaskCount}`, tone: 'plain' as const },
        ],
      }
  }
}

function getValidTab(value: string | null): WorkbenchTab {
  if (value === 'tasks' || value === 'approvals' || value === 'reports' || value === 'analysis') {
    return value
  }
  return 'tasks'
}

interface TasksTabProps {
  tasks: AITask[]
  events: AIEvent[]
  approvals: AIApproval[]
  activityLogs: AIActivityLog[]
  canManageTasks: boolean
  assignTask: (taskId: string, assignee: AIAssignee) => void
  prepareAutoPurchase: (taskId: string) => void
  getTaskSLAStatusLabel: (task: AITask) => string
}

interface ApprovalsTabProps {
  approvals: AIApproval[]
  tasks: AITask[]
  selectedApproval?: AIApproval
  selectedApprovalTask?: AITask
  selectedApprovalEvent?: AIEvent
  selectedApprovalLogs: AIActivityLog[]
  canProcessApprovals: boolean
  confirmCompletionReport: (taskId: string, report: CompletionReportInput) => void | Promise<void>
  draftComments: Record<string, string>
  setDraftComments: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setSelectedApprovalId: (approvalId: string) => void
  resolveApproval: (approvalId: string, status: Exclude<AIApprovalStatus, 'pending'>, comment?: string) => void | Promise<void>
  jumpToTask: (taskId: string) => void
}

interface ReportsTabProps {
  reports: AIReport[]
  generateReport: (type: 'daily' | 'weekly' | 'risk_summary') => void
  deleteReport: (reportId: string) => Promise<void>
  sendReport: (reportId: string) => void
  reportDeliveryRecords: Array<{
    id: string
    reportId: string
    status: 'success' | 'failed'
    recipientName: string
    recipientEmail: string
    errorMessage: string | null
    sentAt: string
  }>
}

export default function AIWorkbench() {
  const { can } = useRole()
  const canManageTasks = can('tasks:write')
  const canProcessApprovals = can('approvals:write')
  const { settings } = useAISettingsRuntime()
  const {
    events,
    tasks,
    approvals,
    reports,
    activityLogs,
    assignTask,
    prepareAutoPurchase,
    confirmCompletionReport,
    resolveApproval,
    generateReport,
    deleteReport,
    sendReport,
    reportDeliveryRecords,
  } = useAI()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedApprovalId, setSelectedApprovalId] = useState<string>(approvals[0]?.id ?? '')
  const [draftComments, setDraftComments] = useState<Record<string, string>>({})

  const activeTab = getValidTab(searchParams.get('tab'))
  const overview = getAIOverviewStats(tasks, approvals, events, reports)
  const workbenchSummary = getWorkbenchSummary(activeTab, overview, approvals, reports)

  const selectedApproval = approvals.find((approval) => approval.id === selectedApprovalId) ?? approvals[0]
  const selectedApprovalTask = tasks.find((task) => task.id === selectedApproval?.taskId)
  const selectedApprovalEvent =
    selectedApproval && selectedApprovalTask
      ? events.find(
          (event) =>
            event.sourceType === selectedApprovalTask.sourceType && event.sourceId === selectedApprovalTask.sourceId,
        )
      : undefined
  const selectedApprovalLogs = activityLogs.filter(
    (log) => log.approvalId === selectedApproval?.id || log.taskId === selectedApprovalTask?.id,
  )

  const switchTab = (tab: WorkbenchTab) => {
    setSearchParams({ tab })
  }

  const getTaskSLAStatusLabel = (task: AITask) => getTaskSLAView(task, settings).label
  const jumpToTask = () => {
    switchTab('tasks')
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary-container px-4 py-2 text-sm text-on-primary-container">
            <span className="material-symbols-outlined text-base">smart_toy</span>
            {'AI \u5de5\u4f5c\u53f0'}
          </div>
          <h1 className="text-3xl font-bold text-on-surface">
            {'\u7edf\u4e00\u5904\u7406 AI \u53d1\u73b0\u3001\u4efb\u52a1\u3001\u5ba1\u6279\u3001\u62a5\u544a\u4e0e\u5206\u6790'}
          </h1>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={() => generateReport('daily')} className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary">
            {'\u751f\u6210\u65e5\u62a5'}
          </button>
          <button
            onClick={() => generateReport('weekly')}
            className="rounded-lg bg-secondary-container px-4 py-2 text-sm text-on-secondary-container"
          >
            {'\u751f\u6210\u5468\u62a5'}
          </button>
          <button
            onClick={() => generateReport('risk_summary')}
            className="rounded-lg bg-tertiary-container px-4 py-2 text-sm text-on-tertiary-container"
          >
            {'\u751f\u6210\u98ce\u9669\u4e13\u9898'}
          </button>
          <Link to="/dashboard" className="rounded-lg bg-surface-container-high px-4 py-2 text-sm text-on-surface">
            {'\u67e5\u770b\u89d2\u843d\u9884\u8b66'}
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
        <StatCard title={'\u4eca\u65e5\u4e8b\u4ef6'} value={String(overview.eventCount)} icon="crisis_alert" />
        <StatCard title="未批准任务" value={String(overview.openTaskCount)} icon="task" />
        <StatCard title={'\u8d85\u65f6\u4efb\u52a1'} value={String(overview.overdueTaskCount)} icon="schedule" />
        <StatCard title={'\u5df2\u5347\u7ea7'} value={String(overview.escalatedTaskCount)} icon="warning" />
        <StatCard title={'\u5f85\u5ba1\u6279'} value={String(overview.pendingApprovalCount)} icon="approval" />
        <StatCard title={'\u9ad8\u4f18\u4efb\u52a1'} value={String(overview.highPriorityTaskCount)} icon="priority_high" />
        <StatCard title={'\u5df2\u6c89\u6dc0\u62a5\u544a'} value={String(overview.reportCount)} icon="description" />
      </div>

      <div className="mb-6 space-y-3">
        <section>
          <div className="mb-3 flex justify-end">
            <div className="rounded-xl bg-surface-container-low px-4 py-2 text-sm text-on-surface-variant">
              {`\u5f53\u524d\u4f4d\u4e8e\uff1a${tabs.find((tab) => tab.key === activeTab)?.label ?? '\u4efb\u52a1'}`}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => switchTab(tab.key)}
                  className={`inline-flex h-10 min-w-[8rem] flex-row items-center gap-2 rounded-xl px-4 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                  <span className="font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        <div className="grid gap-2 sm:grid-cols-3">
          {workbenchSummary.cards.map((card) => (
            <div
              key={card.label}
              className={`flex min-h-16 flex-col rounded-xl px-4 py-3 ${
                card.tone === 'primary'
                  ? 'bg-primary-container text-on-primary-container'
                  : 'bg-surface-container-low text-on-surface'
              }`}
            >
              <p
                className={`text-xs leading-5 ${
                  card.tone === 'primary' ? 'text-on-primary-container/80' : 'text-on-surface-variant'
                }`}
              >
                {card.label}
              </p>
              <p className="text-2xl font-semibold leading-7">{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      {activeTab === 'tasks' && (
        <TasksTab
          tasks={tasks}
          events={events}
          approvals={approvals}
          activityLogs={activityLogs}
          canManageTasks={canManageTasks}
          assignTask={assignTask}
          prepareAutoPurchase={prepareAutoPurchase}
          getTaskSLAStatusLabel={getTaskSLAStatusLabel}
        />
      )}

      {activeTab === 'approvals' && (
        <ApprovalsTab
          approvals={approvals}
          tasks={tasks}
          selectedApproval={selectedApproval}
          selectedApprovalTask={selectedApprovalTask}
          selectedApprovalEvent={selectedApprovalEvent}
          selectedApprovalLogs={selectedApprovalLogs}
          canProcessApprovals={canProcessApprovals}
          confirmCompletionReport={confirmCompletionReport}
          draftComments={draftComments}
          setDraftComments={setDraftComments}
          setSelectedApprovalId={setSelectedApprovalId}
          resolveApproval={resolveApproval}
          jumpToTask={jumpToTask}
        />
      )}

      {activeTab === 'reports' && (
        <ReportsTab
          reports={reports}
          generateReport={generateReport}
          deleteReport={deleteReport}
          sendReport={sendReport}
          reportDeliveryRecords={reportDeliveryRecords}
        />
      )}

      {activeTab === 'analysis' && <AnalysisTab />}
    </div>
  )
}

function TasksTab({
  tasks,
  events,
  approvals,
  activityLogs,
  canManageTasks,
  assignTask,
  prepareAutoPurchase,
  getTaskSLAStatusLabel,
}: TasksTabProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | AITaskStatus | AISLAStatus>('all')
  const [selectedTaskId, setSelectedTaskId] = useState<string>(tasks[0]?.id ?? '')

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (statusFilter === 'all') {
          return true
        }
        if (statusFilter === 'overdue' || statusFilter === 'escalated') {
          return task.slaStatus === statusFilter || getTaskSLAStatusLabel(task) === (statusFilter === 'overdue' ? '已超时' : '已升级')
        }
        return task.status === statusFilter
      }),
    [tasks, statusFilter, getTaskSLAStatusLabel],
  )
  const selectedTask = filteredTasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0]
  const selectedTaskEvent = selectedTask
    ? events.find((event) => event.sourceType === selectedTask.sourceType && event.sourceId === selectedTask.sourceId)
    : undefined
  const selectedTaskLogs = activityLogs.filter((log) => log.taskId === selectedTask?.id)
  const selectedTaskApprovals = approvals.filter((approval) => approval.taskId === selectedTask?.id)
  const selectedCompletionReport = selectedTask ? getCompletionReportDetail(selectedTask) : null
  const selectedAutoPurchase = selectedTask ? getAutoPurchaseDetail(selectedTask) : null

  const filters: Array<{ value: 'all' | AITaskStatus | AISLAStatus; label: string }> = [
    { value: 'all', label: '全部' },
    { value: 'open', label: '未批准' },
    { value: 'pending_approval', label: '待审批' },
    { value: 'overdue', label: '已超时' },
    { value: 'escalated', label: '已升级' },
  ]

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-outline-variant bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-on-surface">任务中心</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setStatusFilter('open')} className="rounded-xl bg-primary px-4 py-3 text-sm text-on-primary">
              查看未批准
            </button>
            <button
              onClick={() => setStatusFilter('overdue')}
              className="rounded-xl bg-surface-container-high px-4 py-3 text-sm text-on-surface"
            >
              查看超时
            </button>
            <button
              onClick={() => setStatusFilter('escalated')}
              className="rounded-xl bg-tertiary-container px-4 py-3 text-sm text-on-tertiary-container"
            >
              查看升级
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface">
          <div className="border-b border-outline-variant p-4">
            <div className="flex flex-wrap gap-3">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={`rounded-full px-4 py-2 text-sm ${
                    statusFilter === filter.value ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-outline-variant">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`w-full px-6 py-4 text-left transition-colors hover:bg-surface-container-low ${
                    selectedTask?.id === task.id ? 'bg-surface-container-low' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-on-surface">{translateTaskText(task.title)}</p>
                      <p className="mt-1 text-sm text-on-surface-variant">{task.sourceName}</p>
                    </div>
                    <StatusPill label={taskStatusMeta[task.status].label} className={taskStatusMeta[task.status].className} />
                  </div>
                  <p className="mt-2 text-sm text-on-surface-variant">{translateTaskText(task.summary)}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-on-surface-variant">
                    <span className="rounded-full bg-surface-container px-3 py-1">{taskTypeLabel[task.type]}</span>
                    <span className="rounded-full bg-surface-container px-3 py-1">{getPriorityLabel(task.priority)}</span>
                    <span className="rounded-full bg-surface-container px-3 py-1">{getAssigneeLabel(task.assignee)}</span>
                    <span className="rounded-full bg-surface-container px-3 py-1">{getTaskSLAStatusLabel(task)}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-6">
                <div className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                  当前筛选下暂无任务。
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-outline-variant bg-surface p-6">
          {selectedTask ? (
            <>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-on-surface">{translateTaskText(selectedTask.title)}</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">{translateTaskText(selectedTask.summary)}</p>
                </div>
                <SLAPill task={selectedTask} getTaskSLAStatusLabel={getTaskSLAStatusLabel} />
              </div>

              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <InfoCard label="来源对象" value={selectedTask.sourceName} />
                <InfoCard label="风险等级" value={getRiskLevelLabel(selectedTask.riskLevel)} />
                <InfoCard label="优先级" value={getPriorityLabel(selectedTask.priority)} />
                <InfoCard label="截止时间" value={formatLocalDateTime(selectedTask.dueAt)} />
                <InfoCard label="任务类型" value={taskTypeLabel[selectedTask.type]} />
                <InfoCard label="创建时间" value={formatLocalDateTime(selectedTask.createdAt)} />
              </div>

              {isChemicalPurchaseTask(selectedTask) ? (
                <div className="mb-4 rounded-xl border border-dashed border-primary/40 bg-primary-container/30 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-on-surface">采购执行</p>
                      <div className="mt-2 space-y-1 text-xs text-on-surface-variant">
                        <p>{`状态：${getAutoPurchaseStatus(selectedTask)}`}</p>
                        <p>{`采购请求：${String(selectedAutoPurchase?.purchaseRequestId ?? '-')}`}</p>
                        <p>{String(selectedAutoPurchase?.message ?? '等待审批通过后执行采购。')}</p>
                      </div>
                    </div>
                    {canManageTasks ? (
                      <button
                        onClick={() => prepareAutoPurchase(selectedTask.id)}
                        className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm text-on-primary"
                      >
                        查看/同步采购状态
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {isEquipmentServiceTask(selectedTask) ? (
                <div className="mb-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-on-surface">维护/维修报告</p>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        {selectedCompletionReport
                          ? `已提交：${String(selectedCompletionReport.reportTitle ?? selectedCompletionReport.report_title ?? '-')}`
                          : '提交报告后系统会确认任务完成，并回写设备维护或维修状态。'}
                      </p>
                      {selectedCompletionReport ? (
                        <p className="mt-2 text-xs text-on-surface-variant">
                          {`处理结果：${String(selectedCompletionReport.result ?? '-')}；工程师：${String(selectedCompletionReport.engineerName ?? selectedCompletionReport.engineer_name ?? '-')}`}
                        </p>
                      ) : null}
                    </div>
                    <StatusPill
                      label={selectedCompletionReport ? '已确认完成' : '待上传报告'}
                      className={selectedCompletionReport ? 'bg-secondary-container text-secondary' : 'bg-tertiary-container text-on-tertiary-container'}
                    />
                  </div>

                  {!selectedCompletionReport ? (
                    <p className="mt-3 text-xs text-on-surface-variant">
                      报告上传已收敛到审批队列处理，提交后系统会自动完成关联任务。
                    </p>
                  ) : null}
                </div>
              ) : null}

              {canManageTasks ? (
                <div className="mb-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
                  <label className="text-sm font-medium text-on-surface" htmlFor="task-assignee">
                    当前责任人
                  </label>
                  <select
                    id="task-assignee"
                    value={selectedTask.assignee}
                    onChange={(event) => assignTask(selectedTask.id, event.target.value as AIAssignee)}
                    className="mt-2 w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm"
                  >
                    {assignees.map((assignee) => (
                      <option key={assignee} value={assignee}>
                        {assignee}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="mb-4 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface">
                {translateTaskText(selectedTask.recommendation)}
              </div>

              {selectedTaskEvent ? (
                <div className="mb-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
                  <p className="font-medium text-on-surface">触发依据</p>
                  <p className="mt-2 text-sm text-on-surface">{translateTaskText(selectedTaskEvent.title)}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{translateTaskText(selectedTaskEvent.summary)}</p>
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
                  <p className="font-medium text-on-surface">关联审批</p>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    {selectedTaskApprovals.length > 0 ? `${selectedTaskApprovals.length} 条审批记录` : '暂无关联审批记录。'}
                  </p>
                </div>
                {selectedTaskLogs.slice(0, 3).map((log) => (
                  <div key={log.id} className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-on-surface">{log.action}</p>
                      <span className="text-xs text-on-surface-variant">{formatLocalDateTime(log.timestamp)}</span>
                    </div>
                    <p className="mt-2 text-sm text-on-surface-variant">{translateTaskText(log.detail)}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
              暂无可查看的任务。
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ApprovalsTab({
  approvals,
  tasks,
  selectedApproval,
  selectedApprovalTask,
  selectedApprovalEvent,
  selectedApprovalLogs,
  canProcessApprovals,
  confirmCompletionReport,
  draftComments,
  setDraftComments,
  setSelectedApprovalId,
  resolveApproval,
  jumpToTask,
}: ApprovalsTabProps) {
  const [completionReportDrafts, setCompletionReportDrafts] = useState<Record<string, CompletionReportInput>>({})
  const selectedCompletionReport = selectedApprovalTask ? getCompletionReportDetail(selectedApprovalTask) : null
  const selectedAutoPurchase = selectedApprovalTask ? getAutoPurchaseDetail(selectedApprovalTask) : null
  const completionReportDraft = selectedApprovalTask
    ? completionReportDrafts[selectedApprovalTask.id] ?? {
        reportTitle: `${taskTypeLabel[selectedApprovalTask.type]}报告 - ${selectedApprovalTask.sourceName}`,
        engineerName: '',
        description: '',
        result: 'completed',
        nextMaintenanceAt: '',
        reportFileName: '',
        reportStorageUrl: '',
      }
    : null

  const submitCompletionReport = async () => {
    if (!selectedApproval || !selectedApprovalTask || !completionReportDraft) {
      return
    }
    await confirmCompletionReport(selectedApprovalTask.id, completionReportDraft)
    await resolveApproval(selectedApproval.id, 'approved', draftComments[selectedApproval.id] || '维修/维护报告已上传，系统自动确认任务完成。')
    setCompletionReportDrafts((current) => {
      const next = { ...current }
      delete next[selectedApprovalTask.id]
      return next
    })
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr,1.1fr]">
      <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface">
        <div className="border-b border-outline-variant bg-surface-container-high px-6 py-4">
          <h2 className="text-lg font-semibold text-on-surface">{'\u5ba1\u6279\u961f\u5217'}</h2>
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
                    <p className="font-medium text-on-surface">{translateTaskText(approval.title)}</p>
                    <p className="mt-1 text-sm text-on-surface-variant">{task ? translateTaskText(task.title) : translateTaskText(approval.reason)}</p>
                  </div>
                  <StatusPill
                    label={approvalStatusMeta[approval.status].label}
                    className={approvalStatusMeta[approval.status].className}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-outline-variant bg-surface p-6">
        {selectedApproval ? (
          <>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-on-surface">{translateTaskText(selectedApproval.title)}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">{translateTaskText(selectedApproval.reason)}</p>
              </div>
              <StatusPill
                label={approvalStatusMeta[selectedApproval.status].label}
                className={approvalStatusMeta[selectedApproval.status].className}
              />
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <InfoCard label={'\u5173\u8054\u4efb\u52a1'} value={selectedApprovalTask ? translateTaskText(selectedApprovalTask.title) : '-'} />
              <InfoCard label={'\u98ce\u9669\u7b49\u7ea7'} value={getRiskLevelLabel(selectedApproval.riskLevel)} />
              <InfoCard label={'\u53d1\u8d77\u65f6\u95f4'} value={formatLocalDateTime(selectedApproval.createdAt)} />
              <InfoCard label={'\u4efb\u52a1\u72b6\u6001'} value={selectedApprovalTask ? taskStatusMeta[selectedApprovalTask.status].label : '-'} />
            </div>

            {selectedApprovalTask ? (
              <button
                onClick={() => jumpToTask(selectedApprovalTask.id)}
                className="mb-4 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-left text-sm text-on-surface transition-colors hover:bg-surface-container"
              >
                {`\u67e5\u770b\u5173\u8054\u4efb\u52a1\uff1a${translateTaskText(selectedApprovalTask.title)}`}
              </button>
            ) : null}

            {selectedApprovalEvent && (
              <div className="mb-4 rounded-xl bg-surface-container-low p-4">
                <p className="mb-2 text-sm font-medium text-on-surface">{'\u5ba1\u6279\u89e6\u53d1\u4f9d\u636e'}</p>
                <p className="text-sm text-on-surface">{translateTaskText(selectedApprovalEvent.title)}</p>
                <p className="mt-1 text-sm text-on-surface-variant">{translateTaskText(selectedApprovalEvent.summary)}</p>
              </div>
            )}

            {selectedApprovalTask && isChemicalPurchaseTask(selectedApprovalTask) ? (
              <div className="mb-4 rounded-xl border border-dashed border-primary/40 bg-primary-container/30 p-4">
                <p className="font-medium text-on-surface">采购动作批准</p>
                <div className="mt-2 space-y-1 text-sm text-on-surface-variant">
                  <p>{`采购对象：${selectedApprovalTask.sourceName}`}</p>
                  <p>{`执行状态：${getAutoPurchaseStatus(selectedApprovalTask)}`}</p>
                  <p>{`采购请求：${String(selectedAutoPurchase?.purchaseRequestId ?? '-')}`}</p>
                  <p>批准后系统会自动提交采购请求，并把关联任务标记为已完成。</p>
                </div>
              </div>
            ) : null}

            {selectedApprovalTask && isEquipmentServiceTask(selectedApprovalTask) ? (
              <div className="mb-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-on-surface">维修/维护报告上传</p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {selectedCompletionReport
                        ? `已提交：${String(selectedCompletionReport.reportTitle ?? selectedCompletionReport.report_title ?? '-')}`
                        : '上传报告后系统会自动回写设备状态，并完成关联任务。'}
                    </p>
                  </div>
                  <StatusPill
                    label={selectedCompletionReport ? '已确认完成' : '待上传报告'}
                    className={selectedCompletionReport ? 'bg-secondary-container text-secondary' : 'bg-tertiary-container text-on-tertiary-container'}
                  />
                </div>

                {selectedApproval.status === 'pending' && canProcessApprovals && completionReportDraft && !selectedCompletionReport ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="text-sm text-on-surface">
                      报告标题
                      <input
                        value={completionReportDraft.reportTitle}
                        onChange={(event) =>
                          setCompletionReportDrafts((current) => ({
                            ...current,
                            [selectedApprovalTask.id]: { ...completionReportDraft, reportTitle: event.target.value },
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm"
                      />
                    </label>
                    <label className="text-sm text-on-surface">
                      处理人
                      <input
                        value={completionReportDraft.engineerName ?? ''}
                        onChange={(event) =>
                          setCompletionReportDrafts((current) => ({
                            ...current,
                            [selectedApprovalTask.id]: { ...completionReportDraft, engineerName: event.target.value },
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm"
                      />
                    </label>
                    <label className="text-sm text-on-surface">
                      报告文件名
                      <input
                        value={completionReportDraft.reportFileName ?? ''}
                        onChange={(event) =>
                          setCompletionReportDrafts((current) => ({
                            ...current,
                            [selectedApprovalTask.id]: { ...completionReportDraft, reportFileName: event.target.value },
                          }))
                        }
                        placeholder="maintenance-report.pdf"
                        className="mt-2 w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm"
                      />
                    </label>
                    <label className="text-sm text-on-surface">
                      下次维护时间
                      <input
                        type="date"
                        value={completionReportDraft.nextMaintenanceAt ?? ''}
                        onChange={(event) =>
                          setCompletionReportDrafts((current) => ({
                            ...current,
                            [selectedApprovalTask.id]: { ...completionReportDraft, nextMaintenanceAt: event.target.value },
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm"
                      />
                    </label>
                    <label className="md:col-span-2 text-sm text-on-surface">
                      处理摘要
                      <textarea
                        value={completionReportDraft.description ?? ''}
                        onChange={(event) =>
                          setCompletionReportDrafts((current) => ({
                            ...current,
                            [selectedApprovalTask.id]: { ...completionReportDraft, description: event.target.value },
                          }))
                        }
                        rows={3}
                        className="mt-2 w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm"
                      />
                    </label>
                    <div className="md:col-span-2 flex justify-end">
                      <button
                        onClick={submitCompletionReport}
                        className="rounded-xl bg-primary px-4 py-3 text-sm text-on-primary"
                      >
                        上传报告并完成审批
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mb-4 rounded-xl bg-primary-container p-4 text-sm text-on-primary-container">
              {'AI \u5efa\u8bae\uff1a\u8be5\u4e8b\u9879\u9700\u8981\u4eba\u5de5\u786e\u8ba4\u540e\u518d\u7ee7\u7eed\u63a8\u8fdb\uff0c\u4ee5\u786e\u4fdd\u9ad8\u98ce\u9669\u52a8\u4f5c\u53ef\u8ffd\u8e2a\u3001\u53ef\u5ba1\u8ba1\u3001\u53ef\u56de\u6eaf\u3002'}
            </div>

            {canProcessApprovals ? (
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-on-surface">{'\u5ba1\u6279\u610f\u89c1'}</label>
                <textarea
                  value={draftComments[selectedApproval.id] ?? selectedApproval.comment ?? ''}
                  onChange={(event) =>
                    setDraftComments((current) => ({ ...current, [selectedApproval.id]: event.target.value }))
                  }
                  rows={4}
                  placeholder={'\u586b\u5199\u6279\u51c6\u3001\u9a73\u56de\u6216\u8865\u5145\u4fe1\u606f\u539f\u56e0...'}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-sm"
                />
              </div>
            ) : (
              <div className="mb-4 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                {'\u5f53\u524d\u4e3a\u666e\u901a\u6210\u5458\u89c6\u89d2\uff0c\u4ec5\u53ef\u67e5\u770b\u5ba1\u6279\u8bb0\u5f55\uff0c\u4e0d\u80fd\u5904\u7406\u5ba1\u6279\u3002'}
              </div>
            )}

            {selectedApproval.status === 'pending' && canProcessApprovals && (
              <div className="mb-4 grid grid-cols-3 gap-3">
                {!selectedApprovalTask || !isEquipmentServiceTask(selectedApprovalTask) ? (
                  <button
                    onClick={() => resolveApproval(selectedApproval.id, 'approved', draftComments[selectedApproval.id])}
                    className="rounded-xl bg-primary px-4 py-3 text-sm text-on-primary"
                  >
                    {selectedApprovalTask && isChemicalPurchaseTask(selectedApprovalTask) ? '批准采购' : '\u6279\u51c6\u5e76\u7ee7\u7eed'}
                  </button>
                ) : null}
                <button
                  onClick={() => resolveApproval(selectedApproval.id, 'rejected', draftComments[selectedApproval.id])}
                  className="rounded-xl bg-error px-4 py-3 text-sm text-on-error"
                >
                  {'\u9a73\u56de\u9000\u56de\u4efb\u52a1'}
                </button>
                <button
                  onClick={() => resolveApproval(selectedApproval.id, 'needs_info', draftComments[selectedApproval.id])}
                  className="rounded-xl bg-surface-container-high px-4 py-3 text-sm text-on-surface"
                >
                  {'\u8981\u6c42\u8865\u5145\u4fe1\u606f'}
                </button>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium text-on-surface">{'\u5ba1\u6279\u6d3b\u52a8\u65e5\u5fd7'}</p>
              <div className="space-y-2">
                {selectedApprovalLogs.map((log) => (
                  <div key={log.id} className="rounded-xl bg-surface-container-low p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-on-surface">{log.action}</p>
                      <span className="text-xs text-on-surface-variant">{formatLocalDateTime(log.timestamp)}</span>
                    </div>
                    <p className="mt-1 text-on-surface-variant">{translateTaskText(log.detail)}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
            暂无可查看的审批。
          </div>
        )}
      </section>
    </div>
  )
}

function ReportsTab({ reports, generateReport, deleteReport, sendReport, reportDeliveryRecords }: ReportsTabProps) {
  const [typeFilter, setTypeFilter] = useState<'all' | AIReport['type']>('all')
  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0]?.id ?? '')

  const filteredReports = reports.filter((report) => typeFilter === 'all' || report.type === typeFilter)
  const selectedReport = filteredReports.find((report) => report.id === selectedReportId) ?? filteredReports[0]
  const selectedReportRecords = selectedReport
    ? reportDeliveryRecords.filter((item) => item.reportId === selectedReport.id).slice(0, 3)
    : []

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-outline-variant bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-on-surface">{'\u62a5\u544a\u4e2d\u5fc3'}</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => generateReport('daily')} className="rounded-xl bg-primary px-4 py-3 text-sm text-on-primary">
              {'\u751f\u6210\u65e5\u62a5'}
            </button>
            <button
              onClick={() => generateReport('weekly')}
              className="rounded-xl bg-surface-container-high px-4 py-3 text-sm text-on-surface"
            >
              {'\u751f\u6210\u5468\u62a5'}
            </button>
            <button
              onClick={() => generateReport('risk_summary')}
              className="rounded-xl bg-tertiary-container px-4 py-3 text-sm text-on-tertiary-container"
            >
              {'\u751f\u6210\u98ce\u9669\u4e13\u9898'}
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface">
          <div className="border-b border-outline-variant p-4">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setTypeFilter('all')}
                className={`rounded-full px-4 py-2 text-sm ${typeFilter === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'}`}
              >
                {'\u5168\u90e8'}
              </button>
              <button
                onClick={() => setTypeFilter('daily')}
                className={`rounded-full px-4 py-2 text-sm ${typeFilter === 'daily' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'}`}
              >
                {'\u65e5\u62a5'}
              </button>
              <button
                onClick={() => setTypeFilter('weekly')}
                className={`rounded-full px-4 py-2 text-sm ${typeFilter === 'weekly' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'}`}
              >
                {'\u5468\u62a5'}
              </button>
              <button
                onClick={() => setTypeFilter('risk_summary')}
                className={`rounded-full px-4 py-2 text-sm ${typeFilter === 'risk_summary' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'}`}
              >
                {'\u4e13\u9898'}
              </button>
            </div>
          </div>
          <div className="divide-y divide-outline-variant">
            {filteredReports.map((report) => (
              <button
                key={report.id}
                onClick={() => setSelectedReportId(report.id)}
                className={`w-full px-6 py-4 text-left transition-colors hover:bg-surface-container-low ${
                  selectedReport?.id === report.id ? 'bg-surface-container-low' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-on-surface">{report.title}</p>
                    <p className="mt-1 text-sm text-on-surface-variant">{formatLocalDateTime(report.createdAt)}</p>
                  </div>
                  <ReportTypePill type={report.type} />
                </div>
                <p className="mt-2 text-sm text-on-surface-variant">{report.summary}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-outline-variant bg-surface p-6">
          {selectedReport ? (
            <>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-on-surface">{selectedReport.title}</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">{formatLocalDateTime(selectedReport.createdAt)}</p>
                </div>
                <ReportTypePill type={selectedReport.type} />
              </div>

              <div className="mb-4 flex flex-wrap gap-3">
                <Link
                  to={`/ai-reports/${selectedReport.id}/print`}
                  className="rounded-xl bg-surface-container-high px-4 py-3 text-sm text-on-surface"
                >
                  {'预览'}
                </Link>
                <button
                  onClick={async () => {
                    const pdf = await aiAppClient.exportReportPdf(selectedReport.id)
                    downloadBase64File(pdf.fileName, pdf.mimeType, pdf.contentBase64)
                  }}
                  className="rounded-xl border border-outline-variant px-4 py-3 text-sm text-on-surface"
                >
                  {'下载 PDF'}
                </button>
                <button
                  onClick={() => sendReport(selectedReport.id)}
                  className="rounded-xl bg-primary px-4 py-3 text-sm text-on-primary"
                >
                  {'立即发送'}
                </button>
                <Link
                  to="/report-delivery"
                  className="rounded-xl bg-tertiary-container px-4 py-3 text-sm text-on-tertiary-container"
                >
                  {'发送配置'}
                </Link>
                <button
                  onClick={async () => {
                    if (!window.confirm(`确认删除报告“${selectedReport.title}”吗？`)) {
                      return
                    }

                    const nextReportId = filteredReports.find((report) => report.id !== selectedReport.id)?.id ?? ''
                    await deleteReport(selectedReport.id)
                    setSelectedReportId(nextReportId)
                  }}
                  className="rounded-xl border border-error px-4 py-3 text-sm text-error"
                >
                  {'删除报告'}
                </button>
              </div>

              <div className="mb-4 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface">
                {selectedReport.summary}
              </div>

              <div className="mb-4 grid gap-3 md:grid-cols-3">
                {selectedReport.highlights.map((highlight) => (
                  <div key={highlight} className="rounded-xl bg-secondary-container p-3 text-sm text-on-secondary-container">
                    {highlight}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {(selectedReport.sections ?? []).map((section) => (
                  <div key={section.title} className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
                    <p className="font-medium text-on-surface">{section.title}</p>
                    <p className="mt-2 text-sm text-on-surface-variant">{section.content}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
                <p className="text-sm font-medium text-on-surface">{'最近发送记录'}</p>
                <div className="mt-3 space-y-2">
                  {selectedReportRecords.length > 0 ? (
                    selectedReportRecords.map((record) => (
                      <div key={record.id} className="rounded-lg bg-surface px-3 py-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-on-surface">{`${record.recipientName} · ${record.recipientEmail || '未匹配邮箱'}`}</span>
                          <span className={record.status === 'success' ? 'text-on-secondary-container' : 'text-error'}>
                            {record.status === 'success' ? '成功' : '失败'}
                          </span>
                        </div>
                        <p className="mt-1 text-on-surface-variant">{formatLocalDateTime(record.sentAt)}</p>
                        {record.errorMessage ? <p className="mt-1 text-error">{record.errorMessage}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-on-surface-variant">{'暂无发送记录。'}</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
              {'\u6682\u65e0\u53ef\u67e5\u770b\u7684\u62a5\u544a\u3002'}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function AnalysisTab() {
  const [summary, setSummary] = useState<AIAnalysisSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    aiAppClient.getAnalysisSummary(30)
      .then((result) => {
        if (!cancelled) {
          setSummary(result)
          setError(null)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '分析数据加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (isLoading) {
    return <div className="rounded-2xl border border-outline-variant bg-surface p-6 text-sm text-on-surface-variant">正在加载真实分析数据...</div>
  }

  if (error || !summary) {
    return <div className="rounded-2xl border border-outline-variant bg-surface p-6 text-sm text-error">{error || '暂无分析数据。'}</div>
  }

  const overviewCards = [
    ['活跃任务', summary.overview.activeTasks],
    ['待审批', summary.overview.pendingApprovals],
    ['超时任务', summary.overview.overdueTasks],
    ['高风险任务', summary.overview.highRiskTasks],
    ['低库存物资', summary.overview.lowStockItems],
    ['维护逾期设备', summary.overview.maintenanceOverdueItems],
  ]

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-outline-variant bg-surface p-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-on-surface">数据分析辅助区</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{`分析窗口：近 ${summary.windowDays} 天 · 更新时间：${summary.generatedAt}`}</p>
          </div>
          <div className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            分析结果服务于解释与建议，不替代规则判断与审批门禁。
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {overviewCards.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface-container-low p-4">
              <p className="text-xs text-on-surface-variant">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-on-surface">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AnalysisPanel
          title="低库存物资"
          emptyText="当前没有低库存物资。"
          items={summary.inventory.lowStockItems.map((item) => [
            item.name,
            `当前 ${item.currentQuantity} ${item.unit}，阈值 ${item.minThreshold}`,
          ])}
        />
        <AnalysisPanel
          title="高频出库物资"
          emptyText="近 30 天暂无出库记录。"
          items={summary.inventory.highUsageItems.map((item) => [
            item.name,
            `出库 ${item.outboundCount} 次，共 ${item.outboundQuantity} ${item.unit}`,
          ])}
        />
        <AnalysisPanel
          title="维护逾期设备"
          emptyText="当前没有维护逾期设备。"
          items={summary.equipment.overdueMaintenance.map((item) => [
            item.name,
            `逾期 ${item.overdueDays} 天，上次维护 ${item.lastMaintenanceAt || '未知'}`,
          ])}
        />
        <AnalysisPanel
          title="故障热点设备"
          emptyText="近 30 天暂无设备故障热点。"
          items={summary.equipment.faultHotspots.map((item) => [
            item.name,
            `故障任务 ${item.faultCount} 次，最近 ${item.latestFaultAt || '未知'}`,
          ])}
        />
      </div>

      <section className="rounded-2xl border border-outline-variant bg-surface p-6">
        <h3 className="mb-4 text-lg font-semibold text-on-surface">管理员建议</h3>
        {summary.recommendations.length > 0 ? (
          <div className="space-y-3">
            {summary.recommendations.map((item) => (
              <div key={item.id} className="rounded-xl bg-surface-container-low p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-medium text-on-surface">{item.title}</p>
                  <span className={item.severity === 'critical' ? 'text-error' : 'text-on-tertiary-container'}>
                    {item.severity === 'critical' ? '严重' : item.severity === 'warning' ? '关注' : '提示'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-on-surface-variant">{item.reason}</p>
                <p className="mt-2 text-sm text-on-surface">{item.suggestedAction}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.evidence.map((evidence) => (
                    <span key={`${item.id}-${evidence.label}`} className="rounded-full bg-surface px-3 py-1 text-xs text-on-surface-variant">
                      {`${evidence.label}: ${evidence.value}`}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">当前没有需要管理员优先处理的建议。</p>
        )}
      </section>
    </div>
  )
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="material-symbols-outlined rounded-full bg-primary-container p-2 text-on-primary-container">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-on-surface">{value}</p>
      <p className="mt-1 text-sm text-on-surface-variant">{title}</p>
    </div>
  )
}

function StatusPill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex min-h-10 min-w-[7rem] items-center justify-center rounded-full px-4 py-2 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-container-low p-4">
      <p className="text-xs text-on-surface-variant">{label}</p>
      <p className="mt-1 font-medium text-on-surface">{value}</p>
    </div>
  )
}

function SLAPill({
  task,
  getTaskSLAStatusLabel,
}: {
  task: AITask
  getTaskSLAStatusLabel: (task: AITask) => string
}) {
  const label = getTaskSLAStatusLabel(task)
  const className =
    label === '\u5df2\u5347\u7ea7'
      ? 'bg-error-container text-error'
      : label === '\u5df2\u8d85\u65f6'
        ? 'bg-tertiary-container text-on-tertiary-container'
        : 'bg-secondary-container text-on-secondary-container'

  return <StatusPill label={label} className={className} />
}

function ReportTypePill({ type }: { type: AIReport['type'] }) {
  const label = type === 'daily' ? '日报' : type === 'weekly' ? '周报' : '专题'
  const className =
    type === 'daily'
      ? 'bg-primary-container text-on-primary-container'
      : type === 'weekly'
        ? 'bg-secondary-container text-on-secondary-container'
        : 'bg-tertiary-container text-on-tertiary-container'

  return <StatusPill label={label} className={className} />
}

function AnalysisPanel({ title, items, emptyText }: { title: string; items: Array<[string, string]>; emptyText?: string }) {
  return (
    <section className="rounded-2xl border border-outline-variant bg-surface p-6">
      <h3 className="mb-4 text-lg font-semibold text-on-surface">{title}</h3>
      <div className="space-y-3">
        {items.length > 0 ? (
          items.map(([name, detail]) => (
            <div key={name} className="rounded-xl bg-surface-container-low p-4">
              <p className="font-medium text-on-surface">{name}</p>
              <p className="mt-1 text-sm text-on-surface-variant">{detail}</p>
            </div>
          ))
        ) : (
          <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">{emptyText || '暂无数据。'}</p>
        )}
      </div>
    </section>
  )
}




