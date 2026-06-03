import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAI } from '../ai/AIStateLive'
import { getNotificationItems, type NotificationItem } from '../ai/selectors'
import { useRole } from '../auth/RoleContext'
import AlertCornerChart from '../components/AlertCornerChart'
import {
  getUnreadNotificationCount,
  markNotificationsAnnounced,
  readNotificationAnnouncedIds,
  subscribeNotificationReadState,
} from '../notifications/state'
import { getAuthBannerMessage } from '../runtime/httpErrorPresentation'
import {
  clearHttpAuthToken,
  markHttpAuthInvalidated,
  readHttpAuthInvalidationReason,
  readHttpAuthUser,
  subscribeHttpAuthState,
  type HttpAuthInvalidationReason,
  type HttpAuthUser,
} from '../runtime/httpAuthSession'

interface NavItem {
  path: string
  label: string
  icon: string
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: '首页概览', icon: 'dashboard' },
  { path: '/chemicals', label: '化学品管理', icon: 'science' },
  { path: '/equipment', label: '仪器设备', icon: 'precision_manufacturing' },
  { path: '/ai-workbench', label: 'AI 工作台', icon: 'psychology' },
  { path: '/notifications', label: '通知中心', icon: 'notifications' },
  { path: '/workflow-monitor', label: '工作流监控', icon: 'monitoring' },
  { path: '/settings', label: '系统设置', icon: 'settings' },
]

export default function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { tasks, approvals, events, reports, reportDeliveryRecords, activityLogs } = useAI()
  const { role, setRole, can } = useRole()
  const [authUser, setAuthUser] = useState<HttpAuthUser | null>(() => readHttpAuthUser())
  const [authInvalidationReason, setAuthInvalidationReason] = useState<HttpAuthInvalidationReason | null>(
    () => readHttpAuthInvalidationReason(),
  )
  const [toastNotification, setToastNotification] = useState<NotificationItem | null>(null)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const didPrimeNotificationsRef = useRef(false)
  const toastTimerRef = useRef<number | null>(null)

  const notifications = useMemo(
    () => getNotificationItems(tasks, approvals, events, reports, reportDeliveryRecords, activityLogs),
    [activityLogs, approvals, events, reportDeliveryRecords, reports, tasks],
  )
  const visibleNavItems = navItems.filter((item) => {
    switch (item.path) {
      case '/data-import':
        return can('imports:read')
      case '/settings':
        return can('settings:read')
      default:
        return true
    }
  })

  const roleMeta: Record<typeof role, { label: string; email: string }> = {
    admin: { label: '系统管理员', email: 'admin@lab.com' },
    manager: { label: '实验室主管', email: 'manager@lab.com' },
    operator: { label: '执行人员', email: 'operator@lab.com' },
    viewer: { label: '只读访客', email: 'viewer@lab.com' },
  }

  useEffect(() => {
    const user = readHttpAuthUser()
    setAuthUser(user)
    if (user?.role) {
      setRole(user.role)
    }

    return subscribeHttpAuthState((detail) => {
      const nextUser = readHttpAuthUser()
      setAuthUser(nextUser)
      if (nextUser?.role) {
        setRole(nextUser.role)
      }
      setAuthInvalidationReason(detail.authenticated ? null : detail.reason ?? null)
    })
  }, [setRole])

  useEffect(() => {
    const notificationIds = notifications.map((notification) => notification.id)
    setUnreadNotificationCount(getUnreadNotificationCount(notificationIds))

    if (!didPrimeNotificationsRef.current) {
      markNotificationsAnnounced(notificationIds)
      didPrimeNotificationsRef.current = true
      return
    }

    const announcedIds = new Set(readNotificationAnnouncedIds())
    const newNotifications = notifications.filter((notification) => !announcedIds.has(notification.id))
    if (newNotifications.length === 0) return

    const newestNotification = newNotifications[0]
    setToastNotification(newestNotification)
    playNotificationSound()
    markNotificationsAnnounced(newNotifications.map((notification) => notification.id))

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastNotification(null)
      toastTimerRef.current = null
    }, 5200)
  }, [notifications])

  useEffect(() => {
    const notificationIds = notifications.map((notification) => notification.id)
    return subscribeNotificationReadState(() => {
      setUnreadNotificationCount(getUnreadNotificationCount(notificationIds))
    })
  }, [notifications])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  const authBannerMessage = getAuthBannerMessage(authInvalidationReason)
  const currentUserLabel = authUser?.name || roleMeta[role].label
  const currentUserAccount = authUser?.username || roleMeta[role].email

  function handleLogout() {
    clearHttpAuthToken()
    markHttpAuthInvalidated('manual')
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="flex w-64 flex-col border-r border-outline-variant bg-surface">
        <div className="border-b border-outline-variant p-6">
          <h1 className="font-manrope text-xl font-bold text-primary">实验室物料管理平台</h1>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          {visibleNavItems.map((item) => {
            const isActive = location.pathname === item.path

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`mb-2 flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                  isActive
                    ? 'bg-primary-container font-medium text-on-primary-container'
                    : 'text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className="relative flex h-6 w-6 items-center justify-center">
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  {item.path === '/notifications' && unreadNotificationCount > 0 ? (
                    <span
                      className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-error ring-2 ring-surface"
                      aria-label="有未读通知"
                    />
                  ) : null}
                </span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-outline-variant p-4">
          <AlertCornerChart />
        </div>

        <div className="border-t border-outline-variant p-4">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container">
              <span className="material-symbols-outlined text-on-primary-container">person</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-on-surface">{currentUserLabel}</p>
              <p className="truncate text-xs text-on-surface-variant">{currentUserAccount}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              title="退出登录"
              aria-label="退出登录"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {toastNotification ? (
          <NotificationToast notification={toastNotification} onClose={() => setToastNotification(null)} />
        ) : null}
        {authBannerMessage ? (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900">
            {authBannerMessage}
          </div>
        ) : null}
        <Outlet />
      </main>
    </div>
  )
}

function NotificationToast({
  notification,
  onClose,
}: {
  notification: NotificationItem
  onClose: () => void
}) {
  return (
    <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-outline-variant bg-surface px-4 py-3 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container">
          <span className="material-symbols-outlined text-on-primary-container">notifications_active</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-on-surface">{notification.title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{notification.message}</p>
          {notification.actionHref && notification.actionLabel ? (
            <Link
              to={notification.actionHref}
              onClick={onClose}
              className="mt-2 inline-flex text-sm font-medium text-primary"
            >
              {notification.actionLabel}
            </Link>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          aria-label="关闭通知"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
    </div>
  )
}

function playNotificationSound() {
  try {
    const audioWindow = window as Window & {
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    const AudioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext
    if (!AudioContextCtor) return

    const context = new AudioContextCtor()
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, context.currentTime)
    oscillator.frequency.setValueAtTime(660, context.currentTime + 0.09)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22)

    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.24)
    oscillator.onended = () => {
      context.close().catch(() => undefined)
    }
  } catch {
    // Browsers may block sound until the page has received a user gesture.
  }
}
