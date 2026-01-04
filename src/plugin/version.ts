/**
 * Version utility for the plugin
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

let cachedVersion: string | null = null

/**
 * Get the plugin version from package.json
 */
export function getPluginVersion(): string {
  if (cachedVersion) {
    return cachedVersion
  }

  try {
    // When running as a plugin, we need to find our package.json
    // Try multiple possible locations relative to this file
    const possiblePaths = [
      // Running from node_modules (installed)
      resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'),
      resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'),
      // Running from dist (local development)
      resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'),
    ]

    for (const pkgPath of possiblePaths) {
      try {
        const content = readFileSync(pkgPath, 'utf-8')
        const pkg = JSON.parse(content)
        if (pkg.name === 'opencode-orca' && pkg.version) {
          cachedVersion = pkg.version
          return cachedVersion as string
        }
      } catch {
        // Try next path
      }
    }

    return 'unknown'
  } catch {
    return 'unknown'
  }
}
