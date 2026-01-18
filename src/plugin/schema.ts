/**
 * JSON Schema generation for Orca config
 *
 * This module generates a JSON Schema from the Zod schemas,
 * which enables editor autocomplete and validation for orca.json files.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { OrcaUserConfig } from './config'

const SCHEMA_FILENAME = 'orca.schema.json'

/**
 * Generate JSON Schema from OrcaUserConfig Zod schema
 */
export function generateSchema(): object {
  const schema = z.toJSONSchema(OrcaUserConfig)
  return {
    ...schema,
    $id: 'https://github.com/ex-machina-co/opencode-orca/orca.schema.json',
    title: 'Orca Configuration',
  }
}

/**
 * Get the path to the bundled schema file in dist/
 */
export function getBundledSchemaPath(): string | undefined {
  const possiblePaths = [
    // Running from dist (installed package)
    resolve(dirname(fileURLToPath(import.meta.url)), '..', SCHEMA_FILENAME),
    resolve(dirname(fileURLToPath(import.meta.url)), SCHEMA_FILENAME),
    // Running from source (development) - check if generated
    resolve(process.cwd(), 'dist', SCHEMA_FILENAME),
  ]

  for (const schemaPath of possiblePaths) {
    if (existsSync(schemaPath)) {
      return schemaPath
    }
  }

  return undefined
}

/**
 * Read the bundled schema content
 */
export function readBundledSchema(): string | undefined {
  const schemaPath = getBundledSchemaPath()
  if (!schemaPath) return undefined

  try {
    return readFileSync(schemaPath, 'utf-8')
  } catch {
    return undefined
  }
}

/**
 * Ensure schema file exists in the target directory.
 * Copies from bundled schema if missing.
 *
 * @param targetDir - Directory to write schema to (e.g., .opencode/)
 * @returns true if schema exists or was copied, false otherwise
 */
export function ensureSchema(targetDir: string): boolean {
  const targetPath = resolve(targetDir, SCHEMA_FILENAME)

  // Already exists
  if (existsSync(targetPath)) {
    return true
  }

  // Try to copy from bundled
  const bundledContent = readBundledSchema()
  if (!bundledContent) {
    return false
  }

  try {
    // Ensure directory exists
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true })
    }

    writeFileSync(targetPath, bundledContent, 'utf-8')
    return true
  } catch {
    return false
  }
}

/**
 * Write schema to a file (used during build)
 */
export function writeSchema(outputPath: string): void {
  const schema = generateSchema()
  const content = JSON.stringify(schema, null, 2)

  const dir = dirname(outputPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  writeFileSync(outputPath, content, 'utf-8')
}
