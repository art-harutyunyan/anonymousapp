'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  ArrowLeft, Send, MoreVertical, ShieldAlert, UserX, Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ReportDialog } from '@/components/chat/report-dialog'
import { ConnectionIndicator } from '@/components/layout/connection-indicator'
import { useSupabase } from '@/components/providers/supabase-provider'
import { getFetchClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { createLogger } from '@/lib/debug/log'
import type { Message, Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

const log = createLogger('chat')

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const matchId = params.matchId as string
  const supabase = useSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getFetchClient() as any
  const { user } = useAuthStore()

  const [messages, setMessages] = useState<Message[]>([])
  const [otherUser, setOtherUser] = useState<Profile | null>(null)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reportOpen, setReportOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    }, 50)
  }, [])

  const reloadMessages = useCallback(async () => {
    const t0 = performance.now()
    const { data, error } = await db
      .from('messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
    const dt = Math.round(performance.now() - t0)
    if (error) {
      log.error(`reload messages failed (${dt} ms)`, error)
      return
    }
    log.debug(`reload messages ok (${dt} ms, ${data?.length ?? 0} rows)`)
    if (data) {
      setMessages(data)
      scrollToBottom()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  useEffect(() => {
    if (!user?.id || !matchId) return
    let cancelled = false

    const init = async () => {
      log.info('init', { matchId, userId: user.id })
      const { data: match, error: matchErr } = await db
        .from('matches')
        .select('user_a, user_b, is_active')
        .eq('id', matchId)
        .single() as { data: { user_a: string; user_b: string; is_active: boolean } | null; error: unknown }

      if (cancelled) return

      if (matchErr) log.error('match fetch failed', matchErr)

      if (!match?.is_active) {
        log.warn('match inactive, redirecting', match)
        toast.error('This match is no longer active')
        router.push('/matches')
        return
      }

      const otherUserId = match.user_a === user.id ? match.user_b : match.user_a
      const { data: other, error: profileErr } = await db
        .from('profiles')
        .select('*')
        .eq('id', otherUserId)
        .single()
      if (profileErr) log.warn('other profile fetch failed', profileErr)

      if (cancelled) return
      setOtherUser(other)

      const { data: msgs, error: msgsErr } = await db
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true })
      if (msgsErr) log.error('initial messages fetch failed', msgsErr)

      if (cancelled) return
      log.info(`loaded ${msgs?.length ?? 0} messages`)
      setMessages(msgs ?? [])
      setLoading(false)
      scrollToBottom()
    }

    init()
    return () => {
      log.debug('init cancelled on unmount')
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, matchId])

  useEffect(() => {
    if (!user?.id || !matchId) return

    const topic = `chat:${matchId}`
    log.info('subscribing to channel', topic)

    const channel = supabase
      .channel(topic)
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
          log.debug('realtime INSERT', { id: incoming.id, from: incoming.sender_id })
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) {
              log.debug('realtime INSERT dedup (already present)', incoming.id)
              return prev
            }
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
      .subscribe((status, err) => {
        log.info(`channel status: ${status}`, err ?? '')
        if (status === 'SUBSCRIBED') reloadMessages()
        if (status === 'CHANNEL_ERROR') log.error('channel error', err)
        if (status === 'TIMED_OUT')     log.warn('channel timed out — will retry')
        if (status === 'CLOSED')        log.warn('channel closed')
      })

    const handleVisibilityChange = () => {
      log.debug('visibility', document.visibilityState)
      if (document.visibilityState !== 'visible') return
      reloadMessages()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      log.info('unsubscribing channel', topic)
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

    const t0 = performance.now()
    log.info('sendMessage start', { tempId, len: content.length })
    try {
      const { data: sent, error } = await Promise.race([
        (db
          .from('messages')
          .insert({ match_id: matchId, sender_id: user.id, content })
          .select()
          .maybeSingle() as Promise<{ data: Message | null; error: unknown }>),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('send_timeout')), 10_000)
        ),
      ])

      const dt = Math.round(performance.now() - t0)
      if (error) {
        log.error(`sendMessage insert error (${dt} ms)`, error)
        throw error
      }

      if (sent) {
        log.info(`sendMessage ok (${dt} ms)`, { id: sent.id })
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
        log.warn(`sendMessage: RETURNING blocked by RLS (${dt} ms) — reloading`)
        reloadMessages()
      }
    } catch (err) {
      const dt = Math.round(performance.now() - t0)
      log.error(`sendMessage failed (${dt} ms)`, err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setMessageText(content)
      toast.error('Failed to send message')
    } finally {
      setSending(false)
      inputRef.current?.focus()
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
    <div className="flex flex-col h-screen md:ml-60 bg-background">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border bg-white/80 backdrop-blur-xl shrink-0">
        <Button variant="ghost" size="icon" onClick={() => router.push('/matches')} className="shrink-0 text-foreground/50 hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <Avatar className="w-8 h-8">
          <AvatarImage src={otherUser?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate text-foreground">{otherUser?.nickname ?? 'Anonymous'}</p>
          {otherUser?.country && (
            <p className="text-xs text-foreground/40 truncate">{otherUser.country}</p>
          )}
        </div>

        <ConnectionIndicator className="shrink-0" />

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-black/[0.04] transition-colors shrink-0">
            <MoreVertical className="w-4 h-4 text-foreground/50" />
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
          <div className="flex flex-col gap-3 px-4 py-4 max-w-2xl mx-auto w-full">
            <div className="flex gap-3"><Skeleton className="w-8 h-8 rounded-full shrink-0" /><Skeleton className="h-10 w-48 rounded-2xl" /></div>
            <div className="flex gap-3 self-end flex-row-reverse"><Skeleton className="w-8 h-8 rounded-full shrink-0" /><Skeleton className="h-10 w-56 rounded-2xl" /></div>
            <div className="flex gap-3"><Skeleton className="w-8 h-8 rounded-full shrink-0" /><Skeleton className="h-16 w-64 rounded-2xl" /></div>
            <div className="flex gap-3 self-end flex-row-reverse"><Skeleton className="w-8 h-8 rounded-full shrink-0" /><Skeleton className="h-10 w-40 rounded-2xl" /></div>
            <div className="flex gap-3"><Skeleton className="w-8 h-8 rounded-full shrink-0" /><Skeleton className="h-10 w-52 rounded-2xl" /></div>
          </div>
        ) :messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-foreground/45">
              You matched! Say hello to <strong className="text-foreground">{otherUser?.nickname ?? 'Anonymous'}</strong> 👋
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
                    <p className="text-center text-xs text-foreground/35 my-3">
                      {format(new Date(msg.created_at), 'PPp')}
                    </p>
                  )}
                  <div className={cn('flex items-end gap-2', isMe ? 'flex-row-reverse' : 'flex-row')}>
                    {!isMe && (
                      <Avatar className="w-6 h-6 mb-1 shrink-0">
                        <AvatarImage src={otherUser?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-[8px] font-semibold">{initials}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className={cn(
                      'group relative max-w-[72%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                      isMe
                        ? 'brand-gradient text-white rounded-br-sm'
                        : 'bg-white border border-black/[0.06] text-foreground rounded-bl-sm',
                      msg.is_deleted && 'opacity-50'
                    )}>
                      {msg.is_deleted ? (
                        <span className="italic text-xs">Message deleted</span>
                      ) : (
                        msg.content
                      )}

                      {isMe && !msg.is_deleted && (
                        <button
                          className="absolute -top-2 -left-6 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-white border border-black/[0.08] shadow-sm"
                          onClick={() => handleDeleteMessage(msg.id)}
                          title="Delete message"
                        >
                          <Trash2 className="w-3 h-3 text-foreground/45" />
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
      <div className="px-4 py-3 border-t border-border bg-white/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <Input
            ref={inputRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            className="flex-1 bg-black/[0.04] border-0 focus-visible:ring-primary/25 rounded-xl text-foreground placeholder:text-foreground/30"
            maxLength={2000}
            disabled={sending}
            autoFocus
          />
          <Button
            size="icon"
            className="brand-gradient border-0 text-white w-10 h-10 shrink-0 rounded-xl shadow-[0_4px_16px_rgba(124,58,237,0.25)]"
            onClick={sendMessage}
            disabled={!messageText.trim() || sending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-center text-xs text-foreground/30 mt-1.5">
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
