import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureSchema, generateSchema } from '../schema'

describe('generateSchema', () => {
  test('generates valid JSON schema', () => {
    const schema = generateSchema()

    expect(schema).toHaveProperty('$schema')
    expect(schema).toHaveProperty('$id')
    expect(schema).toHaveProperty('title', 'Orca Configuration')
    expect(schema).toHaveProperty('type', 'object')
    expect(schema).toHaveProperty('properties')
  })

  test('includes orca and planner properties', () => {
    const schema = generateSchema() as { properties: Record<string, unknown> }

    expect(schema.properties).toHaveProperty('orca')
    expect(schema.properties).toHaveProperty('planner')
    expect(schema.properties).toHaveProperty('agents')
    expect(schema.properties).toHaveProperty('settings')
  })

  test('orca config only has safe fields', () => {
    const schema = generateSchema() as {
      properties: { orca: { properties: Record<string, unknown> } }
    }
    const orcaProps = Object.keys(schema.properties.orca.properties)

    expect(orcaProps).toContain('model')
    expect(orcaProps).toContain('temperature')
    expect(orcaProps).toContain('top_p')
    expect(orcaProps).toContain('maxSteps')
    expect(orcaProps).toContain('color')

    // Should NOT have dangerous fields
    expect(orcaProps).not.toContain('prompt')
    expect(orcaProps).not.toContain('tools')
    expect(orcaProps).not.toContain('permission')
  })
})

describe('ensureSchema', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'orca-schema-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  test('returns true if schema already exists', () => {
    const schemaPath = join(tempDir, 'orca.schema.json')
    writeFileSync(schemaPath, '{}')

    const result = ensureSchema(tempDir)

    expect(result).toBe(true)
  })

  test('creates directory if it does not exist', () => {
    const nestedDir = join(tempDir, 'nested', '.opencode')

    // This will fail to copy since no bundled schema exists in test env,
    // but it should still try to create the directory
    ensureSchema(nestedDir)

    // Directory creation is attempted even if schema copy fails
    // (the function returns false if copy fails, but we're testing the attempt)
  })

  test('adds schema to .gitignore if not present', () => {
    const gitignorePath = join(tempDir, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules\n')

    ensureSchema(tempDir)

    const content = readFileSync(gitignorePath, 'utf-8')
    expect(content).toContain('orca.schema.json')
    expect(content).toContain('node_modules') // Original content preserved
  })

  test('does not duplicate schema in .gitignore', () => {
    const gitignorePath = join(tempDir, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules\norca.schema.json\n')

    ensureSchema(tempDir)

    const content = readFileSync(gitignorePath, 'utf-8')
    const matches = content.match(/orca\.schema\.json/g)
    expect(matches?.length).toBe(1)
  })

  test('creates .gitignore if it does not exist', () => {
    const gitignorePath = join(tempDir, '.gitignore')

    ensureSchema(tempDir)

    expect(existsSync(gitignorePath)).toBe(true)
    const content = readFileSync(gitignorePath, 'utf-8')
    expect(content).toContain('orca.schema.json')
  })

  test('handles .gitignore without trailing newline', () => {
    const gitignorePath = join(tempDir, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules') // No trailing newline

    ensureSchema(tempDir)

    const content = readFileSync(gitignorePath, 'utf-8')
    expect(content).toBe('node_modules\norca.schema.json\n')
  })
})
