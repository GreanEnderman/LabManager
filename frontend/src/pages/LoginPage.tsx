import { FormEvent, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { loginWithCredentials } from '../runtime/httpAuthApi'
import { readHttpAuthToken } from '../runtime/httpAuthSession'

const demoUsers = [
  { username: 'admin', label: '系统管理员', password: 'LabAdmin#2026' },
  { username: 'manager', label: '实验室主管', password: 'LabManager#2026' },
  { username: 'operator', label: '执行人员', password: 'LabOperator#2026' },
  { username: 'viewer', label: '只读访客', password: 'LabViewer#2026' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('LabAdmin#2026')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const redirectTo = useMemo(() => {
    const state = location.state as { from?: { pathname?: string; search?: string } } | null
    return `${state?.from?.pathname || '/dashboard'}${state?.from?.search || ''}`
  }, [location.state])

  if (readHttpAuthToken()) {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await loginWithCredentials(username, password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试。')
    } finally {
      setSubmitting(false)
    }
  }

  function chooseDemoUser(nextUsername: string) {
    const user = demoUsers.find((item) => item.username === nextUsername)
    if (!user) return
    setUsername(user.username)
    setPassword(user.password)
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-on-surface">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center">
        <section className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-center">
            <p className="mb-3 text-sm font-medium text-primary">LabManager</p>
            <h1 className="font-manrope text-4xl font-bold leading-tight text-on-surface">实验室管理平台</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-on-surface-variant">
              登录后进入库存、设备、AI 工作台和审批报告流程。不同默认账号会带入对应角色权限，方便本地验收权限边界。
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {demoUsers.map((user) => (
                <button
                  key={user.username}
                  type="button"
                  onClick={() => chooseDemoUser(user.username)}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    username === user.username
                      ? 'border-primary bg-primary-container text-on-primary-container'
                      : 'border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <span className="block text-sm font-semibold">{user.label}</span>
                  <span className="mt-1 block text-xs opacity-75">{user.username}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-lg border border-outline-variant bg-surface p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-on-surface">登录</h2>
              <p className="mt-1 text-sm text-on-surface-variant">使用数据库中的用户账号进入系统。</p>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-medium text-on-surface">用户名</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none transition-colors focus:border-primary"
                placeholder="admin"
                required
              />
            </label>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-medium text-on-surface">密码</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none transition-colors focus:border-primary"
                placeholder="请输入密码"
                required
              />
            </label>

            {error ? <div className="mb-4 rounded-lg bg-error-container px-4 py-3 text-sm text-error">{error}</div> : null}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-on-primary transition-colors hover:bg-primary-container hover:text-on-primary-container disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-xl">login</span>
              <span>{submitting ? '登录中' : '登录'}</span>
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
