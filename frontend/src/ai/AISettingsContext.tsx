import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useCallback } from 'react'
import type { AISettings } from './types'

/* eslint-disable react-refresh/only-export-components */

// Demo-only legacy settings state.
// Do not wire new product features to this provider.
// Production and pre-release runtime must go through AISettingsRuntimeLive + HTTP gateway.

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

type AISettingsSection = 'thresholds' | 'approvalStrategy' | 'sla'

interface AISettingsContextValue {
  settings: AISettings
  saveSettings: (patch: Partial<AISettings>) => void
  updateSettings: (patch: Partial<AISettings>) => void
  updateThresholds: (patch: Partial<AISettings['thresholds']>) => void
  updateApprovalStrategy: (patch: Partial<AISettings['approvalStrategy']>) => void
  updateSLASettings: (patch: Partial<AISettings['sla']>) => void
  lastSavedAt: string
  hasUnsavedChanges: boolean
  pendingSections: AISettingsSection[]
}

const AISettingsContext = createContext<AISettingsContextValue | null>(null)

function nowLabel() {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

export function AISettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AISettings>(initialSettings)
  const [lastSavedAt, setLastSavedAt] = useState(initialSettings.updatedAt)
  const [pendingSections, setPendingSections] = useState<AISettingsSection[]>([])

  function markSectionsDirty(sections: AISettingsSection[]) {
    setPendingSections((current) => Array.from(new Set([...current, ...sections])))
  }

  const saveSettings = useCallback((patch: Partial<AISettings>) => {
    const savedAt = nowLabel()
    setSettings((current) => ({
      ...current,
      ...patch,
      updatedAt: savedAt,
    }))
    setLastSavedAt(savedAt)
    setPendingSections([])
  }, [])

  const updateSettings = useCallback((patch: Partial<AISettings>) => {
    setSettings((current) => ({
      ...current,
      ...patch,
    }))
    markSectionsDirty(['thresholds', 'approvalStrategy', 'sla'])
  }, [])

  const updateThresholds = useCallback((patch: Partial<AISettings['thresholds']>) => {
    setSettings((current) => ({
      ...current,
      thresholds: {
        ...current.thresholds,
        ...patch,
      },
    }))
    markSectionsDirty(['thresholds'])
  }, [])

  const updateApprovalStrategy = useCallback((patch: Partial<AISettings['approvalStrategy']>) => {
    setSettings((current) => ({
      ...current,
      approvalStrategy: {
        ...current.approvalStrategy,
        ...patch,
      },
    }))
    markSectionsDirty(['approvalStrategy'])
  }, [])

  const updateSLASettings = useCallback((patch: Partial<AISettings['sla']>) => {
    setSettings((current) => ({
      ...current,
      sla: {
        ...current.sla,
        ...patch,
      },
    }))
    markSectionsDirty(['sla'])
  }, [])

  const value = useMemo<AISettingsContextValue>(() => ({
    settings,
    saveSettings,
    updateSettings,
    updateThresholds,
    updateApprovalStrategy,
    updateSLASettings,
    lastSavedAt,
    hasUnsavedChanges: pendingSections.length > 0,
    pendingSections,
  }), [
    lastSavedAt,
    pendingSections,
    saveSettings,
    settings,
    updateApprovalStrategy,
    updateSLASettings,
    updateSettings,
    updateThresholds,
  ])

  return <AISettingsContext.Provider value={value}>{children}</AISettingsContext.Provider>
}

export function useAISettings() {
  const context = useContext(AISettingsContext)
  if (!context) {
    throw new Error('useAISettings must be used within AISettingsProvider')
  }
  return context
}
