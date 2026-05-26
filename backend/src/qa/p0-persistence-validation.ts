import type { FormalTableName } from '../domain/models'
import { aiTableDefinitions } from '../domain/models'
import {
  formalPersistenceAuditPolicy,
  formalPersistenceSchemaArtifacts,
  getFormalPersistenceSchemaSql,
} from '../services/formal-persistence-schema'

interface ValidationResult {
  name: string
  passed: boolean
  detail: string
}

function assert(condition: boolean, detail: string): { passed: boolean; detail: string } {
  return {
    passed: condition,
    detail,
  }
}

function validateFormalPersistenceModel(): ValidationResult[] {
  const requiredTables: FormalTableName[] = [
    'ai_tasks',
    'ai_task_actions',
    'approvals',
    'ai_reports',
    'import_jobs',
    'report_deliveries',
    'system_settings',
  ]
  const requiredAuditFields = {
    ai_tasks: ['createdAt', 'updatedAt'],
    ai_task_actions: ['createdAt'],
    approvals: ['createdAt', 'updatedAt'],
    ai_reports: ['createdAt'],
    import_jobs: ['createdAt', 'completedAt'],
    report_deliveries: ['createdAt', 'sentAt'],
    system_settings: ['createdAt', 'updatedAt'],
  } as const

  const tableNames = aiTableDefinitions.map((definition) => definition.name)
  const schemaTables = formalPersistenceSchemaArtifacts.map((artifact) => artifact.table)
  const missingTables = requiredTables.filter((table) => !tableNames.includes(table))
  const auditMismatches = requiredTables.filter((table) => {
    const definition = aiTableDefinitions.find((item) => item.name === table)
    if (!definition) return true
    return !(requiredAuditFields[table as keyof typeof requiredAuditFields] ?? []).every((field) =>
      definition.auditFields?.includes(field),
    )
  })
  const sql = getFormalPersistenceSchemaSql()

  return [
    {
      name: '正式持久化表集合已冻结',
      ...assert(missingTables.length === 0, `Observed tables=${tableNames.join(', ')}`),
    },
    {
      name: '正式持久化 schema 产物覆盖全部目标表',
      ...assert(
        requiredTables.every((table) => schemaTables.includes(table)),
        `Observed schema tables=${schemaTables.join(', ')}`,
      ),
    },
    {
      name: '正式持久化审计字段已声明',
      ...assert(
        auditMismatches.length === 0,
        auditMismatches.length === 0
          ? 'All required audit fields are declared.'
          : `Audit field mismatches=${auditMismatches.join(', ')}`,
      ),
    },
    {
      name: 'snapshot store 被标记为过渡兼容模式',
      ...assert(
        formalPersistenceAuditPolicy.transitionStorage === 'compatibility_only' &&
          formalPersistenceAuditPolicy.authoritativeStorage === 'relational_tables',
        `Observed transitionStorage=${formalPersistenceAuditPolicy.transitionStorage}, authoritativeStorage=${formalPersistenceAuditPolicy.authoritativeStorage}`,
      ),
    },
    {
      name: '关系型 schema SQL 已生成',
      ...assert(
        sql.includes('CREATE TABLE IF NOT EXISTS ai_tasks') &&
          sql.includes('CREATE TABLE IF NOT EXISTS report_deliveries') &&
          sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS ux_system_settings_setting_key'),
        'Formal persistence SQL includes table and index scaffolding.',
      ),
    },
  ]
}

const results = validateFormalPersistenceModel()
const failed = results.filter((result) => !result.passed)

for (const result of results) {
  const prefix = result.passed ? '[PASS]' : '[FAIL]'
  console.log(`${prefix} ${result.name}: ${result.detail}`)
}

if (failed.length > 0) {
  console.error(`\nQA P0 persistence validation failed with ${failed.length} failed checks.`)
  throw new Error(`QA P0 persistence validation failed with ${failed.length} failed checks.`)
} else {
  console.log(`\nQA P0 persistence validation passed with ${results.length} checks.`)
}
