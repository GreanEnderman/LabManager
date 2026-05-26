import { Link } from 'react-router-dom'

const quickQuestions = [
  '哪些化学品消耗最快？',
  '近期维护频率最高的设备有哪些？',
  '库存异常波动分析',
  '设备故障趋势预测',
]

const topChemicals = [
  { name: '乙醇', count: 45, percent: 90 },
  { name: '丙酮', count: 38, percent: 76 },
  { name: '甲醇', count: 32, percent: 64 },
  { name: '乙酸乙酯', count: 28, percent: 56 },
  { name: '二氯甲烷', count: 25, percent: 50 },
]

const maintenanceRanking = [
  { name: '培养箱 A-01', count: 5 },
  { name: '离心机 B-02', count: 4 },
  { name: '色谱仪 C-03', count: 3 },
  { name: '分析天平 D-04', count: 2 },
  { name: '超低温冰箱 E-05', count: 2 },
]

const anomalyAlerts = [
  { type: 'warning', title: '化学品 A 消耗异常', desc: '近 7 天消耗量达到平均值的 2.3 倍。' },
  { type: 'info', title: '设备 B 维护频率上升', desc: '建议安排一次深度巡检。' },
  { type: 'warning', title: '补货周期延迟', desc: '3 种化学品已经低于安全库存。' },
]

export default function AIDataAnalysis() {
  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">AI 数据分析</h1>
        </div>
        <Link to="/ai-dashboard" className="rounded-lg bg-surface-container-high px-4 py-2 text-sm text-on-surface">
          返回 AI 驾驶台
        </Link>
      </div>

      <div className="mb-8 rounded-lg border border-outline-variant bg-surface p-6">
        <div className="mb-4 flex items-center gap-4">
          <span className="material-symbols-outlined text-4xl text-primary">psychology</span>
          <div>
            <h2 className="text-xl font-semibold text-on-surface">智能分析助手</h2>
          </div>
        </div>

        <div className="mb-4 flex gap-3">
          <input
            type="text"
            placeholder="询问库存、维护或设备状态..."
            className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button className="rounded-lg bg-primary px-6 py-3 text-on-primary transition-colors hover:bg-primary-container">
            分析
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickQuestions.map((question) => (
            <button
              key={question}
              className="rounded-full bg-primary-container px-4 py-2 text-sm text-on-primary-container transition-colors hover:bg-primary-fixed"
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-outline-variant bg-surface p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-on-surface">
            <span className="material-symbols-outlined">trending_up</span>
            库存趋势分析
          </h3>
          <div className="flex h-64 items-center justify-center rounded bg-surface-container">
            <p className="text-on-surface-variant">图表区域</p>
          </div>
          <div className="mt-4 rounded-lg bg-secondary-container p-4">
            <p className="text-sm text-on-secondary-container">
              <strong>分析结论：</strong>
              过去 30 天内，有机溶剂类化学品消耗量增加约 15%，建议适度提高采购频率。
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-outline-variant bg-surface p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-on-surface">
            <span className="material-symbols-outlined">bar_chart</span>
            高频领用化学品
          </h3>
          <div className="space-y-3">
            {topChemicals.map((item) => (
              <div key={item.name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm text-on-surface">{item.name}</span>
                  <span className="text-sm font-medium text-on-surface">{item.count} 次</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-container-low">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${item.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-outline-variant bg-surface p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-on-surface">
            <span className="material-symbols-outlined">build</span>
            高频维护设备
          </h3>
          <div className="space-y-3">
            {maintenanceRanking.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded bg-surface-container-low p-3">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant">
                    precision_manufacturing
                  </span>
                  <div>
                    <p className="text-sm font-medium text-on-surface">{item.name}</p>
                    <p className="text-xs text-on-surface-variant">近 30 天维护 {item.count} 次</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-primary">{item.count} 次</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-outline-variant bg-surface p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-on-surface">
            <span className="material-symbols-outlined">warning</span>
            异常波动提醒
          </h3>
          <div className="space-y-3">
            {anomalyAlerts.map((item) => (
              <div
                key={item.title}
                className={`rounded-lg p-4 ${
                  item.type === 'warning' ? 'bg-tertiary-container' : 'bg-primary-container'
                }`}
              >
                <p
                  className={`mb-1 text-sm font-medium ${
                    item.type === 'warning' ? 'text-on-tertiary-container' : 'text-on-primary-container'
                  }`}
                >
                  {item.title}
                </p>
                <p
                  className={`text-xs ${
                    item.type === 'warning' ? 'text-on-tertiary-container' : 'text-on-primary-container'
                  }`}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-outline-variant bg-surface p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-on-surface">
          <span className="material-symbols-outlined">chat</span>
          AI 分析结果
        </h3>
        <div className="mb-4 rounded-lg bg-surface-container-low p-4">
          <p className="mb-3 text-sm text-on-surface">
            根据过去 90 天的数据分析，实验室在化学品管理和设备维护方面整体表现稳定，但仍有三个值得关注的方向：
          </p>
          <ul className="space-y-2 text-sm text-on-surface-variant">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>库存周转率保持健康，平均补货周期约为 15 天。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-base">warning</span>
              <span>3 种高频使用化学品的安全库存偏低，建议上调预警阈值。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-base">info</span>
              <span>设备维护记录完整度约为 95%，建议补齐剩余设备的维护台账。</span>
            </li>
          </ul>
        </div>
        <div className="flex gap-3">
          <button className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary">导出分析报告</button>
          <button className="rounded-lg bg-surface-container-high px-4 py-2 text-sm text-on-surface">
            查看详细数据
          </button>
        </div>
      </div>
    </div>
  )
}
