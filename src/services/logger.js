/**
 * Structured logger for cloudgames Vue 3 app.
 * Provides tagged, leveled, color-coded console output.
 *
 * Usage:
 *   import { createLogger } from '@/services/logger'
 *   const log = createLogger('MyModule')
 *   log.info('Something happened', { detail: 42 })
 *
 * Quick replacement for console.log:
 *   import { logger } from '@/services/logger'
 *   logger.info('App started')
 *
 * Log levels: debug=0, info=1, warn=2, error=3, silent=4
 *   import { setLogLevel, LogLevel } from '@/services/logger'
 *   setLogLevel(LogLevel.WARN)
 */

// ─── Log levels ───────────────────────────────────────────────
const LogLevel = Object.freeze({
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4,
})

// ─── CSS styles for colored browser console output ────────────
const STYLES = {
  DEBUG: 'color: #888',
  INFO: 'color: #42a5f5',
  WARN: 'color: #ff9800; font-weight: bold',
  ERROR: 'color: #ef5350; font-weight: bold',
}

// ─── Global state ─────────────────────────────────────────────
const isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD === true
let currentLevel = isProd ? LogLevel.WARN : LogLevel.DEBUG

// ─── Helpers ──────────────────────────────────────────────────

function isEnabled(level) {
  return level >= currentLevel
}

/**
 * Emit a log message with tag prefix and optional styling.
 * @param {string} level - DEBUG | INFO | WARN | ERROR
 * @param {string} tag   - logger tag
 * @param {*}      msg   - primary message
 * @param {Array}  args  - additional args
 * @param {Function} fn  - console method
 */
function emit(level, tag, msg, args, fn) {
  const numericLevel = LogLevel[level]
  if (!isEnabled(numericLevel)) return

  const style = STYLES[level] || ''
  fn(`%c[${tag}] ${msg}`, style, ...args)
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Create a logger instance bound to a tag.
 *
 * @param {string} tag - Module / component name used as `[tag]` prefix
 * @returns {{ debug, info, warn, error }}
 */
export function createLogger(tag) {
  return {
    debug(msg, ...args) {
      emit('DEBUG', tag, msg, args, console.debug)
    },
    info(msg, ...args) {
      emit('INFO', tag, msg, args, console.log)
    },
    warn(msg, ...args) {
      emit('WARN', tag, msg, args, console.warn)
    },
    error(msg, ...args) {
      emit('ERROR', tag, msg, args, console.error)
    },
  }
}

/**
 * Set the global minimum log level.
 * Messages below this level are suppressed.
 *
 * @param {number} level - One of LogLevel.DEBUG | INFO | WARN | ERROR | SILENT
 */
export function setLogLevel(level) {
  if (Object.values(LogLevel).includes(level)) {
    currentLevel = level
  }
}

/**
 * Get the current global log level.
 * @returns {number}
 */
export function getLogLevel() {
  return currentLevel
}

// ─── Default logger instance ──────────────────────────────────

/** Quick-use logger tagged "App" – drop-in for console.log */
export const logger = createLogger('App')

export { LogLevel }
