'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Eye, Crown, Lock } from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useSupabase } from '@/components/providers/supabase-provider'
import { useAuthStore } from '@/lib/stores/auth-store'
import { INTENT_LABELS, ageRangeLabel } from '@/lib/supabase/types'
import type { Profile } from '@/lib/supabase/types'

interface LikedByEntry {
  from_user: string
  created_at: string
  profile: Profile
}

export default function LikedMePage() {
  const supabase = useSupabase()
  const router = useRouter()
  const { user, profile } = useAuthStore()
  const [entries, setEntries] = useState<LikedByEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !profile?.is_premium) { setLoading(false); return }

    const fetchLikedBy = async () => {
      // Users who pressed start_talking on me but I haven't responded to yet
      const { data, error } = await supabase
        .from('discovery_actions')
        .select('from_user, created_at, profile:profiles!discovery_actions_from_user_fkey(*)')
        .eq('to_user', user.id)
        .eq('action', 'start_talking')
        .not('from_user', 'in', `(
          select to_user from discovery_actions where from_user = '${user.id}'
        )`)
        .order('created_at', { ascending: false })
        .limit(50)

      setLoading(false)
      if (!error) setEntries((data ?? []) as unknown as LikedByEntry[])
    }

    fetchLikedBy()
  }, [user, profile]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile?.is_premium) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Premium Feature</h1>
          <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
            See who pressed &ldquo;Start Talking&rdquo; on you before you&apos;ve acted on them. Upgrade to Premium to unlock.
          </p>
          <Button className="brand-gradient border-0 text-white" onClick={() => router.push('/premium')}>
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to Premium
          </Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Eye className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Who Liked You</h1>
            <p className="text-xs text-muted-foreground">People who pressed Start Talking on you — go start the conversation</p>
          </div>
          <Badge className="ml-auto brand-gradient border-0 text-white text-xs">
            <Crown className="w-3 h-3 mr-1" /> Premium
          </Badge>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card">
                <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <Skeleton className="h-9 w-28 rounded-xl" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <Eye className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-1">Nobody yet</h2>
            <p className="text-muted-foreground text-sm">
              When someone presses Start Talking on you before you&apos;ve seen them, they&apos;ll appear here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((entry) => {
              const displayName = entry.profile.nickname ?? 'Anonymous'
              const initials = displayName.slice(0, 2).toUpperCase()
              return (
                <div key={entry.from_user} className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/20 transition-colors">
                  <Avatar className="w-12 h-12 shrink-0">
                    <AvatarImage src={entry.profile.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {ageRangeLabel(entry.profile.age)} · {INTENT_LABELS[entry.profile.intent]} · {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="brand-gradient border-0 text-white shrink-0"
                    onClick={() => router.push('/discover')}
                  >
                    Discover
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
