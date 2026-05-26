import type {
  SystemSettingsDTO,
  UpdateSystemSettingsRequest,
  UpdateSystemSettingsResponse,
} from '../contracts/shared'
import type { Clock } from './clock'
import type { AIDataStore } from './store'

export interface SettingsServiceDependencies {
  store: AIDataStore
  clock: Clock
}

function buildDefaultSettings(now: string): SystemSettingsDTO {
  return {
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
    updatedAt: now,
  }
}

export class SettingsService {
  constructor(private readonly deps: SettingsServiceDependencies) {}

  getSettings(): SystemSettingsDTO {
    if (!this.deps.store.settings) {
      this.deps.store.settings = buildDefaultSettings(this.deps.clock.now())
    }

    return this.deps.store.settings
  }

  updateSettings(request: UpdateSystemSettingsRequest): UpdateSystemSettingsResponse {
    const current = this.getSettings()
    const next: SystemSettingsDTO = {
      thresholds: {
        ...current.thresholds,
        ...request.thresholds,
        chemicalThresholdOverrides: {
          ...current.thresholds.chemicalThresholdOverrides,
          ...(request.thresholds?.chemicalThresholdOverrides ?? {}),
        },
      },
      approvalStrategy: {
        ...current.approvalStrategy,
        ...request.approvalStrategy,
      },
      sla: {
        ...current.sla,
        ...request.sla,
      },
      updatedAt: this.deps.clock.now(),
    }

    this.deps.store.settings = next

    return {
      settings: next,
    }
  }
}
