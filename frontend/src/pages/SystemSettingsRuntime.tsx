import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AuthenticatedUserDTO } from '../../../backend/src/contracts/shared'
import { useAISettingsRuntime } from '../ai/AISettingsRuntimeLive'
import { useRole } from '../auth/RoleContext'
import { listAuthUsers } from '../runtime/httpAuthApi'
import ReportDeliverySettings from './ReportDeliverySettings'

type SettingsTab = 'strategy' | 'delivery' | 'users' | 'categories'

const tabs: Array<{ id: SettingsTab; label: string; icon: string }> = [
  { id: 'strategy', label: 'AI 策略', icon: 'tune' },
  { id: 'delivery', label: '邮件与报告', icon: 'outgoing_mail' },
  { id: 'users', label: '用户管理', icon: 'group' },
  { id: 'categories', label: '分类字典', icon: 'category' },
]

const chemicalCategories = ['有机溶剂', '无机试剂', '生物试剂', '标准品']
const equipmentCategories = ['分析仪器', '制备设备', '通用设备', '辅助设备']

const roleLabels: Record<AuthenticatedUserDTO['role'], string> = {
  admin: '系统管理员',
  manager: '实验室主管',
  operator: '执行人员',
  viewer: '只读访客',
}

export default function SystemSettingsRuntime() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { can } = useRole()
  const canManageSettings = can('settings:update')
  const {
    settings,
    isLoading,
    isSaving,
    updateThresholds,
    updateApprovalStrategy,
    updateSLASettings,
    updateEmailDeliverySettings,
    saveSettings,
    hasUnsavedChanges,
  } = useAISettingsRuntime()
  const initialTab = tabs.some((tab) => tab.id === searchParams.get('tab'))
    ? (searchParams.get('tab') as SettingsTab)
    : 'strategy'
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)
  const [draftName, setDraftName] = useState('')
  const [draftThreshold, setDraftThreshold] = useState('')
  const [users, setUsers] = useState<AuthenticatedUserDTO[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)

  const thresholdOverrides = useMemo(
    () => Object.entries(settings.thresholds.chemicalThresholdOverrides),
    [settings.thresholds.chemicalThresholdOverrides],
  )

  useEffect(() => {
    if (activeTab !== 'users') return

    setUsersLoading(true)
    setUsersError(null)
    listAuthUsers()
      .then(setUsers)
      .catch((error) => setUsersError(error instanceof Error ? error.message : '用户列表加载失败。'))
      .finally(() => setUsersLoading(false))
  }, [activeTab])

  function changeTab(tab: SettingsTab) {
    setActiveTab(tab)
    setSearchParams(tab === 'strategy' ? {} : { tab })
  }

  function updateNumberSetting(section: 'thresholds' | 'sla', field: string, value: string) {
    const numericValue = Number(value)
    if (Number.isNaN(numericValue)) return

    if (section === 'thresholds') {
      updateThresholds({ [field]: numericValue } as Partial<typeof settings.thresholds>)
      return
    }
    updateSLASettings({ [field]: numericValue } as Partial<typeof settings.sla>)
  }

  function updateEmailTextSetting(
    field: 'smtpHost' | 'smtpUser' | 'smtpPassword' | 'smtpFrom' | 'supervisorReportBaseUrl',
    value: string,
  ) {
    updateEmailDeliverySettings({ [field]: value.trim() === '' ? null : value } as Partial<
      typeof settings.emailDelivery
    >)
  }

  function updateEmailPort(value: string) {
    const numericValue = Number(value)
    if (!Number.isNaN(numericValue)) {
      updateEmailDeliverySettings({ smtpPort: numericValue })
    }
  }

  function handleOverrideSave() {
    const name = draftName.trim()
    const threshold = Number(draftThreshold)
    if (!name || Number.isNaN(threshold)) return

    updateThresholds({
      chemicalThresholdOverrides: {
        ...settings.thresholds.chemicalThresholdOverrides,
        [name]: threshold,
      },
    })
    setDraftName('')
    setDraftThreshold('')
  }

  function removeOverride(name: string) {
    const nextOverrides = { ...settings.thresholds.chemicalThresholdOverrides }
    delete nextOverrides[name]
    updateThresholds({ chemicalThresholdOverrides: nextOverrides })
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">系统设置</h1>
          <p className="mt-2 text-sm text-on-surface-variant">集中管理策略、邮件、报告、用户和基础字典。</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-sm ${
              hasUnsavedChanges
                ? 'bg-tertiary-container text-on-tertiary-container'
                : 'bg-surface-container-low text-on-surface-variant'
            }`}
          >
            {hasUnsavedChanges ? '有未保存修改' : '已保存'}
          </span>
          {canManageSettings ? (
            <button
              onClick={() => saveSettings()}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-50"
              disabled={isLoading || isSaving || !hasUnsavedChanges}
            >
              保存配置
            </button>
          ) : (
            <span className="text-sm text-on-surface-variant">仅可查看</span>
          )}
        </div>
      </div>

      <section className="rounded-lg border border-outline-variant bg-surface">
        <div className="flex flex-wrap gap-2 border-b border-outline-variant px-5 py-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => changeTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'strategy' ? (
            <StrategyTab
              canManageSettings={canManageSettings}
              defaultLowStockThreshold={settings.thresholds.defaultLowStockThreshold}
              maintenanceOverdueDays={settings.thresholds.maintenanceOverdueDays}
              thresholdOverrides={thresholdOverrides}
              draftName={draftName}
              draftThreshold={draftThreshold}
              setDraftName={setDraftName}
              setDraftThreshold={setDraftThreshold}
              updateNumberSetting={updateNumberSetting}
              removeOverride={removeOverride}
              handleOverrideSave={handleOverrideSave}
              approvalStrategy={settings.approvalStrategy}
              updateApprovalStrategy={updateApprovalStrategy}
              sla={settings.sla}
            />
          ) : null}

          {activeTab === 'delivery' ? (
            <div className="space-y-6">
              <ConfigSection title="邮件发送账号">
                <div className="grid gap-4 lg:grid-cols-2">
                  <TextField label="SMTP 服务器" value={settings.emailDelivery.smtpHost ?? ''} placeholder="smtp.example.com" disabled={!canManageSettings} onChange={(value) => updateEmailTextSetting('smtpHost', value)} />
                  <NumberField label="SMTP 端口" value={settings.emailDelivery.smtpPort ?? 587} disabled={!canManageSettings} onChange={updateEmailPort} />
                  <TextField label="登录账号" value={settings.emailDelivery.smtpUser ?? ''} placeholder="sender@example.com" disabled={!canManageSettings} onChange={(value) => updateEmailTextSetting('smtpUser', value)} />
                  <PasswordField label="登录密码 / 授权码" placeholder={settings.emailDelivery.passwordConfigured ? '已配置，留空表示不修改' : '请输入 SMTP 密码或授权码'} disabled={!canManageSettings} onChange={(value) => updateEmailTextSetting('smtpPassword', value)} />
                  <TextField label="发件人地址" value={settings.emailDelivery.smtpFrom ?? ''} placeholder="sender@example.com" disabled={!canManageSettings} onChange={(value) => updateEmailTextSetting('smtpFrom', value)} />
                  <TextField label="报告链接基础地址" value={settings.emailDelivery.supervisorReportBaseUrl ?? ''} placeholder="https://labmanager.example.com" disabled={!canManageSettings} onChange={(value) => updateEmailTextSetting('supervisorReportBaseUrl', value)} />
                </div>
                <ToggleField label="使用 SSL 直连" checked={settings.emailDelivery.smtpUseSsl} disabled={!canManageSettings} onChange={(checked) => updateEmailDeliverySettings({ smtpUseSsl: checked })} />
              </ConfigSection>

              <div className="[&>div]:p-0">
                <ReportDeliverySettings />
              </div>
            </div>
          ) : null}

          {activeTab === 'users' ? (
            <ConfigSection title="用户管理">
              {usersLoading ? <p className="text-sm text-on-surface-variant">正在加载用户...</p> : null}
              {usersError ? <p className="rounded-lg bg-error-container p-3 text-sm text-error">{usersError}</p> : null}
              <div className="grid gap-3 xl:grid-cols-2">
                {users.map((user) => (
                  <div key={user.id} className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-on-surface">{user.name}</p>
                        <p className="text-sm text-on-surface-variant">{user.username}</p>
                      </div>
                      <span className="rounded-full bg-primary-container px-3 py-1 text-sm text-on-primary-container">
                        {roleLabels[user.role]}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-on-surface-variant">权限数：{user.capabilities.length}</p>
                  </div>
                ))}
              </div>
            </ConfigSection>
          ) : null}

          {activeTab === 'categories' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <SimpleListCard title="化学品分类" items={chemicalCategories} />
              <SimpleListCard title="设备分类" items={equipmentCategories} />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function StrategyTab({
  canManageSettings,
  defaultLowStockThreshold,
  maintenanceOverdueDays,
  thresholdOverrides,
  draftName,
  draftThreshold,
  setDraftName,
  setDraftThreshold,
  updateNumberSetting,
  removeOverride,
  handleOverrideSave,
  approvalStrategy,
  updateApprovalStrategy,
  sla,
}: {
  canManageSettings: boolean
  defaultLowStockThreshold: number
  maintenanceOverdueDays: number
  thresholdOverrides: Array<[string, number]>
  draftName: string
  draftThreshold: string
  setDraftName: (value: string) => void
  setDraftThreshold: (value: string) => void
  updateNumberSetting: (section: 'thresholds' | 'sla', field: string, value: string) => void
  removeOverride: (name: string) => void
  handleOverrideSave: () => void
  approvalStrategy: {
    highRiskRequiresApproval: boolean
    equipmentFaultRequiresApproval: boolean
    maintenanceOverdueRequiresApproval: boolean
  }
  updateApprovalStrategy: (patch: Partial<typeof approvalStrategy>) => void
  sla: {
    openMinutes: number
    inProgressMinutes: number
    pendingApprovalMinutes: number
    reminderIntervalMinutes: number
    maxReminderCountBeforeEscalation: number
  }
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
      <div className="space-y-6">
        <ConfigSection title="预警阈值">
          <NumberField label="默认低库存阈值（瓶）" value={defaultLowStockThreshold} disabled={!canManageSettings} onChange={(value) => updateNumberSetting('thresholds', 'defaultLowStockThreshold', value)} />
          <NumberField label="设备维护超期天数" value={maintenanceOverdueDays} disabled={!canManageSettings} onChange={(value) => updateNumberSetting('thresholds', 'maintenanceOverdueDays', value)} />
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-on-surface">化学品单独阈值覆盖</p>
              <span className="text-xs text-on-surface-variant">{thresholdOverrides.length} 条</span>
            </div>
            {thresholdOverrides.map(([name, threshold]) => (
              <div key={name} className="flex items-center justify-between rounded-lg bg-surface-container-low px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-on-surface">{name}</p>
                  <p className="text-xs text-on-surface-variant">覆盖默认补货阈值</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-on-surface">{threshold} 瓶</span>
                  {canManageSettings ? (
                    <button onClick={() => removeOverride(name)} className="text-sm text-error">
                      删除
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {canManageSettings ? (
              <div className="grid gap-3 rounded-lg border border-dashed border-outline-variant p-4 md:grid-cols-[1fr,160px,120px]">
                <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="例如：异丙醇" className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-sm text-on-surface" />
                <input value={draftThreshold} onChange={(event) => setDraftThreshold(event.target.value)} placeholder="阈值" type="number" className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-sm text-on-surface" />
                <button onClick={handleOverrideSave} className="rounded-lg bg-surface-container-high px-4 py-2 text-sm text-on-surface">
                  添加覆盖
                </button>
              </div>
            ) : null}
          </div>
        </ConfigSection>

        <ConfigSection title="审批策略">
          <ToggleField label="高风险任务必须审批" checked={approvalStrategy.highRiskRequiresApproval} disabled={!canManageSettings} onChange={(checked) => updateApprovalStrategy({ highRiskRequiresApproval: checked })} />
          <ToggleField label="设备异常默认发起审批" checked={approvalStrategy.equipmentFaultRequiresApproval} disabled={!canManageSettings} onChange={(checked) => updateApprovalStrategy({ equipmentFaultRequiresApproval: checked })} />
          <ToggleField label="维护超期自动审批门禁" checked={approvalStrategy.maintenanceOverdueRequiresApproval} disabled={!canManageSettings} onChange={(checked) => updateApprovalStrategy({ maintenanceOverdueRequiresApproval: checked })} />
        </ConfigSection>
      </div>

      <ConfigSection title="SLA 策略">
        <NumberField label="未批准最大停留时长（分钟）" value={sla.openMinutes} disabled={!canManageSettings} onChange={(value) => updateNumberSetting('sla', 'openMinutes', value)} />
        <NumberField label="未批准回流最大停留时长（分钟）" value={sla.inProgressMinutes} disabled={!canManageSettings} onChange={(value) => updateNumberSetting('sla', 'inProgressMinutes', value)} />
        <NumberField label="待审批最大停留时长（分钟）" value={sla.pendingApprovalMinutes} disabled={!canManageSettings} onChange={(value) => updateNumberSetting('sla', 'pendingApprovalMinutes', value)} />
        <NumberField label="催办间隔（分钟）" value={sla.reminderIntervalMinutes} disabled={!canManageSettings} onChange={(value) => updateNumberSetting('sla', 'reminderIntervalMinutes', value)} />
        <NumberField label="升级前最大催办次数" value={sla.maxReminderCountBeforeEscalation} disabled={!canManageSettings} onChange={(value) => updateNumberSetting('sla', 'maxReminderCountBeforeEscalation', value)} />
      </ConfigSection>
    </div>
  )
}

function ConfigSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-outline-variant bg-surface p-6">
      <h3 className="mb-4 text-lg font-semibold text-on-surface">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function NumberField({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-on-surface">{label}</span>
      <input type="number" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface disabled:cursor-not-allowed disabled:opacity-70" />
    </label>
  )
}

function TextField({ label, value, placeholder, disabled, onChange }: { label: string; value: string; placeholder?: string; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-on-surface">{label}</span>
      <input type="text" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface disabled:cursor-not-allowed disabled:opacity-70" />
    </label>
  )
}

function PasswordField({ label, placeholder, disabled, onChange }: { label: string; placeholder?: string; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-on-surface">{label}</span>
      <input type="password" placeholder={placeholder} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface disabled:cursor-not-allowed disabled:opacity-70" />
    </label>
  )
}

function ToggleField({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg bg-surface-container-low px-4 py-3">
      <span className="text-sm font-medium text-on-surface">{label}</span>
      <button type="button" onClick={() => !disabled && onChange(!checked)} className={`rounded-full px-3 py-1 text-sm transition-colors ${checked ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'} ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}>
        {checked ? '已开启' : '已关闭'}
      </button>
    </label>
  )
}

function SimpleListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface p-6">
      <p className="text-lg font-semibold text-on-surface">{title}</p>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-lg bg-surface-container-low px-4 py-3 text-sm text-on-surface">
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}
