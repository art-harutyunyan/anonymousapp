'use client'

import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react'
import { useConnectionStore, type ConnectionStatus } from '@/lib/stores/connection-store'
import { cn } from '@/lib/utils'

// Compact pill that shows realtime socket health.  Size is tuned to fit next
// to the "logged in as" banner and inside the chat header without shifting
// layout — text hides below `sm:` so it never overflows on mobile.

interface VisualConfig {
  label: string
  className: string
  Icon: typeof Wifi
  spin?: boolean
}

const VISUAL: Record<ConnectionStatus, VisualConfig> = {
  connected:    { label: 'Live',         className: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10', Icon: Wifi },
  connecting:   { label: 'Connecting',   className: 'text-muted-foreground border-border bg-secondary',          Icon: Loader2, spin: true },
  degraded:     { label: 'Slow',         className: 'text-amber-500 border-amber-500/30 bg-amber-500/10',        Icon: AlertTriangle },
  disconnected: { label: 'Reconnecting', className: 'text-destructive border-destructive/30 bg-destructive/10',  Icon: WifiOff },
  offline:      { label: 'Offline',      className: 'text-destructive border-destructive/30 bg-destructive/10',  Icon: WifiOff },
}

function latencyTone(ms: number | null): string {
  if (ms == null) return 'text-muted-foreground'
  if (ms < 150)   return 'text-emerald-500'
  if (ms < 500)   return 'text-amber-500'
  return 'text-destructive'
}

export function ConnectionIndicator({ className }: { className?: string }) {
  const status    = useConnectionStore((s) => s.status)
  const latencyMs = useConnectionStore((s) => s.latencyMs)
  const reconnects = useConnectionStore((s) => s.reconnectCount)
  const { Icon, label, className: statusClass, spin } = VISUAL[status]

  // Only show latency while we actually have a live connection — a stale
  // number next to "Reconnecting" would mislead.
  const showLatency = status === 'connected' || status === 'degraded'

  const title =
    `Realtime: ${label}` +
    (latencyMs != null ? ` · ${latencyMs} ms` : '') +
    (reconnects > 0 ? ` · ${reconnects} reconnect${reconnects === 1 ? '' : 's'}` : '')

  return (
    <div
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium select-none',
        statusClass,
        className,
      )}
    >
      <Icon className={cn('w-3 h-3', spin && 'animate-spin')} />
      <span className="hidden sm:inline">{label}</span>
      {showLatency && latencyMs != null && (
        <span className={cn('tabular-nums', latencyTone(latencyMs))}>
          {latencyMs}ms
        </span>
      )}
    </div>
  )
}
