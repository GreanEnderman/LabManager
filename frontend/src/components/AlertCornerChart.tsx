import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { alertsApi, type AlertEvent } from '../api/alerts'
import { useAISettingsRuntime } from '../ai/AISettingsRuntimeLive'
import { getEffectiveChemicalThreshold } from '../ai/thresholds'
import { MAINTENANCE_OVERDUE_DAYS } from '../data/selectors'
import { useImports } from '../imports/ImportContextLive'

type AlertBucket = 'low_stock' | 'maintenance_overdue' | 'equipment_fault'

const alertMeta: Record<AlertBucket, { label: string; tone: string; icon: string }> = {
  low_stock: { label: '低库存', tone: 'bg-tertiary text-on-tertiary', icon: 'inventory_2' },
  maintenance_overdue: { label: '待维护', tone: 'bg-primary text-on-primary', icon: 'build' },
  equipment_fault: { label: '设备异常', tone: 'bg-error text-on-error', icon: 'error' },
}

export default function AlertCornerChart() {
  const { chemicals, equipment, isLoading } = useImports()
  const { settings } = useAISettingsRuntime()
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(false)
  const previousTotalRef = useRef(0)

  useEffect(() => {
    if (isLoading) return

    let cancelled = false

    async function loadAlerts() {
      try {
        const response = await alertsApi.inspectRules({
          input: {
            chemicals: chemicals.map((chemical) => ({
              id: chemical.id,
              name: chemical.name,
              totalQuantity: chemical.currentQuantity,
              threshold: getEffectiveChemicalThreshold(chemical, settings),
            })),
            equipment: equipment.map((item) => ({
              id: item.id,
              name: item.name,
              status: item.status,
              lastMaintenanceAt: item.lastMaintenanceAt,
            })),
          },
          config: {
            now: new Date().toISOString(),
            maintenanceOverdueDays: MAINTENANCE_OVERDUE_DAYS,
          },
        })

        if (cancelled) return

        const nextEvents = response.data.items.map((item) => item.event)
        const nextTotal = nextEvents.length
        if (nextTotal > previousTotalRef.current) {
          setHighlight(true)
          window.setTimeout(() => setHighlight(false), 1800)
        }
        previousTotalRef.current = nextTotal
        setEvents(nextEvents)
      } catch (error) {
        console.error('Failed to load alert corner chart:', error)
        if (!cancelled) setEvents([])
      }
    }

    loadAlerts()
    return () => {
      cancelled = true
    }
  }, [chemicals, equipment, isLoading, settings])

  const counts = useMemo(
    () =>
      events.reduce<Record<AlertBucket, number>>(
        (accumulator, event) => {
          accumulator[event.type] += 1
          return accumulator
        },
        { low_stock: 0, maintenance_overdue: 0, equipment_fault: 0 },
      ),
    [events],
  )
  const total = counts.low_stock + counts.maintenance_overdue + counts.equipment_fault

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`relative w-full rounded-lg border bg-surface-container-low px-3 py-2 text-left transition-all ${
          total > 0 ? 'border-tertiary' : 'border-outline-variant opacity-80'
        } ${highlight ? 'ring-4 ring-tertiary/25' : ''}`}
        aria-label="查看预警图表"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined ${total > 0 ? 'text-tertiary' : 'text-on-surface-variant'}`}>
              notifications
            </span>
            <span className="text-sm font-medium text-on-surface">预警</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-end gap-1">
              {(Object.keys(alertMeta) as AlertBucket[]).map((key) => (
                <span
                  key={key}
                  className={`block w-1.5 rounded-full ${counts[key] > 0 ? alertMeta[key].tone : 'bg-outline-variant'}`}
                  style={{ height: `${Math.max(6, Math.min(18, 6 + counts[key] * 3))}px` }}
                />
              ))}
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs ${total > 0 ? 'bg-error text-on-error' : 'bg-surface-container text-on-surface-variant'}`}>
              {total}
            </span>
          </div>
        </div>
      </button>

      {open ? (
        <div className="mt-2 rounded-lg border border-outline-variant bg-surface p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-on-surface">当前预警 {total}</h2>
            <Link to="/alerts" className="text-xs text-primary">详情</Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(alertMeta) as AlertBucket[]).map((key) => (
              <span key={key} className="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-2 py-1 text-xs text-on-surface-variant">
                <span className={`h-1.5 w-1.5 rounded-full ${counts[key] > 0 ? alertMeta[key].tone : 'bg-outline-variant'}`} />
                {alertMeta[key].label} {counts[key]}
              </span>
            ))}
          </div>
          <div className="mt-3 divide-y divide-outline-variant overflow-hidden rounded-lg bg-surface-container-low">
            {events.slice(0, 3).map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <p className="min-w-0 truncate text-sm font-medium text-on-surface" title={event.summary}>
                  {event.sourceName}
                </p>
                <span className="shrink-0 text-xs text-on-surface-variant">{alertMeta[event.type].label}</span>
              </div>
            ))}
            {events.length > 3 ? <p className="px-3 py-2 text-xs text-on-surface-variant">还有 {events.length - 3} 条</p> : null}
            {events.length === 0 ? <p className="px-3 py-2 text-sm text-on-surface-variant">当前没有预警。</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
