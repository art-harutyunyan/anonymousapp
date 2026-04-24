'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageCircle, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AppShell } from '@/components/layout/app-shell'
import { getFetchClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { INTENT_LABELS } from '@/lib/supabase/types'
import type { Profile, Message } from '@/lib/supabase/types'

interface ChatRow {
  id: string
  created_at: string
  other_user: Profile
  last_message: Message | null
}

export default function ChatsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getFetchClient() as any
  const { user, loading: authLoading } = useAuthStore()
  const [chats, setChats] = useState<ChatRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (authLoading || !user) return

    const fetchChats = async () => {
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

      const enriched: ChatRow[] = await Promise.all(
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

      enriched.sort((a, b) => {
        const aTime = a.last_message?.created_at ?? a.created_at
        const bTime = b.last_message?.created_at ?? b.created_at
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })

      setChats(enriched)
      setLoading(false)
    }

    fetchChats()
  }, [authLoading, user, db])

  return (
    <AppShell>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-4 h-14 flex items-center gap-3">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h1 className="font-semibold">Chats</h1>
          {chats.length > 0 && (
            <Badge variant="outline" className="border-primary/25 text-primary text-xs ml-auto bg-primary/8">
              {chats.length}
            </Badge>
          )}
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex flex-col gap-3 max-w-xl">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-white/80 border border-black/[0.06] rounded-2xl">
                  <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                  <div className="flex-1 flex flex-col gap-2">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-3 w-48 rounded" />
                  </div>
                  <Skeleton className="h-3 w-12 rounded" />
                </div>
              ))}
            </div>
          ) : chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-black/[0.04] flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="w-9 h-9 text-foreground/35" />
              </div>
              <h2 className="text-xl font-bold font-display mb-2">No chats yet</h2>
              <p className="text-foreground/45 text-sm max-w-xs leading-relaxed">
                Head to Discover and press &ldquo;Start Talking&rdquo; on someone to start a conversation.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-w-xl">
              {chats.map((chat) => {
                const other = chat.other_user
                const initials = other.nickname
                  ? other.nickname.slice(0, 2).toUpperCase()
                  : '??'

                return (
                  <Link
                    key={chat.id}
                    href={`/chat/${chat.id}`}
                    className="flex items-center gap-4 p-4 bg-white/80 border border-black/[0.06] rounded-2xl hover:border-primary/25 hover:bg-white/90 transition-colors group"
                  >
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={other.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#faf6f0]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm truncate text-foreground">
                          {other.nickname ?? 'Anonymous'}
                        </span>
                        <span className="text-xs text-foreground/40 shrink-0">
                          {other.age} · {INTENT_LABELS[other.intent!]}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/50 truncate">
                        {chat.last_message
                          ? chat.last_message.content
                          : <span className="italic">Say hello 👋</span>
                        }
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {chat.last_message ? (
                        <span className="text-xs text-foreground/40 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(chat.last_message.created_at), { addSuffix: true })}
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
