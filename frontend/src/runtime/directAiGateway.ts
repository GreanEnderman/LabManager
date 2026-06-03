/**
 * @deprecated Development and testing only - DO NOT USE IN PRODUCTION
 *
 * This file directly imports from the TypeScript backend (backend/src),
 * which violates M-02 migration rule (TS Prototype Backend Freeze).
 *
 * Production code MUST use httpAiGateway via getAiGateway().
 * This file is excluded from TypeScript compilation and should only be
 * used in local development for rapid prototyping.
 *
 * See: docs/frontend-ai-runtime-boundary.md
 */

/* eslint-disable no-restricted-imports */
import type { AIGateway, GatewayActor, InventoryListOptions } from './aiGateway'
import type { ChemicalImportRecord, EquipmentImportRecord } from '../imports/types'

let cachedServicesPromise: Promise<import('../../../backend/src/services/api-factory').AIApplicationServices> | null = null

async function getServices() {
  if (!cachedServicesPromise) {
    cachedServicesPromise = import('../../../backend/src/services/api-factory').then(({ createAIApplicationServices }) =>
      createAIApplicationServices(),
    )
  }

  return await cachedServicesPromise
}

function toActor(actor: GatewayActor) {
  return actor
}

export const directAiGateway: AIGateway = {
  async getSettings() {
    const settings = (await getServices()).getSystemSettings()
    return {
      thresholds: settings.thresholds,
      approvalStrategy: settings.approvalStrategy,
      sla: settings.sla,
      emailDelivery: {
        smtpHost: null,
        smtpPort: 587,
        smtpUser: null,
        smtpPassword: null,
        smtpFrom: null,
        smtpUseSsl: false,
        supervisorReportBaseUrl: null,
        passwordConfigured: false,
      },
      updatedAt: settings.updatedAt,
    }
  },
  async updateSettings(patch) {
    const response = (await getServices()).updateSystemSettings({
      thresholds: patch.thresholds,
      approvalStrategy: patch.approvalStrategy,
      sla: patch.sla,
    })

    return {
      thresholds: response.settings.thresholds,
      approvalStrategy: response.settings.approvalStrategy,
      sla: response.settings.sla,
      emailDelivery: patch.emailDelivery ?? {
        smtpHost: null,
        smtpPort: 587,
        smtpUser: null,
        smtpPassword: null,
        smtpFrom: null,
        smtpUseSsl: false,
        supervisorReportBaseUrl: null,
        passwordConfigured: false,
      },
      updatedAt: response.settings.updatedAt,
    }
  },
  async listChemicals(_options?: InventoryListOptions) {
    return (await getServices()).listChemicals()
  },
  async deleteChemical() {
    throw new Error('Direct AI gateway does not support deleting chemicals.')
  },
  async listEquipment(_options?: InventoryListOptions) {
    return (await getServices()).listEquipment()
  },
  async deleteEquipment() {
    throw new Error('Direct AI gateway does not support deleting equipment.')
  },
  async listImportBatches(filters) {
    return (await getServices()).listImportBatches(filters)
  },
  async importChemicals(rows: ChemicalImportRecord[], source, fileName, importedBy) {
    return (await getServices()).importChemicals({
      source,
      fileName,
      importedBy: {
        id: importedBy,
        name: importedBy,
        type: 'user',
      },
      rows: rows.map((row) => ({
        recordId: row.id,
        name: row.name,
        casNumber: row.casNumber || null,
        category: row.category,
        spec: row.spec,
        currentQuantity: row.currentQuantity,
        threshold: row.threshold,
        status: row.status,
        ownerName: row.ownerName,
        updatedAt: row.updatedAt || null,
        imageDataUrl: row.imageDataUrl || null,
        remark: row.remark,
      })),
    })
  },
  async importEquipment(rows: EquipmentImportRecord[], source, fileName, importedBy) {
    return (await getServices()).importEquipment({
      source,
      fileName,
      importedBy: {
        id: importedBy,
        name: importedBy,
        type: 'user',
      },
      rows: rows.map((row) => ({
        recordId: row.id,
        name: row.name,
        vendor: row.vendor,
        model: row.model,
        status: row.status,
        labName: row.labName,
        ownerName: row.ownerName,
        lastMaintenanceAt: row.lastMaintenanceAt || null,
        updatedAt: row.updatedAt || null,
        imageDataUrl: row.imageDataUrl || null,
        remark: row.remark,
      })),
    })
  },
  async createInventoryOperation() {
    throw new Error('Direct AI gateway does not support inventory operations.')
  },
  async listInventoryTransactions() {
    return []
  },
  async inspectRuleEvents(now, maintenanceOverdueDays) {
    const services = await getServices()
    return services
      .inspectRules({
        input: {
          chemicals: services.listChemicals().map((chemical) => ({
            id: chemical.id,
            name: chemical.name,
            totalQuantity: chemical.currentQuantity,
            threshold: chemical.threshold,
          })),
          equipment: services.listEquipment().map((equipment) => ({
            id: equipment.id,
            name: equipment.name,
            status: equipment.status,
            lastMaintenanceAt: equipment.lastMaintenanceAt,
          })),
        },
        config: {
          now,
          maintenanceOverdueDays,
        },
      })
      .items.map((item) => item.event)
  },
  async listTasks() {
    return (await getServices()).listTasks()
  },
  async getTaskActions(taskId) {
    return (await getServices()).getTaskDetail(taskId).actions
  },
  async listApprovals() {
    return (await getServices()).listApprovals()
  },
  async listReports() {
    return (await getServices()).listReports()
  },
  async deleteReport(reportId) {
    await getServices().then((services) => services.deleteReport(reportId))
  },
  async exportReportPdf(reportId) {
    return (await getServices()).exportReportPdf(reportId)
  },
  async listReportDeliveryMappings() {
    return (await getServices()).listSupervisorEmailMappings()
  },
  async saveReportDeliveryMapping(input, id) {
    return (await getServices()).saveSupervisorEmailMapping(input, id)
  },
  async listReportDeliveryConfigs() {
    return (await getServices()).listReportDeliveryConfigs()
  },
  async saveReportDeliveryConfig(input, id) {
    return (await getServices()).saveReportDeliveryConfig(input, id)
  },
  async listReportDeliveryRecords() {
    return (await getServices()).listReportDeliveryRecords()
  },
  async sendReport(reportId, actor) {
    const response = await (await getServices()).sendReport({
      reportId,
      actor: toActor(actor),
    })
    return response.records
  },
  async getAnalysisSummary(windowDays = 30) {
    const services = await getServices()
    const tasks = services.listTasks()
    const approvals = services.listApprovals()
    const activeTasks = tasks.filter((task) => ['open', 'in_progress', 'pending_approval'].includes(task.status))
    const pendingApprovals = approvals.filter((approval) => approval.status === 'pending').length
    return {
      generatedAt: new Date().toISOString(),
      windowDays,
      overview: {
        activeTasks: activeTasks.length,
        pendingApprovals,
        overdueTasks: 0,
        highRiskTasks: activeTasks.filter((task) => task.riskLevel === 'high').length,
        lowStockItems: 0,
        maintenanceOverdueItems: 0,
      },
      inventory: { lowStockItems: [], highUsageItems: [] },
      equipment: { overdueMaintenance: [], faultHotspots: [] },
      workflow: {
        taskStatusDistribution: Object.fromEntries(
          [...new Set(tasks.map((task) => task.status))].map((status) => [
            status,
            tasks.filter((task) => task.status === status).length,
          ]),
        ),
        approvalStatusDistribution: Object.fromEntries(
          [...new Set(approvals.map((approval) => approval.status))].map((status) => [
            status,
            approvals.filter((approval) => approval.status === status).length,
          ]),
        ),
        slaRisks: [],
      },
      recommendations:
        pendingApprovals > 0
          ? [
              {
                id: 'direct-analysis-approval',
                severity: 'warning',
                category: 'approval',
                title: '清理待审批积压',
                reason: `当前仍有 ${pendingApprovals} 项审批待处理。`,
                suggestedAction: '按高风险和创建时间优先处理审批。',
                evidence: [{ label: '待审批数量', value: String(pendingApprovals) }],
              },
            ]
          : [],
    }
  },
  async executeRuleEvent(eventId, actor) {
    const services = await getServices()
    const settings = services.getSystemSettings()
    const event = (await this.inspectRuleEvents(new Date().toISOString(), settings.thresholds.maintenanceOverdueDays)).find(
      (item) => item.id === eventId,
    )
    if (!event) return ''

    const response = await services.executeRuleEvent({
      runId: `frontend-run-${event.id}`,
      actor: toActor(actor),
      event,
    })

    return response.state.output?.taskId ?? response.state.context.existingOpenTask?.id ?? ''
  },
  async prepareAutoPurchase(taskId) {
    return {
      status: 'reserved',
      message: '自动采购接口已预留，当前前端直连运行时不执行真实采购。',
      taskId,
      purchaseRequestId: null,
    }
  },
  async confirmCompletionReport(taskId, report, actor) {
    await getServices().then((services) => services.updateTaskStatus(
      taskId,
      {
        transition: 'complete',
        detail: `Completion report submitted: ${report.reportTitle}.`,
      },
      toActor(actor),
    ))
  },
  async assignTask(taskId, assigneeId, assigneeName, assigneeRole, actor) {
    await getServices().then((services) => services.assignTask(
      taskId,
      {
        assigneeId,
        assigneeName,
        assigneeRole,
      },
      toActor(actor),
    ))
  },
  async updateTaskStatus(taskId, transition, detail, actor) {
    await getServices().then((services) => services.updateTaskStatus(
      taskId,
      {
        transition,
        detail,
      },
      toActor(actor),
    ))
  },
  async createApprovalForTask(taskId, title, reason, riskLevel, actor) {
    const services = await getServices()
    const taskDetail = services.getTaskDetail(taskId)
    if (taskDetail.task.status !== 'pending_approval') {
      services.updateTaskStatus(
        taskId,
        {
          transition: 'request_approval',
          detail: 'Frontend requested approval.',
        },
        toActor(actor),
      )
    }

    const approval = services.createApproval(
      {
        taskId,
        title,
        reason,
        riskLevel,
      },
      toActor(actor),
    )

    return approval.approval.id
  },
  async processApproval(approvalId, decision, comment, actor) {
    await getServices().then((services) => services.processApproval(
      approvalId,
      {
        decision,
        comment,
      },
      toActor(actor),
    ))
  },
  async generateReport(type, now) {
    await (await getServices()).generateReport({
      type,
      now,
    })
  },
}
