import { defineConfig } from 'tsup'

export default defineConfig([
  // Main library entry (ESM only - OpenCode is ESM)
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    minify: false,
    target: 'node20',
    outDir: 'dist',
  },
  // CLI entry
  {
    entry: { cli: 'src/cli/index.ts' },
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: true,
    minify: false,
    target: 'node20',
    outDir: 'dist',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
])
