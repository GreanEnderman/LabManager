import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useRole } from '../auth/RoleContext'
import { createEmptyChemicalRow, createEmptyEquipmentRow } from '../imports/domain'
import {
  buildRecordsFromMapping,
  buildTemplateCsv,
  getImportFieldOptions,
  parseImportFile,
} from '../imports/fileImport'
import { useImports } from '../imports/ImportContextLive'
import { formatLocalDateTime } from '../runtime/dateTime'
import type {
  ChemicalImportRecord,
  EquipmentImportRecord,
  ImportBatchRecord,
  ImportEntityType,
  ImportFieldKey,
  ImportSource,
  MaintenanceImportRecord,
  MovementImportRecord,
  ParsedImportDraft,
} from '../imports/types'

type DraftRow = ChemicalImportRecord | EquipmentImportRecord | MovementImportRecord | MaintenanceImportRecord

const importStatusLabel: Record<ImportBatchRecord['status'], string> = {
  completed: '导入成功',
  partial_failed: '部分失败',
  failed: '导入失败',
}

const importStatusTone: Record<ImportBatchRecord['status'], string> = {
  completed: 'bg-secondary-container text-on-secondary-container',
  partial_failed: 'bg-tertiary-container text-on-tertiary-container',
  failed: 'bg-error-container text-error',
}

const entityLabelMap: Record<ImportEntityType, string> = {
  chemical: '化学品',
  equipment: '仪器设备',
  movement: '化学品出入库',
  maintenance: '设备维护记录',
}

const importedByLabelMap = {
  admin: '系统管理员',
  manager: '实验室主管',
  operator: '执行人员',
  viewer: '只读访客',
} as const

const previewColumns: Record<ImportEntityType, Array<{ key: string; label: string; type?: 'number' }>> = {
  chemical: [
    { key: 'id', label: '记录 ID' },
    { key: 'name', label: '名称' },
    { key: 'casNumber', label: 'CAS' },
    { key: 'spec', label: '规格重量 ml（g）/瓶' },
    { key: 'category', label: '物理特性' },
    { key: 'status', label: '使用状态' },
    { key: 'currentQuantity', label: '当前库存', type: 'number' },
    { key: 'batchNumber', label: '生产批号' },
    { key: 'openedAt', label: '开封日期' },
    { key: 'expiryDate', label: '保质期' },
    { key: 'remark', label: '图片/备注' },
    { key: 'threshold', label: '阈值', type: 'number' },
  ],
  equipment: [
    { key: 'id', label: '记录 ID' },
    { key: 'name', label: '名称' },
    { key: 'vendor', label: '厂商' },
    { key: 'model', label: '型号' },
    { key: 'status', label: '状态' },
    { key: 'ownerName', label: '负责人' },
  ],
  movement: [
    { key: 'id', label: '记录 ID' },
    { key: 'date', label: '业务时间' },
    { key: 'name', label: '物料名称' },
    { key: 'type', label: '类型' },
    { key: 'quantity', label: '数量' },
    { key: 'operator', label: '经手人' },
    { key: 'reason', label: '原因' },
  ],
  maintenance: [
    { key: 'id', label: '记录 ID' },
    { key: 'equipmentId', label: '设备编号' },
    { key: 'equipmentName', label: '设备名称' },
    { key: 'status', label: '维护状态' },
    { key: 'maintenanceAt', label: '维护时间' },
    { key: 'engineer', label: '维修人' },
    { key: 'summary', label: '维护摘要' },
  ],
}

const importRequirementCopy: Record<ImportEntityType, string> = {
  chemical:
    '记录 ID、名称、当前库存必填；规格、物理特性、使用状态、生产批号、开封日期、保质期、图片/备注可按实际补充；当前库存和安全阈值需为非负数字；状态留空时按库存与阈值自动判断；如填写图片或上传内嵌图片，会统一映射到图片字段。',
  equipment:
    '记录 ID、名称、状态必填；厂商、型号、负责人可按台账填写；上次维护时间和更新时间建议使用完整日期时间；状态请保持与设备台账一致；如填写图片，请提供可访问的图片地址。',
  movement:
    '物料名称输入后从库存候选中选择；类型选择入库/出库；数量需为大于 0 的数字；业务时间年月日必填，时分秒可不填；经手人和原因不能为空。',
  maintenance:
    '记录 ID、设备名称、维护状态、维护时间必填；设备编号建议与设备台账保持一致；维护时间请填写完整年月日，必要时补充时分秒；维修人和维护摘要建议补全，便于后续追踪与审计。',
}

function buildEmptyRow(entityType: ImportEntityType): DraftRow {
  switch (entityType) {
    case 'chemical':
      return createEmptyChemicalRow()
    case 'equipment':
      return createEmptyEquipmentRow()
    case 'movement':
      return { id: `movement-${Date.now()}`, date: '', name: '', type: '入库', quantity: '', operator: '', reason: '' }
    default:
      return { id: `maintenance-${Date.now()}`, equipmentId: '', equipmentName: '', status: '已维护', maintenanceAt: '', engineer: '', summary: '' }
  }
}

function buildMappingState(parsedDraft: ParsedImportDraft) {
  return parsedDraft.columns.reduce<Record<string, ImportFieldKey | null>>((accumulator, column) => {
    accumulator[column.sourceKey] = column.matchedField
    return accumulator
  }, {})
}

function hasRequiredMapping(entityType: ImportEntityType, mapping: Record<string, ImportFieldKey | null>) {
  const requiredFields = getImportFieldOptions(entityType).filter((item) => item.required)
  return requiredFields.every((item) => Object.values(mapping).includes(item.key))
}

function getPreviewImage(row: DraftRow, entityType: ImportEntityType) {
  if (entityType !== 'chemical' && entityType !== 'equipment') return ''
  return 'imageDataUrl' in row ? row.imageDataUrl : ''
}

function formatImportError(error: ImportBatchRecord['errors'][number]) {
  const rowLabel = error.rowNumber > 0 ? `第 ${error.rowNumber} 行` : '未知行'
  return `${rowLabel}：${error.message || '导入失败，未返回具体错误信息。'}`
}

function getMovementDateParts(value: string) {
  const match = value.match(/^(\d{0,4})-?(\d{0,2})-?(\d{0,2})(?:[ T](\d{0,2}):?(\d{0,2}):?(\d{0,2}))?/)
  return {
    year: match?.[1] ?? '',
    month: match?.[2] ?? '',
    day: match?.[3] ?? '',
    hour: match?.[4] ?? '',
    minute: match?.[5] ?? '',
    second: match?.[6] ?? '',
  }
}

function buildMovementDate(parts: ReturnType<typeof getMovementDateParts>) {
  const date = [parts.year, parts.month, parts.day].join('-')
  const hasDate = parts.year || parts.month || parts.day
  const hasTime = parts.hour || parts.minute || parts.second
  if (!hasDate) return ''
  if (!hasTime) return date
  return `${date} ${parts.hour || '00'}:${parts.minute || '00'}:${parts.second || '00'}`
}

function getValidEntityType(value: string | null): ImportEntityType {
  if (value === 'chemical' || value === 'equipment' || value === 'movement' || value === 'maintenance') {
    return value
  }
  return 'chemical'
}

export default function DataImportCenter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialEntityType = getValidEntityType(searchParams.get('entityType'))
  const { role, can } = useRole()
  const canCreateImports = can('imports:create')
  const {
    isLoading,
    isSubmitting,
    batches,
    chemicals,
    equipment,
    movements,
    maintenanceRecords,
    importChemicals,
    importEquipment,
    importMovements,
    importMaintenanceRecords,
  } = useImports()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [entityType, setEntityType] = useState<ImportEntityType>(() => initialEntityType)
  const [source, setSource] = useState<ImportSource>('manual')
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [lastBatch, setLastBatch] = useState<ImportBatchRecord | null>(null)
  const [draftRows, setDraftRows] = useState<DraftRow[]>(() => [buildEmptyRow(initialEntityType)])
  const [parsedImportDraft, setParsedImportDraft] = useState<ParsedImportDraft | null>(null)
  const [columnMapping, setColumnMapping] = useState<Record<string, ImportFieldKey | null>>({})
  const [openChemicalSearchRow, setOpenChemicalSearchRow] = useState<number | null>(null)

  const visibleBatches = useMemo(() => batches.filter((batch) => batch.entityType === entityType), [batches, entityType])
  const currentRecords = entityType === 'chemical' ? chemicals : entityType === 'equipment' ? equipment : entityType === 'movement' ? movements : maintenanceRecords
  const fieldOptions = useMemo(() => getImportFieldOptions(entityType), [entityType])
  const columns = previewColumns[entityType]
  const mappingReady = parsedImportDraft ? hasRequiredMapping(entityType, columnMapping) : true
  const canSubmitCurrentMode = source === 'manual' || Boolean(parsedImportDraft && mappingReady)
  const latestSuccessfulBatch = useMemo(
    () =>
      lastBatch?.entityType === entityType && lastBatch.successCount > 0
        ? lastBatch
        : visibleBatches.find((batch) => batch.successCount > 0) ?? null,
    [entityType, lastBatch, visibleBatches],
  )
  const recentSuccessfulRecords = useMemo(() => {
    const recordById = new Map(currentRecords.map((record) => [(record as { id: string }).id, record]))
    const recordsFromLatestBatch =
      latestSuccessfulBatch?.importedRecordIds
        .map((recordId) => recordById.get(recordId))
        .filter((record): record is DraftRow => Boolean(record)) ?? []

    return (recordsFromLatestBatch.length > 0 ? recordsFromLatestBatch : currentRecords).slice(0, 6)
  }, [currentRecords, latestSuccessfulBatch])

  function resetDraftRows(nextEntityType: ImportEntityType) {
    setDraftRows([buildEmptyRow(nextEntityType)])
  }

  function resetImportSession(nextEntityType: ImportEntityType, options?: { preserveLastBatch?: boolean }) {
    setFileName('')
    setFileError(null)
    if (!options?.preserveLastBatch) setLastBatch(null)
    setParsedImportDraft(null)
    setColumnMapping({})
    setOpenChemicalSearchRow(null)
    resetDraftRows(nextEntityType)
  }

  function handleEntityTypeChange(nextEntityType: ImportEntityType) {
    setSearchParams(nextEntityType === 'chemical' ? {} : { entityType: nextEntityType })
    setEntityType(nextEntityType)
    resetImportSession(nextEntityType)
  }

  useEffect(() => {
    const nextEntityType = getValidEntityType(searchParams.get('entityType'))
    if (nextEntityType === entityType) return
    setEntityType(nextEntityType)
    setFileName('')
    setFileError(null)
    setLastBatch(null)
    setParsedImportDraft(null)
    setColumnMapping({})
    setOpenChemicalSearchRow(null)
    resetDraftRows(nextEntityType)
  }, [entityType, searchParams])

  function updateDraftRow(index: number, field: string, value: string) {
    setDraftRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row
        const column = columns.find((item) => item.key === field)
        return { ...row, [field]: column?.type === 'number' ? Number(value) : value }
      }),
    )
  }

  function addDraftRow() {
    setDraftRows((current) => [...current, buildEmptyRow(entityType)])
  }

  function removeDraftRow(index: number) {
    setOpenChemicalSearchRow(null)
    setDraftRows((current) => (current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index)))
  }

  function getChemicalMatches(value: string) {
    const keyword = value.trim().toLowerCase()
    if (!keyword) return chemicals.slice(0, 5)
    return chemicals
      .filter((chemical) => chemical.name.toLowerCase().includes(keyword) || chemical.id.toLowerCase().includes(keyword))
      .slice(0, 5)
  }

  function updateMovementDatePart(index: number, field: keyof ReturnType<typeof getMovementDateParts>, value: string) {
    const sanitized = value.replace(/\D/g, '').slice(0, field === 'year' ? 4 : 2)
    const row = draftRows[index] as MovementImportRecord
    const nextParts = { ...getMovementDateParts(row.date), [field]: sanitized }
    updateDraftRow(index, 'date', buildMovementDate(nextParts))
  }

  function renderMovementInput(row: MovementImportRecord, index: number, column: { key: string; label: string; type?: 'number' }) {
    if (column.key === 'name') {
      const matches = getChemicalMatches(row.name)
      return (
        <div className="relative min-w-[240px]">
          <input
            type="text"
            value={row.name}
            onChange={(event) => {
              setOpenChemicalSearchRow(index)
              updateDraftRow(index, 'name', event.target.value)
            }}
            onFocus={() => {
              if (row.name.trim()) setOpenChemicalSearchRow(index)
            }}
            placeholder="输入名称或记录 ID 搜索"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            disabled={!canCreateImports || isLoading || isSubmitting}
          />
          {row.name.trim() && openChemicalSearchRow === index ? (
            <div className="absolute left-0 top-[calc(100%+4px)] z-[100] max-h-32 w-full overflow-y-auto rounded-lg border border-outline-variant bg-surface text-sm shadow-lg">
              {matches.length > 0 ? (
                matches.map((chemical) => (
                  <button
                    key={chemical.id}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      updateDraftRow(index, 'name', chemical.name)
                      setOpenChemicalSearchRow(null)
                    }}
                    className="block w-full px-3 py-2 text-left text-on-surface transition-colors hover:bg-surface-container-low"
                    disabled={!canCreateImports || isLoading || isSubmitting}
                  >
                    <span className="font-medium">{chemical.name}</span>
                    <span className="ml-2 text-xs text-on-surface-variant">{chemical.id}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-on-surface-variant">未找到匹配物料</p>
              )}
            </div>
          ) : null}
        </div>
      )
    }

    if (column.key === 'type') {
      return (
        <select
          value={row.type}
          onChange={(event) => updateDraftRow(index, 'type', event.target.value)}
          className="w-full min-w-[120px] rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          disabled={!canCreateImports || isLoading || isSubmitting}
        >
          <option value="入库">入库</option>
          <option value="出库">出库</option>
        </select>
      )
    }

    if (column.key === 'date') {
      const parts = getMovementDateParts(row.date)
      return (
        <div className="flex min-w-[360px] flex-wrap items-center gap-2">
          {([
            ['year', '年', 4],
            ['month', '月', 2],
            ['day', '日', 2],
            ['hour', '时', 2],
            ['minute', '分', 2],
            ['second', '秒', 2],
          ] as Array<[keyof typeof parts, string, number]>).map(([field, label, maxLength]) => (
            <label key={field} className="flex items-center gap-1 text-xs text-on-surface-variant">
              <input
                type="text"
                inputMode="numeric"
                value={parts[field]}
                onChange={(event) => updateMovementDatePart(index, field, event.target.value)}
                maxLength={maxLength}
                placeholder={field === 'year' ? '2026' : field === 'hour' || field === 'minute' || field === 'second' ? '可空' : '00'}
                className={`${field === 'year' ? 'w-16' : 'w-12'} rounded-lg border border-outline-variant bg-surface-container-low px-2 py-2 text-sm`}
                disabled={!canCreateImports || isLoading || isSubmitting}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )
    }

    return (
      <input
        type={column.type === 'number' ? 'number' : 'text'}
        value={String((row as unknown as Record<string, unknown>)[column.key] ?? '')}
        onChange={(event) => updateDraftRow(index, column.key, event.target.value)}
        className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
        disabled={!canCreateImports || isLoading || isSubmitting}
      />
    )
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return
    setFileError(null)
    setLastBatch(null)
    setFileName(selectedFile.name)
    try {
      const parsed = await parseImportFile(selectedFile, entityType)
      const suggested = buildMappingState(parsed)
      setParsedImportDraft(parsed)
      setColumnMapping(suggested)
      setDraftRows(buildRecordsFromMapping(parsed, suggested, entityType) as DraftRow[])
    } catch (error) {
      resetDraftRows(entityType)
      setParsedImportDraft(null)
      setColumnMapping({})
      setFileError(error instanceof Error ? error.message : '文件解析失败，请检查上传内容。')
    } finally {
      event.target.value = ''
    }
  }

  function updateColumnMapping(sourceKey: string, value: string) {
    const nextMapping = { ...columnMapping, [sourceKey]: value ? (value as ImportFieldKey) : null }
    setColumnMapping(nextMapping)
    if (parsedImportDraft) setDraftRows(buildRecordsFromMapping(parsedImportDraft, nextMapping, entityType) as DraftRow[])
  }

  function applySuggestedMapping() {
    if (!parsedImportDraft) return
    const suggested = buildMappingState(parsedImportDraft)
    setColumnMapping(suggested)
    setDraftRows(buildRecordsFromMapping(parsedImportDraft, suggested, entityType) as DraftRow[])
  }

  function downloadTemplate() {
    const content = buildTemplateCsv(entityType)
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${entityType}-import-template.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleSubmit() {
    if (!canCreateImports || isSubmitting) return
    if (source === 'excel' && !parsedImportDraft) {
      setFileError('请先选择导入文件。')
      return
    }
    if (source === 'excel' && !mappingReady) {
      setFileError('请先补全必填字段映射，再执行导入。')
      return
    }

    const importedBy = importedByLabelMap[role]
    const file = source === 'excel' ? fileName || `${entityType}.csv` : null
    const batch =
      entityType === 'chemical'
        ? await importChemicals(draftRows as ChemicalImportRecord[], source, file, importedBy)
        : entityType === 'equipment'
          ? await importEquipment(draftRows as EquipmentImportRecord[], source, file, importedBy)
          : entityType === 'movement'
            ? await importMovements(draftRows as MovementImportRecord[], source, file, importedBy)
            : await importMaintenanceRecords(draftRows as MaintenanceImportRecord[], source, file, importedBy)

    setLastBatch(batch)
    if (batch.failureCount === 0) {
      resetImportSession(entityType, { preserveLastBatch: true })
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">数据导入中心</h1>
        </div>
        <div className="grid min-w-[320px] grid-cols-3 gap-3 lg:grid-cols-5">
          <div className="rounded-lg border border-outline-variant bg-surface p-4"><p className="text-sm text-on-surface-variant">导入批次</p><p className="mt-2 text-2xl font-semibold text-on-surface">{batches.length}</p></div>
          <div className="rounded-lg border border-outline-variant bg-surface p-4"><p className="text-sm text-on-surface-variant">化学品</p><p className="mt-2 text-2xl font-semibold text-on-surface">{chemicals.length}</p></div>
          <div className="rounded-lg border border-outline-variant bg-surface p-4"><p className="text-sm text-on-surface-variant">仪器</p><p className="mt-2 text-2xl font-semibold text-on-surface">{equipment.length}</p></div>
          <div className="rounded-lg border border-outline-variant bg-surface p-4"><p className="text-sm text-on-surface-variant">化学品流水</p><p className="mt-2 text-2xl font-semibold text-on-surface">{movements.length}</p></div>
          <div className="rounded-lg border border-outline-variant bg-surface p-4"><p className="text-sm text-on-surface-variant">设备维护</p><p className="mt-2 text-2xl font-semibold text-on-surface">{maintenanceRecords.length}</p></div>
        </div>
      </div>

      <section className="rounded-lg border border-outline-variant bg-surface p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap rounded-lg bg-surface-container-low p-1">
            {(Object.keys(entityLabelMap) as ImportEntityType[]).map((item) => (
              <button key={item} onClick={() => handleEntityTypeChange(item)} className={`rounded-md px-4 py-2 text-sm ${entityType === item ? 'bg-primary text-on-primary' : 'text-on-surface'}`}>{entityLabelMap[item]}</button>
            ))}
          </div>
          <div className="flex rounded-lg bg-surface-container-low p-1">
            {(['manual', 'excel'] as ImportSource[]).map((item) => (
              <button key={item} onClick={() => setSource(item)} className={`rounded-md px-4 py-2 text-sm ${source === item ? 'bg-primary-container text-on-primary-container' : 'text-on-surface'}`}>{item === 'manual' ? '手工录入' : '批量导入'}</button>
            ))}
          </div>
          {source === 'excel' ? (
            <>
              <input ref={fileInputRef} type="file" accept=".csv,.txt,.xlsx" onChange={handleFileSelected} className="hidden" disabled={isLoading || isSubmitting || !canCreateImports} />
              <button onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-outline-variant px-4 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60" disabled={isLoading || isSubmitting || !canCreateImports}>选择导入文件</button>
            </>
          ) : null}
          <button onClick={downloadTemplate} className="rounded-lg border border-outline-variant px-4 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-low">下载模板</button>
        </div>

        {source === 'excel' && (fileError || parsedImportDraft) ? (
          <div className="mt-4 space-y-4 rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-4">
            {fileError ? <p className="text-sm text-error">{fileError}</p> : null}
            {parsedImportDraft ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-sm font-medium text-on-surface">字段映射预览</p><p className="text-sm text-on-surface-variant">共识别 {parsedImportDraft.rows.length} 行、{parsedImportDraft.columns.length} 列。</p></div>
                  <button onClick={applySuggestedMapping} className="rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface transition-colors hover:bg-surface">恢复建议映射</button>
                </div>
                <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface">
                  <table className="w-full">
                    <thead className="bg-surface-container-high text-left text-sm text-on-surface"><tr><th className="px-4 py-3">源列名</th><th className="px-4 py-3">样例值</th><th className="px-4 py-3">映射到系统字段</th></tr></thead>
                    <tbody className="divide-y divide-outline-variant">
                      {parsedImportDraft.columns.map((column) => (
                        <tr key={column.sourceKey}>
                          <td className="px-4 py-3 text-sm text-on-surface">{column.header}</td>
                          <td className="px-4 py-3 text-sm text-on-surface-variant">{column.sampleValue || '-'}</td>
                          <td className="px-4 py-3">
                            <select value={columnMapping[column.sourceKey] ?? ''} onChange={(event) => updateColumnMapping(column.sourceKey, event.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface">
                              <option value="">不导入此列</option>
                              {fieldOptions.map((option) => <option key={option.key} value={option.key}>{option.label}{option.required ? ' *' : ''}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!mappingReady ? <p className="text-sm text-error">请至少映射所有必填字段后再执行导入。</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {importRequirementCopy[entityType] ? (
          <div className="mt-4 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            <span className="font-medium text-on-surface">填写要求：</span>
            {importRequirementCopy[entityType]}
          </div>
        ) : null}

        {source === 'manual' || (source === 'excel' && parsedImportDraft) ? (
          <div className={`mt-4 rounded-lg border border-outline-variant ${entityType === 'movement' ? 'overflow-visible' : 'overflow-x-auto'}`}>
            <table className="w-full">
              <thead className="bg-surface-container-high text-left text-sm text-on-surface">
                <tr>
                  {columns.map((column) => <th key={column.key} className="px-4 py-3">{column.label}</th>)}
                  {(entityType === 'chemical' || entityType === 'equipment') ? <th className="px-4 py-3">图片预览</th> : null}
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant bg-surface">
                {draftRows.map((row, index) => (
                  <tr key={(row as { id: string }).id || `${entityType}-${index}`}>
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3">
                        {entityType === 'movement'
                          ? renderMovementInput(row as MovementImportRecord, index, column)
                          : (
                            <input
                              type={column.type === 'number' ? 'number' : 'text'}
                              value={String(((row as unknown) as Record<string, unknown>)[column.key] ?? '')}
                              onChange={(event) => updateDraftRow(index, column.key, event.target.value)}
                              className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
                              disabled={!canCreateImports || isLoading || isSubmitting}
                            />
                          )}
                      </td>
                    ))}
                    {(entityType === 'chemical' || entityType === 'equipment') ? (
                      <td className="px-4 py-3">
                        {getPreviewImage(row, entityType) ? (
                          <img
                            src={getPreviewImage(row, entityType)}
                            alt={String(((row as unknown) as Record<string, unknown>).name ?? '导入图片')}
                            className="h-16 w-16 rounded-lg border border-outline-variant object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-outline-variant text-xs text-on-surface-variant">
                            无图
                          </div>
                        )}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">{canCreateImports ? <button onClick={() => removeDraftRow(index)} className="text-sm text-error transition-colors hover:opacity-80" disabled={isLoading || isSubmitting}>删除</button> : <span className="text-sm text-on-surface-variant">只读</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {canCreateImports ? (
            <div className="flex gap-3">
              {source === 'manual' ? <button onClick={addDraftRow} className="rounded-lg border border-outline-variant px-4 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-low" disabled={isLoading || isSubmitting}>添加一行</button> : null}
              <button onClick={handleSubmit} className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60" disabled={isLoading || isSubmitting || !canSubmitCurrentMode}>{isSubmitting ? '提交中...' : source === 'manual' ? '提交录入' : '执行导入'}</button>
            </div>
          ) : <p className="text-sm text-on-surface-variant">普通成员仅可查看导入模板、结果和历史记录。</p>}
          <p className="text-sm text-on-surface-variant">当前记录数：{currentRecords.length}，导入后会自动生成结果摘要和错误清单。</p>
        </div>
        {lastBatch?.entityType === entityType && lastBatch.failureCount > 0 ? (
          <div className="mt-4 rounded-lg border border-error bg-error-container px-4 py-3 text-sm text-error">
            <p className="font-medium">本次导入失败 {lastBatch.failureCount} 条，失败行已保留在上方表格中。</p>
            <div className="mt-2 space-y-1">
              {lastBatch.errors.slice(0, 5).map((error) => (
                <p key={`${lastBatch.id}-${error.rowNumber}-${error.field}`}>{formatImportError(error)}</p>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {lastBatch ? (
        <section className="rounded-lg border border-outline-variant bg-surface p-6">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="text-xl font-semibold text-on-surface">最近一次导入结果</h2><p className="mt-1 text-sm text-on-surface-variant">成功 {lastBatch.successCount} 条，失败 {lastBatch.failureCount} 条，触发规则事件 {lastBatch.generatedEventCount} 条。</p></div>
            <span className={`rounded-full px-3 py-1 text-sm ${importStatusTone[lastBatch.status]}`}>{importStatusLabel[lastBatch.status]}</span>
          </div>
          {lastBatch.errors.length > 0 ? (
            <div className="mt-4 space-y-1 text-sm text-error">
              <p>本次仍存在错误清单：</p>
              {lastBatch.errors.slice(0, 3).map((error) => (
                <p key={`${error.rowNumber}-${error.field}`}>{formatImportError(error)}</p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr,1fr]">
        <div className="rounded-lg border border-outline-variant bg-surface p-6">
          <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold text-on-surface">导入历史</h2><span className="text-sm text-on-surface-variant">{visibleBatches.length} 个批次</span></div>
          <div className="mt-4 space-y-3">{visibleBatches.map((batch) => <div key={batch.id} className="rounded-lg border border-outline-variant bg-surface-container-low p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium text-on-surface">{batch.fileName ?? `${entityLabelMap[batch.entityType]} 手工录入`}</p><p className="mt-1 text-sm text-on-surface-variant">{batch.source === 'manual' ? '手工录入' : 'Excel 导入'} · {batch.importedBy} · {formatLocalDateTime(batch.createdAt)}</p></div><span className={`rounded-full px-3 py-1 text-sm ${importStatusTone[batch.status]}`}>{importStatusLabel[batch.status]}</span></div><div className="mt-3 grid grid-cols-4 gap-3 text-sm"><div className="rounded bg-surface px-3 py-2 text-on-surface">总数 {batch.totalCount}</div><div className="rounded bg-surface px-3 py-2 text-on-surface">成功 {batch.successCount}</div><div className="rounded bg-surface px-3 py-2 text-on-surface">失败 {batch.failureCount}</div><div className="rounded bg-surface px-3 py-2 text-on-surface">事件 {batch.generatedEventCount}</div></div>{batch.errors.length > 0 ? <div className="mt-3 space-y-1 rounded bg-error-container px-3 py-2 text-sm text-error">{batch.errors.slice(0, 3).map((error) => <p key={`${batch.id}-${error.rowNumber}-${error.field}`}>{formatImportError(error)}</p>)}</div> : null}</div>)}</div>
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface p-6">
          <h2 className="text-xl font-semibold text-on-surface">最新成功记录</h2>
          <div className="mt-4 space-y-3">{recentSuccessfulRecords.map((record) => <div key={(record as { id: string }).id} className="rounded-lg bg-surface-container-low p-4"><div className="flex items-center justify-between gap-3"><p className="font-medium text-on-surface">{String(((record as unknown) as Record<string, unknown>).name ?? ((record as unknown) as Record<string, unknown>).equipmentName ?? '-')}</p><span className="text-xs text-on-surface-variant">{(record as { id: string }).id}</span></div><p className="mt-2 text-sm text-on-surface-variant">{columns.slice(1, 3).map((column) => `${column.label} ${String(((record as unknown) as Record<string, unknown>)[column.key] ?? '-')}`).join(' / ')}</p></div>)}</div>
        </div>
      </section>
    </div>
  )
}

