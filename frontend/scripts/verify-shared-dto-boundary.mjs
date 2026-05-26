import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const workspaceRoot = path.resolve(import.meta.dirname, '..', '..')
const backendContractsDir = path.join(workspaceRoot, 'backend', 'src', 'contracts')
const frontendSrcDir = path.join(workspaceRoot, 'frontend', 'src')
const allowedRuntimeImporters = new Set([
  path.join(frontendSrcDir, 'runtime', 'aiAppClient.ts'),
  path.join(frontendSrcDir, 'runtime', 'aiAppFacade.ts'),
  path.join(frontendSrcDir, 'runtime', 'aiAppFacadeAsync.ts'),
  path.join(frontendSrcDir, 'runtime', 'aiGateway.ts'),
  path.join(frontendSrcDir, 'runtime', 'httpAiGateway.ts'),
])
const sharedImportPattern = /backend\/src\/contracts\/shared/
const localDefinitionPattern = /\bexport\s+(?:interface|const)\b/m

function walkFiles(dir, predicate, results = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      walkFiles(fullPath, predicate, results)
      continue
    }
    if (predicate(fullPath)) {
      results.push(fullPath)
    }
  }
  return results
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function read(filePath) {
  return readFileSync(filePath, 'utf8')
}

const sharedContractPath = path.join(backendContractsDir, 'shared.ts')
assert(read(sharedContractPath).includes('Canonical shared DTO definitions live here.'), 'shared.ts must document its canonical DTO role.')

for (const contractFile of ['api.ts', 'responses.ts']) {
  const filePath = path.join(backendContractsDir, contractFile)
  const content = read(filePath)
  assert(content.includes('pass-through'), `${contractFile} must document that it is pass-through only.`)
  assert(!localDefinitionPattern.test(content), `${contractFile} must not define transport semantics locally.`)
}

const frontendFiles = walkFiles(
  frontendSrcDir,
  (filePath) => filePath.endsWith('.ts') || filePath.endsWith('.tsx'),
)

const sharedImporters = frontendFiles.filter((filePath) => sharedImportPattern.test(read(filePath)))
const unexpectedImporters = sharedImporters.filter((filePath) => !allowedRuntimeImporters.has(filePath))

assert(
  unexpectedImporters.length === 0,
  `Unexpected shared DTO importers outside runtime boundary:\n${unexpectedImporters.join('\n')}`,
)

console.log('Shared DTO boundary verification passed.')
