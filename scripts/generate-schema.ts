#!/usr/bin/env bun
/**
 * Generate JSON Schema for orca.json
 *
 * This script is run during build to generate dist/orca.schema.json
 * Usage: bun scripts/generate-schema.ts
 */

import { resolve } from 'node:path'
import { generateSchema, writeSchema } from '../src/plugin/schema'

const outputPath = resolve(process.cwd(), 'dist', 'orca.schema.json')

console.log('Generating orca.schema.json...')
writeSchema(outputPath)
console.log(`Schema written to ${outputPath}`)
