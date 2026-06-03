import { useAI } from '../ai/AIStateLive'

import { formatLocalDateTime } from '../runtime/dateTime'

export default function AIReportCenter() {
  const { reports, generateReport } = useAI()

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">AI 报告中心</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => generateReport('daily')}
            className="rounded-lg bg-primary px-4 py-2 text-on-primary"
          >
            生成日报
          </button>
          <button
            onClick={() => generateReport('weekly')}
            className="rounded-lg bg-surface-container-high px-4 py-2 text-on-surface"
          >
            生成周报
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {reports.map((report) => (
          <article key={report.id} className="rounded-lg border border-outline-variant bg-surface p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-on-surface">{report.title}</h2>
              <span className="rounded-full bg-primary-container px-3 py-1 text-xs text-on-primary-container">
                {report.type === 'daily' ? '日报' : '周报'}
              </span>
            </div>
            <p className="mb-4 text-sm text-on-surface-variant">{formatLocalDateTime(report.createdAt)}</p>
            <div className="mb-4 rounded-lg bg-surface-container-low p-4 text-sm text-on-surface">
              {report.summary}
            </div>
            <div className="space-y-2">
              {report.highlights.map((highlight) => (
                <div
                  key={highlight}
                  className="rounded-lg bg-secondary-container p-3 text-sm text-on-secondary-container"
                >
                  {highlight}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
