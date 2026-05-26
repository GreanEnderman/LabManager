import type { FormalTableName, TableDefinition } from '../domain/models'
import { aiTableDefinitions } from '../domain/models'

export interface FormalPersistenceAuditPolicy {
  transitionStorage: 'compatibility_only'
  authoritativeStorage: 'relational_tables'
  snapshotTable: 'ai_state_snapshots'
  notes: string[]
}

export interface FormalPersistenceSchemaArtifact {
  table: FormalTableName
  ddl: string[]
}

function quoteIdentifier(identifier: string) {
  return `"${identifier}"`
}

function mapColumnType(column: TableDefinition['columns'][string]['type']): string {
  switch (column) {
    case 'id':
    case 'string':
    case 'email':
    case 'enum':
      return 'TEXT'
    case 'text':
      return 'TEXT'
    case 'boolean':
      return 'BOOLEAN'
    case 'json':
      return 'JSONB'
    case 'datetime':
      return 'TIMESTAMPTZ'
    case 'string[]':
      return 'TEXT[]'
    case 'number':
      return 'INTEGER'
    default:
      return 'TEXT'
  }
}

function buildColumnSql(name: string, definition: TableDefinition['columns'][string]) {
  const nullable = definition.required ? 'NOT NULL' : 'NULL'
  const defaultValue = definition.type === 'json' && definition.required ? ` DEFAULT '{}'::jsonb` : ''
  return `${quoteIdentifier(name)} ${mapColumnType(definition.type)} ${nullable}${defaultValue}`.trim()
}

function buildCreateTableStatement(definition: TableDefinition): string {
  const columns = Object.entries(definition.columns).map(([name, column]) => buildColumnSql(name, column))
  const primaryKey = `${quoteIdentifier('id')} TEXT PRIMARY KEY`
  const normalizedColumns = columns.map((column) => (column.startsWith('"id"') ? primaryKey : column))
  return `CREATE TABLE IF NOT EXISTS ${definition.name} (\n  ${normalizedColumns.join(',\n  ')}\n);`
}

function buildIndexStatements(definition: TableDefinition): string[] {
  return (
    definition.indexes?.map((index) => {
      const unique = index.unique ? 'UNIQUE ' : ''
      const columns = index.columns.map(quoteIdentifier).join(', ')
      return `CREATE ${unique}INDEX IF NOT EXISTS ${index.name} ON ${definition.name} (${columns});`
    }) ?? []
  )
}

function buildForeignKeyStatements(definition: TableDefinition): string[] {
  return (
    definition.foreignKeys?.map((foreignKey, index) => {
      const columns = foreignKey.columns.map(quoteIdentifier).join(', ')
      const references = foreignKey.references.columns.map(quoteIdentifier).join(', ')
      return [
        `DO $$`,
        `BEGIN`,
        `  IF NOT EXISTS (`,
        `    SELECT 1 FROM pg_constraint WHERE conname = '${definition.name}_fk_${index + 1}'`,
        `  ) THEN`,
        `    ALTER TABLE ${definition.name}`,
        `      ADD CONSTRAINT ${definition.name}_fk_${index + 1}`,
        `      FOREIGN KEY (${columns}) REFERENCES ${foreignKey.references.table} (${references});`,
        `  END IF;`,
        `END $$;`,
      ].join('\n')
    }) ?? []
  )
}

export const formalPersistenceAuditPolicy: FormalPersistenceAuditPolicy = {
  transitionStorage: 'compatibility_only',
  authoritativeStorage: 'relational_tables',
  snapshotTable: 'ai_state_snapshots',
  notes: [
    'ai_state_snapshots 仅用于 prototype hydration、fallback export/import 和迁移验证。',
    '正式生产真相必须写入 ai_tasks、ai_task_actions、approvals、ai_reports、import_jobs、report_deliveries、system_settings。',
    'snapshot payload 不得作为新功能的唯一持久化来源。',
  ],
}

export const formalPersistenceTables = aiTableDefinitions.filter(
  (definition): definition is TableDefinition & { name: FormalTableName } => definition.name !== 'ai_memories',
)

export const formalPersistenceSchemaArtifacts: FormalPersistenceSchemaArtifact[] = formalPersistenceTables.map(
  (definition) => ({
    table: definition.name,
    ddl: [
      buildCreateTableStatement(definition),
      ...buildIndexStatements(definition),
      ...buildForeignKeyStatements(definition),
    ],
  }),
)

export function getFormalPersistenceSchemaSql(): string {
  return formalPersistenceSchemaArtifacts
    .flatMap((artifact) => artifact.ddl)
    .join('\n\n')
}

