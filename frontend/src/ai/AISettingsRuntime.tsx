import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AISettings } from './types'

/* eslint-disable react-refresh/only-export-components */

const initialSettings: AISettings = {
  thresholds: {
    defaultLowStockThreshold: 5,
    maintenanceOverdueDays: 30,
    chemicalThresholdOverrides: {
      丙酮: 8,
      无水乙醇: 10,
      盐酸: 6,
    },
  },
  approvalStrategy: {
    highRiskRequiresApproval: true,
    equipmentFaultRequiresApproval: true,
    maintenanceOverdueRequiresApproval: false,
  },
  sla: {
    openMinutes: 240,
    inProgressMinutes: 480,
    pendingApprovalMinutes: 180,
    reminderIntervalMinutes: 60,
    maxReminderCountBeforeEscalation: 2,
  },
  emailDelivery: {
    smtpHost: null,
    smtpPort: 587,
    smtpUser: null,
    smtpPassword: null,
    smtpFrom: null,
    smtpUseSsl: false,
    supervisorReportBaseUrl: null,
    passwordConfigured: false,
  },
  updatedAt: '2026-04-17 10:00',
}

type AISettingsSection = 'thresholds' | 'approvalStrategy' | 'sla' | 'emailDelivery'

interface AISettingsContextValue {
  settings: AISettings
  saveSettings: (patch?: Partial<AISettings>) => void
  updateSettings: (patch: Partial<AISettings>) => void
  updateThresholds: (patch: Partial<AISettings['thresholds']>) => void
  updateApprovalStrategy: (patch: Partial<AISettings['approvalStrategy']>) => void
  updateSLASettings: (patch: Partial<AISettings['sla']>) => void
  updateEmailDeliverySettings: (patch: Partial<AISettings['emailDelivery']>) => void
  lastSavedAt: string
  hasUnsavedChanges: boolean
  pendingSections: AISettingsSection[]
}

const AISettingsRuntimeContext = createContext<AISettingsContextValue | null>(null)

function nowLabel() {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

function mergeSettings(current: AISettings, patch?: Partial<AISettings>): AISettings {
  if (!patch) return current

  return {
    ...current,
    ...patch,
    thresholds: {
      ...current.thresholds,
      ...patch.thresholds,
      chemicalThresholdOverrides: {
        ...current.thresholds.chemicalThresholdOverrides,
        ...(patch.thresholds?.chemicalThresholdOverrides ?? {}),
      },
    },
    approvalStrategy: {
      ...current.approvalStrategy,
      ...patch.approvalStrategy,
    },
    sla: {
      ...current.sla,
      ...patch.sla,
    },
    emailDelivery: {
      ...current.emailDelivery,
      ...patch.emailDelivery,
    },
  }
}

export function AISettingsRuntimeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AISettings>(initialSettings)
  const [lastSavedAt, setLastSavedAt] = useState(initialSettings.updatedAt)
  const [pendingSections, setPendingSections] = useState<AISettingsSection[]>([])

  function markSectionsDirty(sections: AISettingsSection[]) {
    setPendingSections((current) => Array.from(new Set([...current, ...sections])))
  }

  const value = useMemo<AISettingsContextValue>(
    () => ({
      settings,
      saveSettings: (patch) => {
        const savedAt = nowLabel()
        setSettings((current) => ({
          ...mergeSettings(current, patch),
          updatedAt: savedAt,
        }))
        setLastSavedAt(savedAt)
        setPendingSections([])
      },
      updateSettings: (patch) => {
        setSettings((current) => mergeSettings(current, patch))
        markSectionsDirty(['thresholds', 'approvalStrategy', 'sla', 'emailDelivery'])
      },
      updateThresholds: (patch) => {
        setSettings((current) => ({
          ...current,
          thresholds: {
            ...current.thresholds,
            ...patch,
            chemicalThresholdOverrides: {
              ...current.thresholds.chemicalThresholdOverrides,
              ...(patch.chemicalThresholdOverrides ?? {}),
            },
          },
        }))
        markSectionsDirty(['thresholds'])
      },
      updateApprovalStrategy: (patch) => {
        setSettings((current) => ({
          ...current,
          approvalStrategy: {
            ...current.approvalStrategy,
            ...patch,
          },
        }))
        markSectionsDirty(['approvalStrategy'])
      },
      updateSLASettings: (patch) => {
        setSettings((current) => ({
          ...current,
          sla: {
            ...current.sla,
            ...patch,
          },
        }))
        markSectionsDirty(['sla'])
      },
      updateEmailDeliverySettings: (patch) => {
        setSettings((current) => ({
          ...current,
          emailDelivery: {
            ...current.emailDelivery,
            ...patch,
          },
        }))
        markSectionsDirty(['emailDelivery'])
      },
      lastSavedAt,
      hasUnsavedChanges: pendingSections.length > 0,
      pendingSections,
    }),
    [lastSavedAt, pendingSections, settings],
  )

  return <AISettingsRuntimeContext.Provider value={value}>{children}</AISettingsRuntimeContext.Provider>
}

export function useAISettingsRuntime() {
  const context = useContext(AISettingsRuntimeContext)
  if (!context) {
    throw new Error('useAISettingsRuntime must be used within AISettingsRuntimeProvider')
  }
  return context
}
