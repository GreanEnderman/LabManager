import JSZip from 'jszip'
import { read, utils } from 'xlsx'
import type {
  ChemicalImportField,
  ChemicalImportRecord,
  EquipmentImportField,
  EquipmentImportRecord,
  ImportEntityType,
  ImportFieldKey,
  ImportFieldOption,
  MaintenanceImportField,
  MaintenanceImportRecord,
  MovementImportField,
  MovementImportRecord,
  ParsedImportDraft,
} from './types'

type ParsedRow = Record<string, string>
type AliasMap = Record<string, string[]>
type ParsedWorkbookSource = { rows: string[][]; sheetName: string }

const chemicalFieldOptions: ImportFieldOption[] = [
  { key: 'id', label: '记录编号', required: true, type: 'text' },
  { key: 'name', label: '名称', required: true, type: 'text' },
  { key: 'casNumber', label: 'CAS', type: 'text' },
  { key: 'category', label: '分类', type: 'text' },
  { key: 'spec', label: '规格', type: 'text' },
  { key: 'currentQuantity', label: '当前库存', required: true, type: 'number' },
  { key: 'threshold', label: '安全阈值', type: 'number' },
  { key: 'status', label: '状态', type: 'text' },
  { key: 'labName', label: '所属实验室', type: 'text' },
  { key: 'ownerName', label: '负责人', type: 'text' },
  { key: 'updatedAt', label: '更新时间', type: 'date' },
  { key: 'imageDataUrl', label: '图片', type: 'text' },
  { key: 'remark', label: '备注', type: 'text' },
]

const equipmentFieldOptions: ImportFieldOption[] = [
  { key: 'id', label: '记录编号', required: true, type: 'text' },
  { key: 'name', label: '名称', required: true, type: 'text' },
  { key: 'vendor', label: '厂商', type: 'text' },
  { key: 'model', label: '型号', type: 'text' },
  { key: 'status', label: '状态', required: true, type: 'text' },
  { key: 'labName', label: '所属实验室', type: 'text' },
  { key: 'ownerName', label: '负责人', type: 'text' },
  { key: 'lastMaintenanceAt', label: '上次维护时间', type: 'date' },
  { key: 'updatedAt', label: '更新时间', type: 'date' },
  { key: 'imageDataUrl', label: '图片', type: 'text' },
  { key: 'remark', label: '备注', type: 'text' },
]

const movementFieldOptions: ImportFieldOption[] = [
  { key: 'id', label: '记录编号', required: true, type: 'text' },
  { key: 'date', label: '业务时间', required: true, type: 'date' },
  { key: 'name', label: '物料名称', required: true, type: 'text' },
  { key: 'type', label: '类型', required: true, type: 'text' },
  { key: 'quantity', label: '数量', required: true, type: 'text' },
  { key: 'operator', label: '经手人', type: 'text' },
  { key: 'reason', label: '原因说明', type: 'text' },
]

const maintenanceFieldOptions: ImportFieldOption[] = [
  { key: 'id', label: '记录编号', required: true, type: 'text' },
  { key: 'equipmentId', label: '设备编号', type: 'text' },
  { key: 'equipmentName', label: '设备名称', required: true, type: 'text' },
  { key: 'status', label: '维护状态', required: true, type: 'text' },
  { key: 'maintenanceAt', label: '维护时间', required: true, type: 'date' },
  { key: 'engineer', label: '维修人', type: 'text' },
  { key: 'summary', label: '维护摘要', type: 'text' },
]

const chemicalHeaderAliases: Record<ChemicalImportField, string[]> = {
  id: ['recordid', 'record_id', 'id', '记录编号', '序号'],
  name: ['name', '名称', '物料名称', '化学品名称', '药品名称'],
  casNumber: ['cas', 'casnumber', 'casno', 'cas编号', 'cas号', 'cas number', 'CAS', 'CAS号', 'CAS编号'],
  category: ['category', '分类', '物理特性'],
  spec: ['spec', '规格', '规格型号', '规格重量ml（g）/瓶', '规格重量 ml（g）/瓶', '规格重量ml(g)/瓶'],
  currentQuantity: ['currentquantity', 'current_quantity', 'quantity', 'stock', '当前库存', '当前数量', '数量', '库存'],
  threshold: ['threshold', '安全阈值', '阈值', '预警阈值'],
  status: ['status', '状态', '使用状态', '使用状态（开封/未开封）', '使用状态(开封/未开封)'],
  labName: ['labname', 'lab_name', 'lab', '所属实验室', '实验室'],
  ownerName: ['ownername', 'owner_name', 'owner', '负责人', '责任人'],
  updatedAt: ['updatedat', 'updated_at', '更新时间', '开封日期', '采购日期', '使用日期'],
  imageDataUrl: ['image', 'imagedataurl', '图片', '图片链接', '图片地址'],
  remark: ['remark', 'notes', '备注', '图片/备注'],
}

const equipmentHeaderAliases: Record<EquipmentImportField, string[]> = {
  id: ['recordid', 'record_id', 'id', '记录编号', '编号'],
  name: ['name', '名称', '设备名称'],
  vendor: ['vendor', 'supplier', '厂商', '供应商'],
  model: ['model', '型号', '规格型号'],
  status: ['status', '状态'],
  labName: ['labname', 'lab_name', 'lab', '所属实验室', '实验室'],
  ownerName: ['ownername', 'owner_name', 'owner', '负责人', '责任人'],
  lastMaintenanceAt: ['lastmaintenanceat', 'last_maintenance_at', 'maintenanceat', '上次维护时间', '最近维护时间', '维护时间'],
  updatedAt: ['updatedat', 'updated_at', '更新时间', '上次维护时间'],
  imageDataUrl: ['image', 'imagedataurl', '图片', '图片链接', '图片地址'],
  remark: ['remark', 'notes', '备注'],
}

const movementHeaderAliases: Record<MovementImportField, string[]> = {
  id: ['recordid', 'record_id', 'id', '记录编号', '序号'],
  date: ['date', '业务时间', '时间', '出入库时间', '采购日期', '使用日期'],
  name: ['name', '名称', '物料名称', '化学品名称', '药品名称'],
  type: ['type', '类型', '操作类型'],
  quantity: ['quantity', '数量', '使用数量'],
  operator: ['operator', '经手人', '操作人'],
  reason: ['reason', '原因', '用途说明', '备注', '用途'],
}

const maintenanceHeaderAliases: Record<MaintenanceImportField, string[]> = {
  id: ['recordid', 'record_id', 'id', '记录编号', '编号'],
  equipmentId: ['equipmentid', 'equipment_id', '设备编号', '编号'],
  equipmentName: ['equipmentname', 'equipment_name', '设备名称', '名称'],
  status: ['status', '状态', '维护状态'],
  maintenanceAt: ['maintenanceat', 'maintenance_at', '维护时间', '维修时间', '上次维护时间'],
  engineer: ['engineer', '维修人', '工程师', '负责人'],
  summary: ['summary', '维护摘要', '维修摘要', '说明', '备注'],
}

export function getImportFieldOptions(entityType: ImportEntityType): ImportFieldOption[] {
  switch (entityType) {
    case 'chemical':
      return chemicalFieldOptions
    case 'equipment':
      return equipmentFieldOptions
    case 'movement':
      return movementFieldOptions
    default:
      return maintenanceFieldOptions
  }
}

function getAliasMap(entityType: ImportEntityType): AliasMap {
  switch (entityType) {
    case 'chemical':
      return chemicalHeaderAliases
    case 'equipment':
      return equipmentHeaderAliases
    case 'movement':
      return movementHeaderAliases
    default:
      return maintenanceHeaderAliases
  }
}

function normalizeHeader(value: string) {
  return value
    .replace(/\uFEFF/g, '')
    .replace(/\n/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_()（）/\\-]+/g, '')
}

function inferMovementType(sheetName: string) {
  if (sheetName.includes('采购')) return '入库'
  if (sheetName.includes('领用')) return '出库'
  return ''
}

function parseDelimitedText(input: string): string[][] {
  const text = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && (char === ',' || char === '\t')) {
      row.push(cell.trim())
      cell = ''
      continue
    }
    if (!inQuotes && char === '\n') {
      row.push(cell.trim())
      if (row.some((item) => item.length > 0)) rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += char
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim())
    if (row.some((item) => item.length > 0)) rows.push(row)
  }

  return rows
}

function stripTrailingEmptyCells(row: string[]) {
  const cloned = [...row]
  while (cloned.length > 0 && !String(cloned[cloned.length - 1] ?? '').trim()) {
    cloned.pop()
  }
  return cloned
}

function chooseHeaderRowIndex(rows: string[][], entityType: ImportEntityType) {
  const aliasMap = getAliasMap(entityType)
  const candidates = rows.slice(0, 5)
  let bestIndex = 0
  let bestScore = -1

  candidates.forEach((row, index) => {
    const cells = stripTrailingEmptyCells(row)
    const nonEmptyCount = cells.filter((cell) => String(cell).trim()).length
    const matchedCount = cells.filter((cell) => {
      const normalized = normalizeHeader(String(cell))
      return Object.values(aliasMap).some((aliases) => aliases.some((alias) => normalizeHeader(alias) === normalized))
    }).length
    const score = matchedCount * 10 + nonEmptyCount
    if (matchedCount > 0 && score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })

  return bestIndex
}

function toRowObjects(headerRow: string[], bodyRows: string[][]): ParsedRow[] {
  if (headerRow.length === 0) return []
  return bodyRows.map((cells) => {
    const result: ParsedRow = {}
    headerRow.forEach((_, index) => {
      result[`col_${index}`] = (cells[index] ?? '').trim()
    })
    return result
  })
}

function toStringCell(value: unknown) {
  if (value == null) return ''
  if (typeof value === 'number' && Number.isFinite(value)) return Number.isInteger(value) ? String(value) : `${value}`
  return String(value).trim()
}

function parseWorkbookRows(buffer: ArrayBuffer): ParsedWorkbookSource {
  const workbook = read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return { rows: [], sheetName: '' }
  const sheet = workbook.Sheets[firstSheetName]
  return {
    sheetName: firstSheetName,
    rows: utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: false, defval: '' }).map((row) => row.map((cell) => toStringCell(cell))),
  }
}

function normalizeZipPath(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/^\//, '')
  const parts = normalized.split('/')
  const resolved: string[] = []
  parts.forEach((part) => {
    if (!part || part === '.') return
    if (part === '..') {
      resolved.pop()
      return
    }
    resolved.push(part)
  })
  return resolved.join('/')
}

function resolveZipTarget(basePath: string, target: string) {
  if (!target) return ''
  if (target.startsWith('/')) return normalizeZipPath(target)
  const baseParts = normalizeZipPath(basePath).split('/')
  baseParts.pop()
  return normalizeZipPath([...baseParts, target].join('/'))
}

function inferImageMimeType(path: string) {
  const extension = path.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'bmp':
      return 'image/bmp'
    default:
      return 'application/octet-stream'
  }
}

async function readZipText(zip: JSZip, path: string) {
  const file = zip.file(path)
  return file ? await file.async('text') : ''
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getXmlAttribute(tag: string, attributeName: string) {
  const match = tag.match(new RegExp(`(?:^|\\s)${escapeRegExp(attributeName)}=(["'])(.*?)\\1`, 'i'))
  return match?.[2] ?? ''
}

function getRelationshipTags(xmlText: string) {
  return xmlText.match(/<[^>]*Relationship\b[^>]*\/?>/gi) ?? []
}

function getRelationshipTarget(xmlText: string, relationshipId: string) {
  if (!relationshipId) return ''
  const relationship = getRelationshipTags(xmlText).find((tag) => getXmlAttribute(tag, 'Id') === relationshipId)
  return relationship ? getXmlAttribute(relationship, 'Target') : ''
}

function getRelationshipTargetByType(xmlText: string, typeSuffix: string) {
  const relationship = getRelationshipTags(xmlText).find((tag) => getXmlAttribute(tag, 'Type').endsWith(typeSuffix))
  return relationship ? getXmlAttribute(relationship, 'Target') : ''
}

function getSheetRelationshipId(workbookXml: string, sheetName: string) {
  const sheetTags = workbookXml.match(/<sheet\b[^>]*\/?>/g) ?? []
  for (const tag of sheetTags) {
    const name = (tag.match(/\bname="([^"]+)"/i) ?? [])[1] ?? ''
    if (name !== sheetName) continue
    return (tag.match(/r:id="([^"]+)"/i) ?? tag.match(/relationships:id="([^"]+)"/i) ?? [])[1] ?? ''
  }
  return ''
}

function extractAnchors(drawingXml: string) {
  const anchors: Array<{ row: number; embedId: string }> = []
  const matches = drawingXml.matchAll(
    /<(?:\w+:)?(?:twoCellAnchor|oneCellAnchor)\b[\s\S]*?<(?:\w+:)?from\b>[\s\S]*?<(?:\w+:)?row\b>(\d+)<\/(?:\w+:)?row>[\s\S]*?<(?:\w+:)?blip\b[^>]*(?:r:embed|embed)=(["'])(.*?)\2[\s\S]*?<\/(?:\w+:)?(?:twoCellAnchor|oneCellAnchor)>/g,
  )

  for (const match of matches) {
    anchors.push({
      row: Number(match[1]),
      embedId: match[3],
    })
  }

  return anchors
}

async function extractEmbeddedRowImages(buffer: ArrayBuffer, sheetName: string) {
  const zip = await JSZip.loadAsync(buffer)
  const workbookXml = await readZipText(zip, 'xl/workbook.xml')
  const workbookRelsXml = await readZipText(zip, 'xl/_rels/workbook.xml.rels')
  if (!workbookXml || !workbookRelsXml) return new Map<number, string>()

  const sheetRelationshipId = getSheetRelationshipId(workbookXml, sheetName)
  if (!sheetRelationshipId) return new Map<number, string>()

  const worksheetPath = resolveZipTarget('xl/workbook.xml', getRelationshipTarget(workbookRelsXml, sheetRelationshipId))
  if (!worksheetPath) return new Map<number, string>()

  const worksheetRelsPath = resolveZipTarget(worksheetPath, `_rels/${worksheetPath.split('/').pop()}.rels`)
  const worksheetRelsXml = await readZipText(zip, worksheetRelsPath)
  if (!worksheetRelsXml) return new Map<number, string>()

  const drawingTarget = getRelationshipTargetByType(worksheetRelsXml, '/drawing')
  if (!drawingTarget) return new Map<number, string>()

  const drawingPath = resolveZipTarget(worksheetPath, drawingTarget)
  const drawingXml = await readZipText(zip, drawingPath)
  if (!drawingXml) return new Map<number, string>()

  const drawingRelsPath = resolveZipTarget(drawingPath, `_rels/${drawingPath.split('/').pop()}.rels`)
  const drawingRelsXml = await readZipText(zip, drawingRelsPath)
  if (!drawingRelsXml) return new Map<number, string>()

  const rowImages = new Map<number, string>()
  for (const anchor of extractAnchors(drawingXml)) {
    if (rowImages.has(anchor.row)) continue

    const targetPath = resolveZipTarget(drawingPath, getRelationshipTarget(drawingRelsXml, anchor.embedId))
    if (!targetPath || !Number.isFinite(anchor.row)) continue

    const imageFile = zip.file(targetPath)
    if (!imageFile) continue

    const base64 = await imageFile.async('base64')
    rowImages.set(anchor.row, `data:${inferImageMimeType(targetPath)};base64,${base64}`)
  }

  return rowImages
}

function getSuggestedField(header: string, entityType: ImportEntityType): ImportFieldKey | null {
  const normalized = normalizeHeader(header)
  const aliasMap = getAliasMap(entityType)
  for (const [field, aliases] of Object.entries(aliasMap)) {
    if (aliases.some((alias) => normalizeHeader(alias) === normalized)) return field as ImportFieldKey
  }
  return null
}

function parseOptionalNumber(value: string) {
  const normalized = value.trim()
  if (!normalized) return 0
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export async function parseImportFile(file: File, entityType: ImportEntityType): Promise<ParsedImportDraft> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !['csv', 'txt', 'xlsx'].includes(extension)) throw new Error('Only CSV, TXT, and XLSX files are supported.')

  let parsedSource: ParsedWorkbookSource
  let embeddedRowImages = new Map<number, string>()

  if (extension === 'xlsx') {
    const buffer = await file.arrayBuffer()
    parsedSource = parseWorkbookRows(buffer)
    if (entityType === 'chemical' || entityType === 'equipment') {
      embeddedRowImages = await extractEmbeddedRowImages(buffer, parsedSource.sheetName)
    }
  } else {
    parsedSource = { rows: parseDelimitedText(await file.text()), sheetName: '' }
  }

  const matrix = parsedSource.rows.map(stripTrailingEmptyCells).filter((row) => row.some((cell) => String(cell).trim().length > 0))
  if (matrix.length === 0) throw new Error('No readable data rows were found in the uploaded file.')

  const headerRowIndex = chooseHeaderRowIndex(matrix, entityType)
  const headerRow = matrix[headerRowIndex] ?? []
  const bodyRows = matrix.slice(headerRowIndex + 1)
  if (headerRow.length === 0) throw new Error('No readable header row was found in the uploaded file.')

  const rows = toRowObjects(headerRow, bodyRows).filter((row) => Object.values(row).some((value) => value.trim().length > 0))
  if (rows.length === 0) throw new Error('No readable data rows were found below the header row.')

  if (embeddedRowImages.size > 0) {
    rows.forEach((row, index) => {
      const physicalRowIndex = headerRowIndex + 1 + index
      const imageDataUrl = embeddedRowImages.get(physicalRowIndex)
      if (imageDataUrl) {
        row.__embedded_image = imageDataUrl
      }
    })
  }

  const columns = headerRow.map((header, index) => ({
    sourceKey: `col_${index}`,
    header: String(header || `Column ${index + 1}`).trim() || `Column ${index + 1}`,
    sampleValue: String(bodyRows[0]?.[index] ?? '').trim(),
    matchedField:
      entityType === 'movement' && normalizeHeader(String(header || '')) === '' && inferMovementType(parsedSource.sheetName)
        ? 'type'
        : getSuggestedField(String(header || ''), entityType),
  }))

  const firstImageRow = rows.find((row) => row.__embedded_image)
  if (firstImageRow && (entityType === 'chemical' || entityType === 'equipment')) {
    columns.push({
      sourceKey: '__embedded_image',
      header: '内嵌图片',
      sampleValue: '[已识别内嵌图片]',
      matchedField: 'imageDataUrl',
    })
  }

  return {
    rows,
    columns,
  }
}

function getMappedValue(row: ParsedRow, mapping: Record<string, ImportFieldKey | null>, targetField: ImportFieldKey) {
  const entries = Object.entries(mapping).filter(([, mappedField]) => mappedField === targetField)
  const nonEmptyEntry = entries.find(([sourceKey]) => (row[sourceKey] ?? '').trim().length > 0)
  const entry = nonEmptyEntry ?? entries[0]
  return entry ? row[entry[0]] ?? '' : ''
}

function buildChemicalRecords(draft: ParsedImportDraft, mapping: Record<string, ImportFieldKey | null>): ChemicalImportRecord[] {
  let lastName = ''
  let lastCasNumber = ''
  let lastCategory = ''
  let lastSpec = ''
  let lastImageDataUrl = ''

  return draft.rows.map((row, index) => {
    const nextName = getMappedValue(row, mapping, 'name') || lastName
    const nextCasNumber = getMappedValue(row, mapping, 'casNumber') || lastCasNumber
    const nextCategory = getMappedValue(row, mapping, 'category') || lastCategory
    const nextSpec = getMappedValue(row, mapping, 'spec') || lastSpec
    const nextImageDataUrl = getMappedValue(row, mapping, 'imageDataUrl') || lastImageDataUrl

    lastName = nextName || lastName
    lastCasNumber = nextCasNumber || lastCasNumber
    lastCategory = nextCategory || lastCategory
    lastSpec = nextSpec || lastSpec
    lastImageDataUrl = nextImageDataUrl || lastImageDataUrl

    return {
      id: getMappedValue(row, mapping, 'id') || `chem-upload-${index + 1}`,
      name: nextName,
      casNumber: nextCasNumber,
      category: nextCategory,
      spec: nextSpec,
      currentQuantity: parseOptionalNumber(getMappedValue(row, mapping, 'currentQuantity')),
      threshold: parseOptionalNumber(getMappedValue(row, mapping, 'threshold')),
      status: getMappedValue(row, mapping, 'status') || 'normal',
      labName: getMappedValue(row, mapping, 'labName'),
      ownerName: getMappedValue(row, mapping, 'ownerName'),
      updatedAt: getMappedValue(row, mapping, 'updatedAt'),
      imageDataUrl: nextImageDataUrl,
      remark: getMappedValue(row, mapping, 'remark'),
    }
  })
}

function buildEquipmentRecords(draft: ParsedImportDraft, mapping: Record<string, ImportFieldKey | null>): EquipmentImportRecord[] {
  let lastImageDataUrl = ''

  return draft.rows.map((row, index) => {
    const nextImageDataUrl = getMappedValue(row, mapping, 'imageDataUrl') || lastImageDataUrl
    lastImageDataUrl = nextImageDataUrl || lastImageDataUrl

    return {
      id: getMappedValue(row, mapping, 'id') || `equipment-upload-${index + 1}`,
      name: getMappedValue(row, mapping, 'name'),
      vendor: getMappedValue(row, mapping, 'vendor'),
      model: getMappedValue(row, mapping, 'model'),
      status: getMappedValue(row, mapping, 'status'),
      labName: getMappedValue(row, mapping, 'labName'),
      ownerName: getMappedValue(row, mapping, 'ownerName'),
      lastMaintenanceAt: getMappedValue(row, mapping, 'lastMaintenanceAt'),
      updatedAt: getMappedValue(row, mapping, 'updatedAt'),
      imageDataUrl: nextImageDataUrl,
      remark: getMappedValue(row, mapping, 'remark'),
    }
  })
}

function buildMovementRecords(
  draft: ParsedImportDraft,
  mapping: Record<string, ImportFieldKey | null>,
  inferredType: string,
): MovementImportRecord[] {
  let lastDate = ''

  return draft.rows.map((row, index) => {
    const nextDate = getMappedValue(row, mapping, 'date') || lastDate
    lastDate = nextDate || lastDate

    return {
      id: getMappedValue(row, mapping, 'id') || `movement-upload-${index + 1}`,
      date: nextDate,
      name: getMappedValue(row, mapping, 'name'),
      type: getMappedValue(row, mapping, 'type') || inferredType,
      quantity: getMappedValue(row, mapping, 'quantity'),
      operator: getMappedValue(row, mapping, 'operator'),
      reason: getMappedValue(row, mapping, 'reason'),
    }
  })
}

export function buildRecordsFromMapping(
  draft: ParsedImportDraft,
  mapping: Record<string, ImportFieldKey | null>,
  entityType: ImportEntityType,
): Array<ChemicalImportRecord | EquipmentImportRecord | MovementImportRecord | MaintenanceImportRecord> {
  switch (entityType) {
    case 'chemical':
      return buildChemicalRecords(draft, mapping)
    case 'equipment':
      return buildEquipmentRecords(draft, mapping)
    case 'movement':
      return buildMovementRecords(draft, mapping, '')
    default:
      return draft.rows.map((row, index) => ({
        id: getMappedValue(row, mapping, 'id') || `maintenance-upload-${index + 1}`,
        equipmentId: getMappedValue(row, mapping, 'equipmentId'),
        equipmentName: getMappedValue(row, mapping, 'equipmentName'),
        status: getMappedValue(row, mapping, 'status'),
        maintenanceAt: getMappedValue(row, mapping, 'maintenanceAt'),
        engineer: getMappedValue(row, mapping, 'engineer') || '系统导入',
        summary: getMappedValue(row, mapping, 'summary'),
      }))
  }
}

export function buildTemplateCsv(entityType: ImportEntityType) {
  switch (entityType) {
    case 'chemical':
      return [
        '序号,名称,CAS,规格重量ml（g）/瓶,物理特性,使用状态（开封/未开封）,数量,生产批号,开封日期,保质期,图片/备注',
        '1,氯化钙，二水,10035-04-8,500g,固体,开封,1,20210425,20240229,20240425,首行样例',
      ].join('\n')
    case 'equipment':
      return [
        '编号,名称,供应商,型号,图片,状态,上次维护时间,备注',
        '1,超净工作台,力辰科技,SW-CJ-1D,,正常,2025.3,例行维护',
      ].join('\n')
    case 'movement':
      return [
        '序号,采购日期,名称,数量,生产批号,保质期,图片/备注',
        '1,臭氧测定试剂盒,2025.10.13,1,20250801,20270801,采购记录样例',
      ].join('\n')
    default:
      return [
        '编号,名称,状态,上次维护时间,备注',
        '1,超净工作台,正常,2025.3,例行维护完成',
      ].join('\n')
  }
}
