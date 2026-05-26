import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function stripQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

export function loadEnvFile(fileName = '.env') {
  const path = resolve(process.cwd(), fileName)
  if (!existsSync(path)) {
    return
  }

  const raw = readFileSync(path, 'utf-8')
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      return
    }

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) {
      return
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = stripQuotes(trimmed.slice(separatorIndex + 1).trim())

    if (!process.env[key]) {
      process.env[key] = value
    }
  })
}
