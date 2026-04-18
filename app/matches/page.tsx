'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart, MessageCircle, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AppShell } from '@/components/layout/app-shell'
import { getFetchClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { INTENT_LABELS } from '@/lib/supabase/types'
import type { Profile, Message } from '@/lib/supabase/types'

interface MatchRow {
  id: string
  created_at: string
  other_user: Profile
  last_message: Message | null
}

export default function MatchesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getFetchClient() as any
  const { user, loading: authLoading } = useAuthStore()
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (authLoading || !user) return

    const fetchMatches = async () => {
      setLoading(true)
      const { data: matchRows } = await db
        .from('matches')
        .select('id, user_a, user_b, created_at')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (!matchRows?.length) {
        setLoading(false)
        return
      }

      const enriched: MatchRow[] = await Promise.all(
        matchRows.map(async (m: { id: string; user_a: string; user_b: string; created_at: string }) => {
          const otherUserId = m.user_a === user.id ? m.user_b : m.user_a

          const [{ data: otherUser }, { data: lastMsgs }] = await Promise.all([
            db.from('profiles').select('*').eq('id', otherUserId).single(),
            db
              .from('messages')
              .select('*')
              .eq('match_id', m.id)
              .eq('is_deleted', false)
              .order('created_at', { ascending: false })
              .limit(1),
          ])

          return {
            id: m.id,
            created_at: m.created_at,
            other_user: otherUser!,
            last_message: lastMsgs?.[0] ?? null,
          }
        })
      )

      setMatches(enriched)
      setLoading(false)
    }

    fetchMatches()
  }, [authLoading, user, db])

  return (
    <AppShell>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md px-4 h-14 flex items-center gap-3">
          <Heart className="w-5 h-5 text-primary" />
          <h1 className="font-semibold">Matches</h1>
          {matches.length > 0 && (
            <Badge variant="outline" className="border-primary/30 text-primary text-xs ml-auto">
              {matches.length}
            </Badge>
          )}
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex flex-col gap-3 max-w-xl">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl">
                  <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                  <div className="flex-1 flex flex-col gap-2">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-3 w-48 rounded" />
                  </div>
                  <Skeleton className="h-3 w-12 rounded" />
                </div>
              ))}
            </div>
          ) :matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                <Heart className="w-9 h-9 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No matches yet</h2>
              <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
                Head to Discover and press &ldquo;Start Talking&rdquo; on someone. When they do the same, you&apos;ll match!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-w-xl">
              {matches.map((match) => {
                const other = match.other_user
                const initials = other.nickname
                  ? other.nickname.slice(0, 2).toUpperCase()
                  : '??'

                return (
                  <Link
                    key={match.id}
                    href={`/chat/${match.id}`}
                    className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl hover:border-primary/30 hover:bg-card/80 transition-colors group"
                  >
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={other.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      {/* Online dot placeholder */}
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm truncate">
                          {other.nickname ?? 'Anonymous'}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {other.age} · {INTENT_LABELS[other.intent!]}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {match.last_message
                          ? match.last_message.content
                          : <span className="italic">Say hello 👋</span>
                        }
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {match.last_message ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(match.last_message.created_at), { addSuffix: true })}
                        </span>
                      ) : (
                        <MessageCircle className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
