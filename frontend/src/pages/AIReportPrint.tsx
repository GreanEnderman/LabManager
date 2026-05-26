import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useAI } from '../ai/AIStateLive'
import { aiAppClient } from '../runtime/aiAppFacadeAsync'

function downloadBase64File(fileName: string, mimeType: string, contentBase64: string) {
  const link = document.createElement('a')
  link.href = `data:${mimeType};base64,${contentBase64}`
  link.download = fileName
  link.click()
}

export default function AIReportPrint() {
  const { reportId } = useParams()
  const { reports } = useAI()
  const report = useMemo(() => reports.find((item) => item.id === reportId), [reportId, reports])

  if (!report) {
    return (
      <div className="min-h-screen bg-white p-10 text-slate-900">
        <h1 className="text-2xl font-semibold">未找到报告</h1>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-10 text-slate-900 print:p-6">
      <style>{`@media print { .no-print { display: none; } body { background: white; } }`}</style>
      <div className="no-print mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">报告打印视图</h1>
          <p className="mt-1 text-sm text-slate-600">可直接打印，也可下载正式 PDF 文件。</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
            打印 / 导出
          </button>
          <button
            onClick={async () => {
              const pdf = await aiAppClient.exportReportPdf(report.id)
              downloadBase64File(pdf.fileName, pdf.mimeType, pdf.contentBase64)
            }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
          >
            下载 PDF
          </button>
        </div>
      </div>

      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="border-b border-slate-200 pb-6">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-500">LabManager AI Report</p>
          <h1 className="mt-3 text-3xl font-semibold">{report.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{report.createdAt}</p>
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">摘要</h2>
          <p className="mt-3 leading-7 text-slate-700">{report.summary}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">重点结论</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {report.highlights.map((highlight) => (
              <div key={highlight} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {highlight}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 space-y-4">
          {(report.sections ?? []).map((section) => (
            <div key={section.title} className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-medium">{section.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-700">{section.content}</p>
            </div>
          ))}
        </section>
      </article>
    </div>
  )
}
