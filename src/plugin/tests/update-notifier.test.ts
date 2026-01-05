import { describe, expect, test } from 'bun:test'
import { isNewerVersion, isStableVersion, parsePluginEntry } from '../update-notifier'

describe('update-notifier', () => {
  describe('parsePluginEntry', () => {
    test('returns isPinned: false for undefined', () => {
      expect(parsePluginEntry(undefined)).toEqual({ isPinned: false })
    })

    test('returns isPinned: false for unpinned entry', () => {
      expect(parsePluginEntry('@ex-machina/opencode-orca')).toEqual({ isPinned: false })
    })

    test('returns isPinned: false for @latest', () => {
      expect(parsePluginEntry('@ex-machina/opencode-orca@latest')).toEqual({ isPinned: false })
    })

    test('returns isPinned: true with version for pinned entry', () => {
      expect(parsePluginEntry('@ex-machina/opencode-orca@0.1.0')).toEqual({
        isPinned: true,
        pinnedVersion: '0.1.0',
      })
    })

    test('returns isPinned: true for pre-release pinned entry', () => {
      expect(parsePluginEntry('@ex-machina/opencode-orca@0.1.0-alpha.1')).toEqual({
        isPinned: true,
        pinnedVersion: '0.1.0-alpha.1',
      })
    })

    test('handles scoped packages', () => {
      // The @ in scoped packages shouldn't confuse the parser
      expect(parsePluginEntry('@other-scope/some-package@0.1.0')).toEqual({
        isPinned: true,
        pinnedVersion: '0.1.0',
      })
    })
  })

  describe('isNewerVersion', () => {
    test('returns true when major version is higher', () => {
      expect(isNewerVersion('1.0.0', '2.0.0')).toBe(true)
    })

    test('returns true when minor version is higher', () => {
      expect(isNewerVersion('1.0.0', '1.1.0')).toBe(true)
    })

    test('returns true when patch version is higher', () => {
      expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true)
    })

    test('returns false when versions are equal', () => {
      expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false)
    })

    test('returns false when current is newer', () => {
      expect(isNewerVersion('2.0.0', '1.0.0')).toBe(false)
    })

    test('handles v prefix', () => {
      expect(isNewerVersion('v1.0.0', 'v1.0.1')).toBe(true)
    })

    test('strips pre-release suffix for comparison', () => {
      // 1.0.0-alpha.1 should compare as 1.0.0
      expect(isNewerVersion('1.0.0-alpha.1', '1.0.0')).toBe(false)
      expect(isNewerVersion('1.0.0', '1.0.1-beta.1')).toBe(true)
    })
  })

  describe('isStableVersion', () => {
    test('returns true for stable versions', () => {
      expect(isStableVersion('1.0.0')).toBe(true)
      expect(isStableVersion('0.1.0')).toBe(true)
      expect(isStableVersion('10.20.30')).toBe(true)
    })

    test('returns false for pre-release versions', () => {
      expect(isStableVersion('1.0.0-alpha.1')).toBe(false)
      expect(isStableVersion('1.0.0-beta.1')).toBe(false)
      expect(isStableVersion('1.0.0-rc.1')).toBe(false)
      expect(isStableVersion('1.0.0-next.1')).toBe(false)
    })
  })
})
