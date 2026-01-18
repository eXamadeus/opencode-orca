/**
 * init command - Create default .opencode/orca.json configuration
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureSchema } from '../../plugin/schema'
import { info, success, warn } from '../utils/console'
import { getOpenCodeDirPath, getOrcaConfigPath } from '../utils/paths'

export interface InitOptions {
  force?: boolean
  /** Suppress "next steps" output (used when called from install) */
  quiet?: boolean
}

/**
 * Get the default template content for orca.json
 */
function getTemplate(): string {
  // Try to read from templates directory
  const possiblePaths = [
    // Running from source (development)
    resolve(process.cwd(), 'templates', 'orca.json'),
    // Running from dist (installed package)
    resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates', 'orca.json'),
    resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'orca.json'),
  ]

  for (const templatePath of possiblePaths) {
    try {
      if (existsSync(templatePath)) {
        return readFileSync(templatePath, 'utf-8')
      }
    } catch {
      // Try next path
    }
  }

  // Fallback to inline template
  return JSON.stringify(
    {
      settings: {
        defaultSupervised: false,
        validation: {
          maxRetries: 3,
          wrapPlainText: true,
        },
      },
      agents: {},
    },
    null,
    2,
  )
}

/**
 * Initialize the Orca configuration file
 *
 * Creates .opencode/orca.json from the default template.
 * Does not modify opencode.jsonc.
 */
export async function init(options: InitOptions = {}): Promise<void> {
  const orcaConfigPath = getOrcaConfigPath()
  const opencodeDirPath = getOpenCodeDirPath()

  // Check if config already exists
  if (existsSync(orcaConfigPath)) {
    if (!options.force) {
      warn(`${orcaConfigPath} already exists. Use --force to overwrite.`)
      return
    }
    info('Overwriting existing configuration...')
  }

  // Create .opencode directory if it doesn't exist
  if (!existsSync(opencodeDirPath)) {
    mkdirSync(opencodeDirPath, { recursive: true })
    info(`Created ${opencodeDirPath}/`)
  }

  // Write the template
  const template = getTemplate()
  writeFileSync(orcaConfigPath, template, 'utf-8')

  success(`Created ${orcaConfigPath}`)

  // Copy schema file for editor autocomplete
  if (ensureSchema(opencodeDirPath)) {
    success('Created .opencode/orca.schema.json')
  }

  if (!options.quiet) {
    info('')
    info('Next steps:')
    info('  1. Customize your configuration in .opencode/orca.json')
    info('  2. Run `opencode-orca install` to add the plugin to opencode.jsonc')
  }
}
