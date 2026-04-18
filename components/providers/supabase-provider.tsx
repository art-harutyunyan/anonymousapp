'use client'

import { createContext, useContext, useEffect, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient, setAccessToken } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useConnectionStore } from '@/lib/stores/connection-store'
import { createLogger } from '@/lib/debug/log'

const log = createLogger('supabase-provider')

const Context = createContext<SupabaseClient | undefined>(undefined)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const supabase = useRef(createClient())
  const { setUser, setProfile, setLoading } = useAuthStore()

  useEffect(() => {
    const client = supabase.current
    const conn = useConnectionStore.getState()

    // ── Auth lifecycle ─────────────────────────────────────────────────────
    log.info('bootstrapping session')
    client.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) log.error('getSession failed', error)
      log.info('initial session', {
        hasUser: !!session?.user,
        userId: session?.user?.id,
        expiresAt: session?.expires_at,
      })
      setAccessToken(session?.access_token ?? '')
      setUser(session?.user ?? null)
      if (session?.user) {
        const { data, error: profileErr } = await client
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        if (profileErr) log.warn('initial profile fetch failed', profileErr)
        setProfile(data)
      }
      setLoading(false)
    })

    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
      log.info('auth event', event, {
        hasUser: !!session?.user,
        userId: session?.user?.id,
      })
      setAccessToken(session?.access_token ?? '')
      setUser(session?.user ?? null)
      if (session?.user && event !== 'SIGNED_OUT') {
        const { data, error } = await client
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        if (error) log.warn('profile refresh failed', error)
        setProfile(data)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    // ── Realtime socket health ─────────────────────────────────────────────
    // Heartbeat drives our "connected / degraded / disconnected" status and
    // gives us the round-trip latency the indicator shows.
    //
    // Status meanings (from @supabase/realtime-js):
    //   sent          — heartbeat was just sent, awaiting reply
    //   ok            — reply received; `latency` is the round-trip in ms
    //   error         — server responded with an error
    //   timeout       — no reply within the timeout window → socket will reconnect
    //   disconnected  — heartbeat skipped because socket is down
    client.realtime.onHeartbeat((status, latency) => {
      switch (status) {
        case 'sent':
          if (conn.status !== 'connected') conn.setStatus('connecting')
          log.debug('heartbeat sent')
          break
        case 'ok':
          conn.setStatus('connected')
          if (typeof latency === 'number') {
            conn.setLatency(latency)
            log.debug(`heartbeat ok (${latency} ms)`)
            if (latency > 1000) {
              log.warn(`high realtime latency: ${latency} ms`)
              conn.setStatus('degraded')
            }
          }
          break
        case 'error':
          log.warn('heartbeat error')
          conn.setStatus('degraded')
          break
        case 'timeout':
          log.warn('heartbeat timed out — socket will reconnect')
          conn.setStatus('disconnected')
          conn.registerReconnect()
          break
        case 'disconnected':
          log.warn('heartbeat skipped — socket disconnected')
          conn.setStatus('disconnected')
          break
      }
    })

    // navigator online/offline feeds into the same store so the pill flips to
    // "offline" immediately instead of waiting for the next heartbeat timeout.
    const handleOnline = () => {
      log.info('browser online')
      conn.setStatus(client.realtime.isConnected() ? 'connected' : 'connecting')
    }
    const handleOffline = () => {
      log.warn('browser offline')
      conn.setStatus('offline')
    }
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      conn.setStatus('offline')
    }

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setUser, setProfile, setLoading])

  return (
    <Context.Provider value={supabase.current}>
      {children}
    </Context.Provider>
  )
}

export function useSupabase() {
  const context = useContext(Context)
  if (!context) throw new Error('useSupabase must be used within SupabaseProvider')
  return context
}
