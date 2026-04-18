import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/debug/log'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const log = createLogger('supabase')

// Current session JWT — kept fresh by SupabaseProvider calling setAccessToken()
// whenever the session changes.
let _accessToken = ''
export function setAccessToken(token: string) {
  const changed = token !== _accessToken
  _accessToken = token
  if (changed) log.debug('access token', token ? `updated (len=${token.length})` : 'cleared')
}

// ─── Main client ──────────────────────────────────────────────────────────────
// Used for: auth (getSession / onAuthStateChange) and realtime subscriptions.
// Uses @supabase/ssr so the session cookie is shared with Next.js middleware.
//
// flowType: 'implicit' — PKCE (the default) requires crypto.subtle which is
// only available in secure contexts (HTTPS / localhost). On a real mobile device
// accessing the dev server via HTTP over a local IP the PKCE initialisation
// throws, React hydration fails, and the page renders without any event
// handlers. Implicit flow works on HTTP and is fine for email+password auth.
export function createClient() {
  log.info('creating browser client', { url: SUPABASE_URL })
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: 'implicit' },
    realtime: {
      // Route the realtime socket's internal logs through our scoped logger so
      // they stay silent in production but show up when debug is enabled.
      logger: (kind, msg, data) => {
        const line = `[realtime] ${kind}: ${msg}`
        if (kind === 'error') log.error(line, data ?? '')
        else if (kind === 'warn') log.warn(line, data ?? '')
        else log.debug(line, data ?? '')
      },
    },
  })
}

// ─── Fetch client ─────────────────────────────────────────────────────────────
// Used for: REST data operations (INSERT, SELECT, UPDATE).
//
// Problem: the main client serialises every auth-token op (including the
// realtime channel's periodic refresh) behind a navigator.locks lock.  Each
// REST call must call getSession() to obtain the current JWT — if a refresh
// holds the lock, the call queues with NO timeout and our 10 s send-timer fires
// first → "Failed to send message".
//
// Solution: a second, auth-unmanaged client that receives the token via the
// `accessToken` callback instead.  That path bypasses getSession() entirely, so
// REST calls are never blocked by a concurrent refresh.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _fetchClient: SupabaseClient<any> | null = null
export function getFetchClient() {
  if (!_fetchClient) {
    log.info('creating fetch client')
    _fetchClient = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      accessToken: async () => _accessToken,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as SupabaseClient<any>
  }
  return _fetchClient
}
