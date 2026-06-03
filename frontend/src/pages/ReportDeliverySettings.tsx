import { useMemo, useState } from 'react'
import { useRole } from '../auth/RoleContext'
import { useAI } from '../ai/AIStateLive'
import type { AIReportType, DeliveryScopeType, ReportDeliveryConfig, SupervisorEmailMapping } from '../ai/types'

import { formatLocalDateTime } from '../runtime/dateTime'

export default function ReportDeliverySettings() {
  const { can } = useRole()
  const canManageDelivery = can('report_delivery:manage')
  const {
    reportDeliveryMappings,
    reportDeliveryConfigs,
    reportDeliveryRecords,
    saveReportDeliveryMapping,
    saveReportDeliveryConfig,
    isSubmitting,
  } = useAI()

  const [mappingForm, setMappingForm] = useState({
    scopeType: 'lab' as DeliveryScopeType,
    scopeId: '',
    scopeName: '',
    recipientName: '',
    recipientEmail: '',
    enabled: true,
  })

  const [configForm, setConfigForm] = useState({
    reportType: 'daily' as AIReportType,
    scopeType: 'lab' as DeliveryScopeType,
    scopeId: '',
    scopeName: '',
    channel: 'email' as const,
    enabled: true,
  })

  const recentRecords = useMemo(() => reportDeliveryRecords.slice(0, 12), [reportDeliveryRecords])

  async function handleSaveMapping() {
    try {
      await saveReportDeliveryMapping({ ...mappingForm, scopeId: mappingForm.scopeId || null })
      setMappingForm({
        scopeType: 'lab',
        scopeId: '',
        scopeName: '',
        recipientName: '',
        recipientEmail: '',
        enabled: true,
      })
      window.alert('邮箱映射已保存')
    } catch (error) {
      window.alert(`保存邮箱映射失败：${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  async function handleSaveConfig() {
    try {
      await saveReportDeliveryConfig({ ...configForm, scopeId: configForm.scopeId || null })
      setConfigForm({
        reportType: 'daily',
        scopeType: 'lab',
        scopeId: '',
        scopeName: '',
        channel: 'email',
        enabled: true,
      })
      window.alert('发送规则已保存')
    } catch (error) {
      window.alert(`保存发送规则失败：${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  async function toggleMapping(item: SupervisorEmailMapping) {
    await saveReportDeliveryMapping(
      {
        scopeType: item.scopeType,
        scopeId: item.scopeId,
        scopeName: item.scopeName,
        recipientName: item.recipientName,
        recipientEmail: item.recipientEmail,
        enabled: !item.enabled,
      },
      item.id,
    )
  }

  async function toggleConfig(item: ReportDeliveryConfig) {
    await saveReportDeliveryConfig(
      {
        reportType: item.reportType,
        scopeType: item.scopeType,
        scopeId: item.scopeId,
        scopeName: item.scopeName,
        channel: item.channel,
        enabled: !item.enabled,
      },
      item.id,
    )
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">报告发送配置</h1>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-outline-variant bg-surface p-6">
          <h2 className="text-xl font-semibold text-on-surface">主管邮箱映射</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SelectField
              label="范围类型"
              value={mappingForm.scopeType}
              disabled={!canManageDelivery}
              onChange={(value) => setMappingForm((current) => ({ ...current, scopeType: value as DeliveryScopeType }))}
              options={[
                ['lab', '实验室'],
                ['department', '部门'],
                ['global', '全局'],
              ]}
            />
            <InputField
              label="范围 ID"
              value={mappingForm.scopeId}
              disabled={!canManageDelivery}
              onChange={(value) => setMappingForm((current) => ({ ...current, scopeId: value }))}
            />
            <InputField
              label="范围名称"
              value={mappingForm.scopeName}
              disabled={!canManageDelivery}
              onChange={(value) => setMappingForm((current) => ({ ...current, scopeName: value }))}
            />
            <InputField
              label="接收人"
              value={mappingForm.recipientName}
              disabled={!canManageDelivery}
              onChange={(value) => setMappingForm((current) => ({ ...current, recipientName: value }))}
            />
            <InputField
              label="邮箱"
              value={mappingForm.recipientEmail}
              disabled={!canManageDelivery}
              onChange={(value) => setMappingForm((current) => ({ ...current, recipientEmail: value }))}
            />
          </div>
          {canManageDelivery ? (
            <button
              type="button"
              onClick={handleSaveMapping}
              disabled={isSubmitting}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? '保存中...' : '保存邮箱映射'}
            </button>
          ) : null}

          <div className="mt-6 space-y-3">
            {reportDeliveryMappings.map((item) => (
              <div key={item.id} className="rounded-xl bg-surface-container-low p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-on-surface">{item.scopeName}</p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        item.enabled
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'bg-surface-container-high text-on-surface'
                      }`}
                    >
                      {item.enabled ? '启用' : '停用'}
                    </span>
                    {canManageDelivery ? (
                      <button
                        onClick={() => toggleMapping(item)}
                        disabled={isSubmitting}
                        className="rounded-full bg-surface px-3 py-1 text-xs text-on-surface"
                      >
                        {item.enabled ? '设为停用' : '设为启用'}
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-sm text-on-surface-variant">{`${item.recipientName} · ${item.recipientEmail}`}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-outline-variant bg-surface p-6">
          <h2 className="text-xl font-semibold text-on-surface">发送规则</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SelectField
              label="报告类型"
              value={configForm.reportType}
              disabled={!canManageDelivery}
              onChange={(value) => setConfigForm((current) => ({ ...current, reportType: value as AIReportType }))}
              options={[
                ['daily', '日报'],
                ['weekly', '周报'],
                ['risk_summary', '专题'],
              ]}
            />
            <SelectField
              label="范围类型"
              value={configForm.scopeType}
              disabled={!canManageDelivery}
              onChange={(value) => setConfigForm((current) => ({ ...current, scopeType: value as DeliveryScopeType }))}
              options={[
                ['lab', '实验室'],
                ['department', '部门'],
                ['global', '全局'],
              ]}
            />
            <InputField
              label="范围 ID"
              value={configForm.scopeId}
              disabled={!canManageDelivery}
              onChange={(value) => setConfigForm((current) => ({ ...current, scopeId: value }))}
            />
            <InputField
              label="范围名称"
              value={configForm.scopeName}
              disabled={!canManageDelivery}
              onChange={(value) => setConfigForm((current) => ({ ...current, scopeName: value }))}
            />
          </div>
          {canManageDelivery ? (
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={isSubmitting}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? '保存中...' : '保存发送规则'}
            </button>
          ) : null}

          <div className="mt-6 space-y-3">
            {reportDeliveryConfigs.map((item) => (
              <div key={item.id} className="rounded-xl bg-surface-container-low p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-on-surface">{item.scopeName}</p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        item.enabled
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'bg-surface-container-high text-on-surface'
                      }`}
                    >
                      {item.enabled ? '启用' : '停用'}
                    </span>
                    {canManageDelivery ? (
                      <button
                        onClick={() => toggleConfig(item)}
                        disabled={isSubmitting}
                        className="rounded-full bg-surface px-3 py-1 text-xs text-on-surface"
                      >
                        {item.enabled ? '设为停用' : '设为启用'}
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-sm text-on-surface-variant">{`${item.reportType} · ${item.channel}`}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-outline-variant bg-surface p-6">
        <h2 className="text-xl font-semibold text-on-surface">最近发送记录</h2>
        <div className="mt-4 space-y-3">
          {recentRecords.map((item) => (
            <div key={item.id} className="rounded-xl bg-surface-container-low p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-on-surface">{item.reportTitle}</p>
                <span
                  className={`rounded-full px-3 py-1 text-xs ${
                    item.status === 'success'
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-error-container text-error'
                  }`}
                >
                  {item.status === 'success' ? '成功' : '失败'}
                </span>
              </div>
              <p className="mt-2 text-sm text-on-surface-variant">
                {`${item.recipientName} · ${item.recipientEmail || '未匹配邮箱'} · ${formatLocalDateTime(item.sentAt)}`}
              </p>
              {item.errorMessage ? <p className="mt-1 text-sm text-error">{item.errorMessage}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function InputField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-on-surface">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface"
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  disabled,
  onChange,
  options,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
  options: Array<[string, string]>
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-on-surface">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  )
}
