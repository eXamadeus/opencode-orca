/**
 * Update notifier for opencode-orca plugin
 *
 * Checks for new versions and notifies users appropriately based on
 * whether they have pinned a specific version or are using @latest.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { OpencodeClient } from '@opencode-ai/sdk'
import type { OrcaSettings } from './config'

// Constants
const CACHE_DIR = join(homedir(), '.cache', 'opencode-orca')
const CACHE_FILE = join(CACHE_DIR, 'update-notifier.json')
const NPM_REGISTRY_URL = 'https://registry.npmjs.org/opencode-orca'
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours
const FETCH_TIMEOUT_MS = 5000

// Package name for detecting plugin entry
const PACKAGE_NAME = 'opencode-orca'

/**
 * Cached update check data
 */
interface UpdateCache {
  /** Timestamp of last npm registry check */
  lastCheck: number
  /** Version we were running last session */
  lastKnownVersion: string
  /** Latest stable version from npm (cached) */
  latestStableVersion: string | null
}

/**
 * Context for running the update notifier
 */
export interface UpdateNotifierContext {
  client: OpencodeClient
  currentVersion: string
  pluginEntry: string | undefined
  settings: OrcaSettings | undefined
}

/**
 * Parse a plugin entry to determine if it's pinned
 * Examples:
 *   "opencode-orca" -> { isPinned: false }
 *   "opencode-orca@0.1.0" -> { isPinned: true, pinnedVersion: "0.1.0" }
 */
export function parsePluginEntry(entry: string | undefined): {
  isPinned: boolean
  pinnedVersion?: string
} {
  if (!entry) {
    return { isPinned: false }
  }

  const atIndex = entry.lastIndexOf('@')
  if (atIndex > 0) {
    const version = entry.substring(atIndex + 1)
    // Ignore @latest as it's not really pinned
    if (version !== 'latest') {
      return { isPinned: true, pinnedVersion: version }
    }
  }

  return { isPinned: false }
}

/**
 * Simple semver comparison for stable versions (major.minor.patch)
 * Returns true if `latest` is newer than `current`
 */
export function isNewerVersion(current: string, latest: string): boolean {
  // Strip leading 'v' and any prerelease suffix for comparison
  const normalize = (v: string) => v.replace(/^v/, '').split('-')[0].split('.').map(Number)

  const [cMaj, cMin, cPatch] = normalize(current)
  const [lMaj, lMin, lPatch] = normalize(latest)

  if (lMaj > cMaj) return true
  if (lMaj === cMaj && lMin > cMin) return true
  if (lMaj === cMaj && lMin === cMin && lPatch > cPatch) return true
  return false
}

/**
 * Check if a version string is a stable release (no prerelease suffix)
 */
export function isStableVersion(version: string): boolean {
  return !version.includes('-')
}

/**
 * Read the cached update check data
 */
function readCache(): UpdateCache | null {
  try {
    if (!existsSync(CACHE_FILE)) {
      return null
    }
    const content = readFileSync(CACHE_FILE, 'utf-8')
    return JSON.parse(content) as UpdateCache
  } catch {
    return null
  }
}

/**
 * Write update check data to cache
 */
function writeCache(cache: UpdateCache): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true })
    }
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8')
  } catch {
    // Silently ignore cache write failures
  }
}

/**
 * Fetch the latest stable version from npm registry
 */
async function fetchLatestStableVersion(): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const response = await fetch(NPM_REGISTRY_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as {
      'dist-tags'?: { latest?: string }
      versions?: Record<string, unknown>
    }

    // Get the latest tag
    const latest = data['dist-tags']?.latest
    if (latest && isStableVersion(latest)) {
      return latest
    }

    // If latest is a prerelease, find the newest stable version
    if (data.versions) {
      const stableVersions = Object.keys(data.versions)
        .filter(isStableVersion)
        .sort((a, b) => {
          // Sort descending by version
          if (isNewerVersion(a, b)) return -1
          if (isNewerVersion(b, a)) return 1
          return 0
        })

      return stableVersions[0] || null
    }

    return null
  } catch {
    // Network errors are silently ignored
    return null
  }
}

/**
 * Show a toast notification
 */
async function showToast(
  client: OpencodeClient,
  options: {
    title?: string
    message: string
    variant: 'info' | 'success' | 'warning' | 'error'
    duration?: number
  },
): Promise<void> {
  try {
    await client.tui.showToast({
      body: {
        title: options.title,
        message: options.message,
        variant: options.variant,
        duration: options.duration,
      },
    })
  } catch {
    // Silently ignore toast failures
  }
}

/**
 * Run the update notifier
 *
 * This should be called on session.created event.
 * It's designed to be fire-and-forget (non-blocking).
 */
export async function runUpdateNotifier(ctx: UpdateNotifierContext): Promise<void> {
  const { client, currentVersion, pluginEntry, settings } = ctx

  // Check if notifications are disabled
  if (settings?.updateNotifier === false) {
    return
  }

  const cache = readCache()
  const { isPinned, pinnedVersion } = parsePluginEntry(pluginEntry)

  // First run: silently create cache, no notification
  if (!cache) {
    writeCache({
      lastCheck: Date.now(),
      lastKnownVersion: currentVersion,
      latestStableVersion: null,
    })
    return
  }

  // Check if we just got upgraded (unpinned users auto-update)
  const wasUpgraded = cache.lastKnownVersion !== currentVersion

  if (wasUpgraded && !isPinned) {
    // Scenario A: Unpinned user just got upgraded
    await showToast(client, {
      title: 'opencode-orca updated',
      message: `Now running v${currentVersion}`,
      variant: 'success',
      duration: 5000,
    })

    // Update cache with new version
    writeCache({
      ...cache,
      lastKnownVersion: currentVersion,
    })
    return
  }

  // For unpinned users who haven't just upgraded, skip notification
  // They'll auto-update on next restart anyway
  if (!isPinned) {
    // Just update the cache silently
    writeCache({
      ...cache,
      lastKnownVersion: currentVersion,
    })
    return
  }

  // Pinned users: check for updates (respecting cache interval)
  const shouldFetch = Date.now() - cache.lastCheck >= CHECK_INTERVAL_MS

  let latestVersion = cache.latestStableVersion
  if (shouldFetch) {
    latestVersion = await fetchLatestStableVersion()
  }

  // Update cache
  writeCache({
    lastCheck: shouldFetch ? Date.now() : cache.lastCheck,
    lastKnownVersion: currentVersion,
    latestStableVersion: latestVersion,
  })

  // Scenario C: Pinned user with update available
  if (latestVersion && isNewerVersion(currentVersion, latestVersion)) {
    const message = [
      `v${latestVersion} available (pinned at v${pinnedVersion || currentVersion})`,
      `Update: change to "${PACKAGE_NAME}@${latestVersion}" in opencode.jsonc`,
      'Disable in .opencode/orca.json: updateNotifier: false',
    ].join('\n')

    await showToast(client, {
      title: 'opencode-orca update available',
      message,
      variant: 'info',
      duration: 12000,
    })
  }
}
