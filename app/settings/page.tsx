'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Settings, User, Lock, Shield, Trash2, LogOut, Check, Upload, UserX
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AppShell } from '@/components/layout/app-shell'
import { useSupabase } from '@/components/providers/supabase-provider'
import { useAuthStore } from '@/lib/stores/auth-store'
import {
  INTERESTS, INTENT_LABELS, GENDER_LABELS, COUNTRIES
} from '@/lib/supabase/types'
import type { Gender, Intent, Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

const profileSchema = z.object({
  nickname: z.string().max(20).optional(),
  age: z.number().min(18).max(100),
  gender: z.enum(['man', 'woman', 'non_binary', 'other'] as const),
  looking_for: z.enum(['man', 'woman', 'non_binary', 'other'] as const),
  intent: z.enum(['friendship', 'dating', 'casual', 'talk'] as const),
  interests: z.array(z.string()).min(1).max(15),
  country: z.string().optional(),
})

const passwordSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type ProfileData = z.infer<typeof profileSchema>
type PasswordData = z.infer<typeof passwordSchema>

interface BlockedUser {
  blocked_id: string
  created_at: string
  profiles: Profile
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = useSupabase()
  const { user, profile, setProfile } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [section, setSection] = useState<'profile' | 'security' | 'blocked'>('profile')

  const profileForm = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    values: {
      nickname: profile?.nickname ?? '',
      age: profile?.age ?? 18,
      gender: (profile?.gender ?? 'man') as Gender,
      looking_for: (profile?.looking_for ?? 'woman') as Gender,
      intent: (profile?.intent ?? 'talk') as Intent,
      interests: profile?.interests ?? [],
      country: profile?.country ?? '',
    },
  })

  const passwordForm = useForm<PasswordData>({ resolver: zodResolver(passwordSchema) })

  const selectedInterests = profileForm.watch('interests')

  const toggleInterest = (interest: string) => {
    const cur = selectedInterests ?? []
    if (cur.includes(interest)) {
      profileForm.setValue('interests', cur.filter((i) => i !== interest))
    } else if (cur.length < 15) {
      profileForm.setValue('interests', [...cur, interest])
    }
  }

  useEffect(() => {
    if (!user) return
    supabase
      .from('blocks')
      .select('blocked_id, created_at, profiles!blocks_blocked_id_fkey(*)')
      .eq('blocker_id', user.id)
      .then(({ data }) => setBlockedUsers((data as unknown as BlockedUser[]) ?? []))
  }, [user, supabase])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const saveProfile = async (data: ProfileData) => {
    if (!user) return
    setSaving(true)
    let avatar_url = profile?.avatar_url

    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        avatar_url = urlData.publicUrl
      }
    }

    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ ...data, avatar_url, nickname: data.nickname || null, country: data.country || null })
      .eq('id', user.id)
      .select()
      .single()

    setSaving(false)
    if (error) { toast.error('Save failed'); return }
    setProfile(updated)
    toast.success('Profile updated')
  }

  const savePassword = async (data: PasswordData) => {
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: data.password })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Password updated')
    passwordForm.reset()
  }

  const handleUnblock = async (blockedId: string) => {
    await supabase.from('blocks')
      .delete()
      .eq('blocker_id', user!.id)
      .eq('blocked_id', blockedId)
    setBlockedUsers((prev) => prev.filter((b) => b.blocked_id !== blockedId))
    toast.success('User unblocked')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure? This cannot be undone.')) return
    await supabase.auth.signOut()
    router.push('/auth')
    toast.info('Contact support to fully delete your account.')
  }

  const initials = profile?.nickname
    ? profile.nickname.slice(0, 2).toUpperCase() : '?'

  return (
    <AppShell>
      <div className="min-h-screen max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Settings className="w-5 h-5 text-primary" />
          <h1 className="font-bold text-xl">Settings</h1>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-6">
          {[
            { id: 'profile', icon: User, label: 'Profile' },
            { id: 'security', icon: Lock, label: 'Security' },
            { id: 'blocked', icon: Shield, label: `Blocked (${blockedUsers.length})` },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setSection(id as typeof section)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                section === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Profile section */}
        {section === 'profile' && (
          <form onSubmit={profileForm.handleSubmit(saveProfile)} className="flex flex-col gap-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16 border-2 border-border">
                <AvatarImage src={avatarPreview ?? profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-xl">{initials}</AvatarFallback>
              </Avatar>
              <label className="cursor-pointer">
                <span className="flex items-center gap-2 text-sm text-primary border border-primary/30 bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  Change photo
                </span>
                <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange} />
              </label>
            </div>

            <Separator />

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Nickname</Label>
                <Input placeholder="Optional nickname" maxLength={20} {...profileForm.register('nickname')} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Age</Label>
                <Input type="number" min={18} max={100} {...profileForm.register('age', { valueAsNumber: true })} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>I am a…</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(GENDER_LABELS) as [Gender, string][]).map(([value, label]) => (
                    <button key={value} type="button"
                      className={cn('px-3 py-2 rounded-xl border text-sm font-medium transition-all',
                        profileForm.watch('gender') === value
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                      onClick={() => profileForm.setValue('gender', value)}
                    >{label}</button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Looking for…</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(GENDER_LABELS) as [Gender, string][]).map(([value, label]) => (
                    <button key={value} type="button"
                      className={cn('px-3 py-2 rounded-xl border text-sm font-medium transition-all',
                        profileForm.watch('looking_for') === value
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                      onClick={() => profileForm.setValue('looking_for', value)}
                    >{label}</button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Chat intent</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(INTENT_LABELS) as [Intent, string][]).map(([value, label]) => (
                    <button key={value} type="button"
                      className={cn('px-3 py-2 rounded-xl border text-sm font-medium transition-all',
                        profileForm.watch('intent') === value
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                      onClick={() => profileForm.setValue('intent', value)}
                    >{label}</button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Interests <span className="text-muted-foreground font-normal text-xs">({selectedInterests?.length ?? 0}/15)</span></Label>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((interest) => {
                    const sel = selectedInterests?.includes(interest)
                    return (
                      <button key={interest} type="button" onClick={() => toggleInterest(interest)}
                        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all',
                          sel
                            ? 'border-primary bg-primary/15 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/40'
                        )}>
                        {sel && <Check className="w-3 h-3" />}
                        {interest}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Country</Label>
                <Controller
                  name="country"
                  control={profileForm.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <SelectTrigger><SelectValue placeholder="Select country…" /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <Button
              className="brand-gradient border-0 text-white w-full"
              disabled={saving}
              onClick={profileForm.handleSubmit(saveProfile)}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>

            <Separator />

            <div className="flex flex-col gap-3">
              <Button type="button" variant="outline" className="w-full" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={handleDeleteAccount}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Account
              </Button>
            </div>
          </form>
        )}

        {/* Security section */}
        {section === 'security' && (
          <form onSubmit={passwordForm.handleSubmit(savePassword)} className="flex flex-col gap-4">
            <h2 className="font-semibold">Change Password</h2>
            <div className="flex flex-col gap-1.5">
              <Label>New Password</Label>
              <Input type="password" placeholder="••••••••" {...passwordForm.register('password')} />
              {passwordForm.formState.errors.password && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.password.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Confirm New Password</Label>
              <Input type="password" placeholder="••••••••" {...passwordForm.register('confirmPassword')} />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button
              className="brand-gradient border-0 text-white"
              disabled={saving}
              onClick={passwordForm.handleSubmit(savePassword)}
            >
              {saving ? 'Updating…' : 'Update Password'}
            </Button>
          </form>
        )}

        {/* Blocked users section */}
        {section === 'blocked' && (
          <div className="flex flex-col gap-4">
            <h2 className="font-semibold">Blocked Users</h2>
            {blockedUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">You haven&apos;t blocked anyone</p>
              </div>
            ) : (
              blockedUsers.map((b) => (
                <div key={b.blocked_id} className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={b.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-secondary text-xs">
                      {b.profiles?.nickname?.slice(0, 2).toUpperCase() ?? '??'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{b.profiles?.nickname ?? 'Anonymous'}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.profiles?.age} · {b.profiles?.country ?? 'Unknown'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-primary/30 text-primary hover:bg-primary/10 text-xs"
                    onClick={() => handleUnblock(b.blocked_id)}
                  >
                    <UserX className="w-3 h-3 mr-1" />
                    Unblock
                  </Button>
                </div>
              ))
            )}

            <div className="mt-4 p-4 rounded-xl border border-border bg-card/50">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="border-primary/30 text-primary text-xs mt-0.5">Tip</Badge>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Blocked users won&apos;t appear in your discovery and cannot send you messages.
                  You can unblock them at any time from here.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
