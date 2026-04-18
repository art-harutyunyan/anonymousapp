// Lightweight scoped logger.
//
// Enabled when ANY of the following are true (checked at call time, so you can
// flip it from devtools without reloading):
//   • NEXT_PUBLIC_DEBUG === '1' / 'true'   (build-time / .env.local)
//   • localStorage.debug === '1' / 'true'  (runtime flag — set in devtools)
//
// Errors and warnings are ALWAYS printed regardless of the flag, so production
// still surfaces real problems.  Use `log.info()` / `log.debug()` for chatter
// that should only appear while debugging.

type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_STYLE: Record<Level, string> = {
  debug: 'color:#888',
  info:  'color:#3b82f6',
  warn:  'color:#f59e0b;font-weight:600',
  error: 'color:#ef4444;font-weight:600',
}

function isEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DEBUG === '1' || process.env.NEXT_PUBLIC_DEBUG === 'true') return true
  if (typeof window === 'undefined') return false
  try {
    const flag = window.localStorage.getItem('debug')
    return flag === '1' || flag === 'true'
  } catch {
    return false
  }
}

function ts(): string {
  const d = new Date()
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

function emit(level: Level, scope: string, args: unknown[]) {
  if (level === 'debug' || level === 'info') {
    if (!isEnabled()) return
  }
  const prefix = `%c[${ts()}] ${scope}`
  const style  = LEVEL_STYLE[level]
  const fn     = level === 'error' ? console.error
                : level === 'warn' ? console.warn
                : level === 'info' ? console.info
                : console.log
  fn(prefix, style, ...args)
}

export interface ScopedLogger {
  debug: (...args: unknown[]) => void
  info:  (...args: unknown[]) => void
  warn:  (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

export function createLogger(scope: string): ScopedLogger {
  return {
    debug: (...a) => emit('debug', scope, a),
    info:  (...a) => emit('info',  scope, a),
    warn:  (...a) => emit('warn',  scope, a),
    error: (...a) => emit('error', scope, a),
  }
}

// Convenience: toggle from devtools with `debugOn()` / `debugOff()`.
if (typeof window !== 'undefined') {
  const w = window as unknown as Record<string, unknown>
  w.debugOn  = () => { try { localStorage.setItem('debug', '1'); console.info('[debug] enabled — reload to apply to already-mounted listeners') } catch {} }
  w.debugOff = () => { try { localStorage.removeItem('debug');   console.info('[debug] disabled') } catch {} }
}
