import { create } from 'zustand'

// High-level status of the realtime socket.  Derived from heartbeat callbacks
// and the online/offline browser events.  We keep this coarse on purpose —
// consumers only need to know "is live data flowing, and how fast".
export type ConnectionStatus =
  | 'connecting'   // socket opening or heartbeat in-flight before first ok
  | 'connected'    // heartbeat ok received
  | 'degraded'     // connected but last heartbeat was slow or errored once
  | 'disconnected' // socket closed / timed-out
  | 'offline'      // navigator.onLine === false

interface ConnectionState {
  status: ConnectionStatus
  // Latency of the last heartbeat round-trip in ms, or null before the first
  // successful heartbeat.
  latencyMs: number | null
  // Rolling count of disconnect/reconnect cycles since the provider mounted.
  reconnectCount: number
  // Epoch-ms timestamps for the last status-change events.  Useful for "you've
  // been disconnected for N seconds" UI, or for debugging.
  lastConnectedAt: number | null
  lastDisconnectedAt: number | null

  setStatus: (status: ConnectionStatus) => void
  setLatency: (latencyMs: number | null) => void
  registerReconnect: () => void
  reset: () => void
}

const INITIAL = {
  status: 'connecting' as ConnectionStatus,
  latencyMs: null,
  reconnectCount: 0,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  ...INITIAL,
  setStatus: (status) => {
    const prev = get().status
    if (prev === status) return
    const now = Date.now()
    set({
      status,
      lastConnectedAt:    status === 'connected'    ? now : get().lastConnectedAt,
      lastDisconnectedAt: status === 'disconnected' || status === 'offline' ? now : get().lastDisconnectedAt,
    })
  },
  setLatency: (latencyMs) => set({ latencyMs }),
  registerReconnect: () => set((s) => ({ reconnectCount: s.reconnectCount + 1 })),
  reset: () => set(INITIAL),
}))
