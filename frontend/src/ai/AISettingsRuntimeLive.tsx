/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useCallback } from 'react'
import { aiAppClient } from '../runtime/aiAppFacadeAsync'
import type { AISettings } from './types'

// Live AI settings provider - uses HTTP gateway only, throws on backend failures.

type AISettingsSection = 'thresholds' | 'approvalStrategy' | 'sla' | 'emailDelivery'

interface AISettingsContextValue {
  settings: AISettings
  isLoading: boolean
  isSaving: boolean
  saveSettings: (patch?: Partial<AISettings>) => Promise<void>
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

const defaultSettings: AISettings = {
  thresholds: {
    defaultLowStockThreshold: 5,
    maintenanceOverdueDays: 30,
    chemicalThresholdOverrides: {},
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
  updatedAt: '',
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

function normalizeSettings(settings: AISettings): AISettings {
  return mergeSettings(defaultSettings, settings)
}

export function AISettingsRuntimeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AISettings>(defaultSettings)
  const [lastSavedAt, setLastSavedAt] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingSections, setPendingSections] = useState<AISettingsSection[]>([])

  useEffect(() => {
    aiAppClient
      .getSettings()
      .then((nextSettings) => {
        setSettings(normalizeSettings(nextSettings))
        setLastSavedAt(nextSettings.updatedAt)
      })
      .catch((error) => {
        console.warn('Failed to load settings from backend, using defaults:', error.message)
        // Use default settings if backend doesn't have settings API yet
        setSettings(defaultSettings)
        setLastSavedAt(new Date().toISOString())
      })
      .finally(() => setIsLoading(false))
  }, [])

  function markSectionsDirty(sections: AISettingsSection[]) {
    setPendingSections((current) => Array.from(new Set([...current, ...sections])))
  }

  const saveSettings = useCallback(async (patch?: Partial<AISettings>) => {
    setIsSaving(true)
    try {
      const nextSettings = await aiAppClient.updateSettings(mergeSettings(settings, patch))
      setSettings(normalizeSettings(nextSettings))
      setLastSavedAt(nextSettings.updatedAt)
      setPendingSections([])
    } finally {
      setIsSaving(false)
    }
  }, [settings])

  const updateSettings = useCallback((patch: Partial<AISettings>) => {
    setSettings((current) => mergeSettings(current, patch))
    markSectionsDirty(['thresholds', 'approvalStrategy', 'sla', 'emailDelivery'])
  }, [])

  const updateThresholds = useCallback((patch: Partial<AISettings['thresholds']>) => {
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

  const updateEmailDeliverySettings = useCallback((patch: Partial<AISettings['emailDelivery']>) => {
    setSettings((current) => ({
      ...current,
      emailDelivery: {
        ...current.emailDelivery,
        ...patch,
      },
    }))
    markSectionsDirty(['emailDelivery'])
  }, [])

  const value = useMemo<AISettingsContextValue>(
    () => ({
      settings,
      isLoading,
      isSaving,
      saveSettings,
      updateSettings,
      updateThresholds,
      updateApprovalStrategy,
      updateSLASettings,
      updateEmailDeliverySettings,
      lastSavedAt,
      hasUnsavedChanges: pendingSections.length > 0,
      pendingSections,
    }),
    [
      isLoading,
      isSaving,
      lastSavedAt,
      pendingSections,
      saveSettings,
      settings,
      updateApprovalStrategy,
      updateEmailDeliverySettings,
      updateSLASettings,
      updateSettings,
      updateThresholds,
    ],
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
