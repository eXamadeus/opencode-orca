import type { OpencodeClient as OpencodeClientV2 } from '@opencode-ai/sdk/v2'

export interface Logger {
  debug(message: string, extra?: Record<string, unknown>): void
  info(message: string, extra?: Record<string, unknown>): void
  warn(message: string, extra?: Record<string, unknown>): void
  error(message: string, extra?: Record<string, unknown>): void
}

let globalLogger: Logger | undefined

export function initLogger(clientNext: OpencodeClientV2): Logger {
  globalLogger = {
    debug: (message, extra) => {
      clientNext.app.log({ service: 'orca', level: 'debug', message, extra }).catch(() => {})
    },
    info: (message, extra) => {
      clientNext.app.log({ service: 'orca', level: 'info', message, extra }).catch(() => {})
    },
    warn: (message, extra) => {
      clientNext.app.log({ service: 'orca', level: 'warn', message, extra }).catch(() => {})
    },
    error: (message, extra) => {
      clientNext.app.log({ service: 'orca', level: 'error', message, extra }).catch(() => {})
    },
  }
  return globalLogger
}

export function getLogger(): Logger {
  if (!globalLogger) {
    // Fallback to console if logger not initialized yet
    return {
      debug: (message, extra) => console.log('[orca]', message, extra ?? ''),
      info: (message, extra) => console.log('[orca]', message, extra ?? ''),
      warn: (message, extra) => console.warn('[orca]', message, extra ?? ''),
      error: (message, extra) => console.error('[orca]', message, extra ?? ''),
    }
  }
  return globalLogger
}
