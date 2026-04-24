'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Heart, Pencil, Trash2, MessageCircle, Crown, UserX } from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSupabase } from '@/components/providers/supabase-provider'
import { useAuthStore } from '@/lib/stores/auth-store'
import { INTENT_LABELS, ageRangeLabel } from '@/lib/supabase/types'
import type { SavedConnection, Profile } from '@/lib/supabase/types'

interface SavedWithProfile extends SavedConnection {
  profile: Profile
}

const FREE_LIMIT = 3

export default function SavedPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const { user, profile } = useAuthStore()
  const [connections, setConnections] = useState<SavedWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<SavedWithProfile | null>(null)
  const [editNickname, setEditNickname] = useState('')
  const [editNote, setEditNote] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchConnections = async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('saved_connections')
      .select('*, profile:profiles!saved_connections_connection_id_fkey(*)')
      .eq('owner_id', user.id)
      .order('saved_at', { ascending: false })
    setLoading(false)
    if (error) { toast.error('Failed to load saved connections'); return }
    setConnections((data ?? []) as SavedWithProfile[])
  }

  useEffect(() => { fetchConnections() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (connectionId: string) => {
    const { error } = await supabase
      .from('saved_connections')
      .delete()
      .eq('owner_id', user!.id)
      .eq('connection_id', connectionId)
    if (error) { toast.error('Failed to remove connection'); return }
    setConnections((prev) => prev.filter((c) => c.connection_id !== connectionId))
    toast.success('Connection removed')
  }

  const openEdit = (conn: SavedWithProfile) => {
    setEditTarget(conn)
    setEditNickname(conn.private_nickname ?? '')
    setEditNote(conn.note ?? '')
  }

  const handleSaveEdit = async () => {
    if (!editTarget) return
    setSaving(true)
    const { error } = await supabase
      .from('saved_connections')
      .update({
        private_nickname: editNickname.trim() || null,
        note: profile?.is_premium ? (editNote.trim() || null) : undefined,
      })
      .eq('owner_id', user!.id)
      .eq('connection_id', editTarget.connection_id)
    setSaving(false)
    if (error) { toast.error('Failed to save'); return }
    setConnections((prev) =>
      prev.map((c) =>
        c.connection_id === editTarget.connection_id
          ? { ...c, private_nickname: editNickname.trim() || null, note: editNote.trim() || null }
          : c
      )
    )
    setEditTarget(null)
    toast.success('Saved')
  }

  const handleInvite = async (conn: SavedWithProfile) => {
    const isOnline = conn.profile.last_seen_at &&
      new Date(conn.profile.last_seen_at) > new Date(Date.now() - 5 * 60 * 1000)

    if (!isOnline && !profile?.is_premium) {
      toast.error('Upgrade to Premium to invite offline connections')
      return
    }

    // Create a fresh discovery action so try_create_match can fire
    // (they may need to also opt-in from their discover page)
    const { error } = await supabase
      .from('discovery_actions')
      .upsert(
        { from_user: user!.id, to_user: conn.connection_id, action: 'start_talking' },
        { onConflict: 'from_user,to_user' }
      )
    if (error) { toast.error('Failed to send invite'); return }
    toast.success(`Invite sent to ${conn.private_nickname ?? conn.profile.nickname ?? 'Anonymous'}`)
  }

  const slotInfo = profile?.is_premium
    ? null
    : `${connections.length} / ${FREE_LIMIT} slots used`

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Heart className="w-6 h-6 text-primary" />
              Saved Connections
            </h1>
            {slotInfo && (
              <p className="text-xs text-muted-foreground mt-1">{slotInfo} · <button className="underline hover:text-foreground" onClick={() => router.push('/premium')}>Upgrade for unlimited</button></p>
            )}
          </div>
          {!profile?.is_premium && connections.length < FREE_LIMIT && (
            <Badge variant="outline" className="text-xs">
              {FREE_LIMIT - connections.length} slot{FREE_LIMIT - connections.length !== 1 ? 's' : ''} free
            </Badge>
          )}
          {profile?.is_premium && (
            <Badge className="brand-gradient border-0 text-white text-xs">
              <Crown className="w-3 h-3 mr-1" /> Premium
            </Badge>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card">
                <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : connections.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-1">No saved connections yet</h2>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              After a great chat, tap the save button to keep that connection anonymous.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {connections.map((conn) => {
              const displayName = conn.private_nickname ?? conn.profile.nickname ?? 'Anonymous'
              const initials = displayName.slice(0, 2).toUpperCase()
              const isOnline = conn.profile.last_seen_at &&
                new Date(conn.profile.last_seen_at) > new Date(Date.now() - 5 * 60 * 1000)

              return (
                <div key={conn.connection_id} className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/20 transition-colors">
                  <div className="relative shrink-0">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={conn.profile.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    {(profile?.is_premium && isOnline) && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card shadow" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{displayName}</p>
                      {conn.private_nickname && (
                        <span className="text-xs text-muted-foreground truncate hidden sm:block">
                          ({conn.profile.nickname ?? 'Anonymous'})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ageRangeLabel(conn.profile.age)} · {conn.profile.intent ? INTENT_LABELS[conn.profile.intent] : ''} · saved {formatDistanceToNow(new Date(conn.saved_at), { addSuffix: true })}
                    </p>
                    {profile?.is_premium && conn.note && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic truncate">{conn.note}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => handleInvite(conn)} title="Invite to chat">
                      <MessageCircle className="w-4 h-4 text-primary" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => openEdit(conn)} title="Edit">
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => handleDelete(conn.connection_id)} title="Remove">
                      <UserX className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Upgrade nudge when at limit */}
        {!profile?.is_premium && connections.length >= FREE_LIMIT && (
          <div className="mt-6 p-4 rounded-2xl border border-primary/30 bg-primary/5 text-center">
            <Crown className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">You&apos;ve used all {FREE_LIMIT} free slots</p>
            <p className="text-xs text-muted-foreground mb-3">Upgrade to Premium for unlimited saved connections.</p>
            <Button size="sm" className="brand-gradient border-0 text-white" onClick={() => router.push('/premium')}>
              Upgrade to Premium
            </Button>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Connection</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pnick">Private nickname</Label>
              <Input
                id="pnick"
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                maxLength={30}
                placeholder="Your private label for this person"
              />
              <p className="text-xs text-muted-foreground">Only visible to you</p>
            </div>
            {profile?.is_premium && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="note">Note <Badge variant="outline" className="text-[10px] ml-1"><Crown className="w-2.5 h-2.5 mr-0.5" />Premium</Badge></Label>
                <Input
                  id="note"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  maxLength={500}
                  placeholder="Private note about this connection…"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button className="brand-gradient border-0 text-white" onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
