import { readFileSync } from 'node:fs'
import * as fontkit from '@pdf-lib/fontkit'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { ExportReportPdfResponse } from '../contracts/shared'
import type { AIReportRecord } from '../domain/models'
import { EntityNotFoundError } from './errors'
import type { AIRepository } from './repositories'

interface ReportExportServiceDependencies {
  repository: AIRepository
}

const WINDOWS_CJK_FONT_CANDIDATES = [
  'C:\\Windows\\Fonts\\simhei.ttf',
  'C:\\Windows\\Fonts\\simkai.ttf',
  'C:\\Windows\\Fonts\\simsunb.ttf',
]

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase()
}

function pickFontBytes() {
  for (const path of WINDOWS_CJK_FONT_CANDIDATES) {
    try {
      return readFileSync(path)
    } catch {
      // Try the next candidate.
    }
  }

  return null
}

function buildReportParagraphs(report: AIReportRecord) {
  const sections = Array.isArray(report.metadata.sections)
    ? (report.metadata.sections as Array<{ title?: unknown; content?: unknown }>)
    : []

  return [
    { kind: 'meta' as const, text: report.createdAt },
    { kind: 'heading' as const, text: '摘要' },
    { kind: 'body' as const, text: report.summary },
    { kind: 'heading' as const, text: '重点结论' },
    ...report.highlights.map((highlight) => ({ kind: 'bullet' as const, text: highlight })),
    ...sections.flatMap((section) => {
      if (!section || typeof section !== 'object') {
        return []
      }

      return [
        { kind: 'heading' as const, text: String(section.title ?? '章节') },
        { kind: 'body' as const, text: String(section.content ?? '') },
      ]
    }),
  ]
}

export class ReportExportService {
  constructor(private readonly deps: ReportExportServiceDependencies) {}

  async exportPdf(reportId: string): Promise<ExportReportPdfResponse> {
    const report = this.deps.repository.reports.get(reportId)
    if (!report) {
      throw new EntityNotFoundError('Report', reportId)
    }

    const pdf = await PDFDocument.create()
    pdf.registerFontkit(fontkit)

    const fontBytes = pickFontBytes()
    let page = pdf.addPage([595.28, 841.89])
    const titleFont = fontBytes ? await pdf.embedFont(fontBytes) : await pdf.embedFont(StandardFonts.HelveticaBold)
    const bodyFont = fontBytes ? await pdf.embedFont(fontBytes) : await pdf.embedFont(StandardFonts.Helvetica)
    const pageWidth = page.getWidth()
    const pageHeight = page.getHeight()
    const margin = 48
    let cursorY = pageHeight - margin

    const ensureSpace = (requiredHeight: number) => {
      if (cursorY - requiredHeight >= margin) {
        return
      }

      page = pdf.addPage([595.28, 841.89])
      cursorY = page.getHeight() - margin
    }

    const writeLine = (text: string, options: { size: number; font: typeof bodyFont; color?: ReturnType<typeof rgb> }) => {
      const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, ' ').trim() || '(empty)'
      page.drawText(normalized, {
        x: margin,
        y: cursorY,
        size: options.size,
        font: options.font,
        color: options.color ?? rgb(0.12, 0.16, 0.22),
        maxWidth: pageWidth - margin * 2,
        lineHeight: options.size * 1.45,
      })

      const estimatedLines = Math.max(1, Math.ceil((normalized.length * options.size) / (pageWidth - margin * 2 + 80)))
      cursorY -= estimatedLines * options.size * 1.45
    }

    ensureSpace(80)
    writeLine('LABMANAGER AI REPORT', { size: 12, font: bodyFont, color: rgb(0.38, 0.46, 0.6) })
    cursorY -= 6
    ensureSpace(40)
    writeLine(report.title, { size: 26, font: titleFont })
    cursorY -= 12

    buildReportParagraphs(report).forEach((paragraph) => {
      const size = paragraph.kind === 'heading' ? 16 : paragraph.kind === 'meta' ? 11 : 12
      const font = paragraph.kind === 'heading' ? titleFont : bodyFont
      const prefix = paragraph.kind === 'bullet' ? '• ' : ''
      ensureSpace(size * 3)
      writeLine(`${prefix}${paragraph.text}`, {
        size,
        font,
        color: paragraph.kind === 'meta' ? rgb(0.38, 0.46, 0.6) : rgb(0.12, 0.16, 0.22),
      })
      cursorY -= paragraph.kind === 'heading' ? 8 : 4
    })

    const contentBase64 = await pdf.saveAsBase64()

    return {
      fileName: `${sanitizeFileName(report.title) || report.id}.pdf`,
      mimeType: 'application/pdf',
      contentBase64,
    }
  }
}
