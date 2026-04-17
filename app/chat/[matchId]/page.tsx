'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import { toast } from 'sonner'
import {
  ArrowLeft, Send, MoreVertical, ShieldAlert, UserX, Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ReportDialog } from '@/components/chat/report-dialog'
import { useSupabase } from '@/components/providers/supabase-provider'
import { getFetchClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/auth-store'
import type { Message, Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const matchId = params.matchId as string
  // supabase (main client): realtime channel only
  // db (fetch client): all REST data operations — bypasses the auth lock so
  //   sends are never queued behind a concurrent token refresh
  const supabase = useSupabase()
  const db = getFetchClient()
  const { user } = useAuthStore()

  const [messages, setMessages] = useState<Message[]>([])
  const [otherUser, setOtherUser] = useState<Profile | null>(null)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reportOpen, setReportOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    }, 50)
  }, [])

  const reloadMessages = useCallback(async () => {
    const { data } = await db
      .from('messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
    if (data) {
      setMessages(data)
      scrollToBottom()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  // Initialise match data and message history once
  useEffect(() => {
    if (!user?.id || !matchId) return
    let cancelled = false

    const init = async () => {
      const { data: match } = await db
        .from('matches')
        .select('user_a, user_b, is_active')
        .eq('id', matchId)
        .single()

      if (cancelled) return

      if (!match?.is_active) {
        toast.error('This match is no longer active')
        router.push('/matches')
        return
      }

      const otherUserId = match.user_a === user.id ? match.user_b : match.user_a
      const { data: other } = await db
        .from('profiles')
        .select('*')
        .eq('id', otherUserId)
        .single()

      if (cancelled) return
      setOtherUser(other)

      const { data: msgs } = await db
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true })

      if (cancelled) return
      setMessages(msgs ?? [])
      setLoading(false)
      scrollToBottom()
    }

    init()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, matchId])

  // Realtime subscription — one channel for the lifetime of the page.
  // Supabase's WS client reconnects automatically; we don't rebuild the
  // channel on visibility change. On wake-up we reload messages to fill the gap.
  useEffect(() => {
    if (!user?.id || !matchId) return

    const channel = supabase
      .channel(`chat:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const incoming = payload.new as Message
          setMessages((prev) => {
            // Already present (e.g. from the insert's RETURNING or a prior reload)
            if (prev.some((m) => m.id === incoming.id)) return prev
            // Replace any temp optimistic message for this content+sender so we
            // don't show a duplicate when the RETURNING path returned null.
            const withoutTemp = prev.filter(
              (m) =>
                !(
                  m.id.startsWith('temp-') &&
                  m.sender_id === incoming.sender_id &&
                  m.content === incoming.content
                )
            )
            return [...withoutTemp, incoming]
          })
          scrollToBottom()
        }
      )
      .subscribe((status) => {
        // Fill any gap after initial connect or automatic reconnect
        if (status === 'SUBSCRIBED') reloadMessages()
      })

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      // Reload messages to fill any gap while the tab was hidden.
      // Supabase refreshes the auth token automatically on the next API call —
      // calling refreshSession() manually causes a lock conflict with the
      // client's own refresh mechanism, so we let it handle auth itself.
      reloadMessages()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, matchId])

  const sendMessage = async () => {
    const content = messageText.trim()
    if (!content || !user) return
    setSending(true)
    setMessageText('')

    // Optimistically show the message immediately so the sender isn't left
    // wondering if it went through, especially right after a reconnect.
    const tempId = `temp-${Date.now()}`
    const optimistic: Message = {
      id: tempId,
      match_id: matchId,
      sender_id: user.id,
      content,
      is_deleted: false,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    scrollToBottom()

    try {
      // Race the insert against a 10 s timeout. If the network stack isn't
      // restored yet after a browser wake-up, fetch can hang indefinitely —
      // without a timeout, finally never runs and the input stays locked.
      //
      // .maybeSingle() instead of .single(): if the INSERT succeeds but the
      // RETURNING select is blocked by RLS (returns 0 rows), .single() would
      // throw PGRST116 and we'd show "Failed to send" even though the message
      // is already in the database. .maybeSingle() returns null on 0 rows so
      // we can handle the two cases separately.
      const { data: sent, error } = await Promise.race([
        db
          .from('messages')
          .insert({ match_id: matchId, sender_id: user.id, content })
          .select()
          .maybeSingle(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('send_timeout')), 10_000)
        ),
      ])

      if (error) throw error

      if (sent) {
        // Normal path: swap the temp placeholder for the confirmed DB row.
        setMessages((prev) => {
          if (prev.some((m) => m.id === tempId)) {
            return prev.map((m) => (m.id === tempId ? sent : m))
          }
          if (prev.some((m) => m.id === sent.id)) return prev
          return [...prev, sent].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        })
      } else {
        // INSERT succeeded but RETURNING was silently blocked by RLS.
        // The message IS in the database — reload to replace the temp row.
        reloadMessages()
      }
    } catch (err) {
      // Real insert failure or timeout: roll back and restore input
      console.error('[chat] sendMessage failed:', err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setMessageText(content)
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleBlock = async () => {
    if (!user || !otherUser) return
    const { error } = await db.from('blocks').insert({
      blocker_id: user.id,
      blocked_id: otherUser.id,
    })
    if (!error) {
      await db
        .from('matches')
        .update({ is_active: false })
        .eq('id', matchId)
      toast.success(`${otherUser.nickname ?? 'User'} has been blocked`)
      router.push('/matches')
    }
  }

  const handleDeleteMessage = async (msgId: string) => {
    await db
      .from('messages')
      .update({ is_deleted: true })
      .eq('id', msgId)
      .eq('sender_id', user!.id)
    setMessages((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, is_deleted: true } : m)
    )
  }

  const initials = otherUser?.nickname
    ? otherUser.nickname.slice(0, 2).toUpperCase()
    : '??'

  return (
    <div className="flex flex-col h-screen md:h-[calc(100vh)] md:ml-60 bg-background">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border bg-card/80 backdrop-blur-md shrink-0">
        <Button variant="ghost" size="icon" onClick={() => router.push('/matches')} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <Avatar className="w-8 h-8">
          <AvatarImage src={otherUser?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-xs">{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{otherUser?.nickname ?? 'Anonymous'}</p>
          {otherUser?.country && (
            <p className="text-xs text-muted-foreground truncate">{otherUser.country}</p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-secondary transition-colors shrink-0">
            <MoreVertical className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setReportOpen(true)}
            >
              <ShieldAlert className="w-4 h-4 mr-2" />
              Report user
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleBlock}
            >
              <UserX className="w-4 h-4 mr-2" />
              Block user
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4" ref={scrollRef}>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              You matched! Say hello to <strong>{otherUser?.nickname ?? 'Anonymous'}</strong> 👋
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-w-2xl mx-auto">
            {messages.map((msg, idx) => {
              const isMe = msg.sender_id === user?.id
              const prevMsg = messages[idx - 1]
              const showTime =
                !prevMsg ||
                new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60 * 1000

              return (
                <div key={msg.id}>
                  {showTime && (
                    <p className="text-center text-xs text-muted-foreground my-3">
                      {format(new Date(msg.created_at), 'PPp')}
                    </p>
                  )}
                  <div className={cn('flex items-end gap-2', isMe ? 'flex-row-reverse' : 'flex-row')}>
                    {!isMe && (
                      <Avatar className="w-6 h-6 mb-1 shrink-0">
                        <AvatarImage src={otherUser?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary text-[8px]">{initials}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className={cn(
                      'group relative max-w-[72%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                      isMe
                        ? 'brand-gradient text-white rounded-br-sm'
                        : 'bg-card border border-border rounded-bl-sm',
                      msg.is_deleted && 'opacity-50'
                    )}>
                      {msg.is_deleted ? (
                        <span className="italic text-xs">Message deleted</span>
                      ) : (
                        msg.content
                      )}

                      {/* Delete own message */}
                      {isMe && !msg.is_deleted && (
                        <button
                          className="absolute -top-2 -left-6 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-secondary border border-border"
                          onClick={() => handleDeleteMessage(msg.id)}
                          title="Delete message"
                        >
                          <Trash2 className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-card/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            className="flex-1 bg-secondary border-0 focus-visible:ring-primary/30 rounded-xl"
            maxLength={2000}
            disabled={sending}
            autoFocus
          />
          <Button
            size="icon"
            className="brand-gradient border-0 text-white w-10 h-10 shrink-0"
            onClick={sendMessage}
            disabled={!messageText.trim() || sending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-1.5">
          {messageText.length}/2000
        </p>
      </div>

      {otherUser && (
        <ReportDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          reportedUserId={otherUser.id}
          reportedNickname={otherUser.nickname ?? 'Anonymous'}
        />
      )}
    </div>
  )
}
