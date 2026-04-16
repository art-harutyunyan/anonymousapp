'use client'

import { createContext, useContext, useEffect, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient, setAccessToken } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/auth-store'

const Context = createContext<SupabaseClient | undefined>(undefined)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const supabase = useRef(createClient())
  const { setUser, setProfile, setLoading } = useAuthStore()

  useEffect(() => {
    const client = supabase.current

    // Get initial session
    client.auth.getSession().then(async ({ data: { session } }) => {
      setAccessToken(session?.access_token ?? '')
      setUser(session?.user ?? null)
      if (session?.user) {
        const { data } = await client
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        setProfile(data)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
      setAccessToken(session?.access_token ?? '')
      setUser(session?.user ?? null)
      if (session?.user && event !== 'SIGNED_OUT') {
        const { data } = await client
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        setProfile(data)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
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
