import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useRole } from '../auth/RoleContext'
import AlertCornerChart from '../components/AlertCornerChart'
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
  { path: '/workflow-monitor', label: '工作流监控', icon: 'monitoring' },
  { path: '/settings', label: '系统设置', icon: 'settings' },
]

export default function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { role, setRole, can } = useRole()
  const [authUser, setAuthUser] = useState<HttpAuthUser | null>(() => readHttpAuthUser())
  const [authInvalidationReason, setAuthInvalidationReason] = useState<HttpAuthInvalidationReason | null>(
    () => readHttpAuthInvalidationReason(),
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
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
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
