import { inventoryConfig } from '../data/runtime-config'
import { useRole } from '../auth/RoleContext'

const users = [
  { name: '张三', role: '管理员', email: 'zhangsan@lab.com' },
  { name: '李四', role: '管理员', email: 'lisi@lab.com' },
  { name: '王五', role: '普通成员', email: 'wangwu@lab.com' },
  { name: '赵六', role: '普通成员', email: 'zhaoliu@lab.com' },
]

const chemicalCategories = ['有机溶剂', '无机试剂', '生物试剂', '标准品']
const equipmentCategories = ['分析仪器', '制备设备', '通用设备', '辅助设备']
const thresholdOverrides = Object.entries(inventoryConfig.chemicalThresholdOverrides)

export default function SystemSettings() {
  const { can } = useRole()
  const canManageSettings = can('settings:update')

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold text-on-surface">系统设置</h1>

      <div className="space-y-6">
        <section className="rounded-lg border border-outline-variant bg-surface p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-on-surface">
            <span className="material-symbols-outlined">group</span>
            用户管理
          </h2>
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.email}
                className="flex items-center justify-between rounded-lg bg-surface-container-low p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container">
                    <span className="material-symbols-outlined text-on-primary-container">person</span>
                  </div>
                  <div>
                    <p className="font-medium text-on-surface">{user.name}</p>
                    <p className="text-sm text-on-surface-variant">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-sm ${
                      user.role === '管理员'
                        ? 'bg-primary-container text-on-primary-container'
                        : 'bg-surface-container text-on-surface'
                    }`}
                  >
                    {user.role}
                  </span>
                  {canManageSettings ? <button className="text-primary hover:text-primary-container">编辑</button> : null}
                </div>
              </div>
            ))}
          </div>
          {canManageSettings ? (
            <button className="mt-4 rounded-lg bg-primary px-4 py-2 text-on-primary">添加用户</button>
          ) : (
            <p className="mt-4 text-sm text-on-surface-variant">普通成员仅可查看用户信息。</p>
          )}
        </section>

        <section className="rounded-lg border border-outline-variant bg-surface p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-on-surface">
            <span className="material-symbols-outlined">tune</span>
            预警阈值设置
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-on-surface">默认低库存阈值（瓶）</label>
              <div className="flex items-center gap-4 rounded-lg bg-surface-container-low px-4 py-3">
                <span className="font-medium text-on-surface">{inventoryConfig.defaultLowStockThreshold}</span>
                <span className="text-sm text-on-surface-variant">当前从 `src/data/inventory-config.json` 读取</span>
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">当化学品未配置单独阈值时，使用默认值。</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-on-surface">设备维护提醒周期（天）</label>
              <div className="rounded-lg bg-surface-container-low px-4 py-3 font-medium text-on-surface">
                {inventoryConfig.maintenanceOverdueDays}
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">超过该天数未维护的设备会触发提醒。</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-on-surface">化学品单独阈值覆盖</label>
              <div className="space-y-2">
                {thresholdOverrides.map(([name, threshold]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-lg bg-surface-container-low px-4 py-3"
                  >
                    <span className="text-sm text-on-surface">{name}</span>
                    <span className="font-medium text-on-surface">{threshold} 瓶</span>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">
                后续维护时，直接修改 `src/data/inventory-config.json` 即可生效。
              </p>
            </div>
          </div>
          {canManageSettings ? (
            <button className="mt-4 rounded-lg bg-primary px-4 py-2 text-on-primary">配置已接入</button>
          ) : (
            <p className="mt-4 text-sm text-on-surface-variant">普通成员无权修改预警阈值和配置项。</p>
          )}
        </section>

        <section className="rounded-lg border border-outline-variant bg-surface p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-on-surface">
            <span className="material-symbols-outlined">category</span>
            分类管理
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-medium text-on-surface">化学品分类</h3>
              <div className="space-y-2">
                {chemicalCategories.map((category) => (
                  <div
                    key={category}
                    className="flex items-center justify-between rounded bg-surface-container-low p-3"
                  >
                    <span className="text-sm text-on-surface">{category}</span>
                    {canManageSettings ? <button className="text-sm text-error">删除</button> : null}
                  </div>
                ))}
              </div>
              {canManageSettings ? <button className="mt-3 text-sm text-primary">+ 添加分类</button> : null}
            </div>

            <div>
              <h3 className="mb-3 text-sm font-medium text-on-surface">设备分类</h3>
              <div className="space-y-2">
                {equipmentCategories.map((category) => (
                  <div
                    key={category}
                    className="flex items-center justify-between rounded bg-surface-container-low p-3"
                  >
                    <span className="text-sm text-on-surface">{category}</span>
                    {canManageSettings ? <button className="text-sm text-error">删除</button> : null}
                  </div>
                ))}
              </div>
              {canManageSettings ? <button className="mt-3 text-sm text-primary">+ 添加分类</button> : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
