'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import {
  ShieldCheck, Users, MessageCircle, AlertTriangle,
  CheckCircle, XCircle, Ban, Search, Activity, ChevronDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { AppShell } from '@/components/layout/app-shell'
import { useSupabase } from '@/components/providers/supabase-provider'
import { useAuthStore } from '@/lib/stores/auth-store'
import type { Report, Profile, ActivityLog, LogEventType } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

interface ReportWithProfiles extends Report {
  reporter: Profile
  reported: Profile
}

interface Stats {
  totalUsers: number
  activeMatches: number
  pendingReports: number
  bannedUsers: number
}

interface LogWithProfile extends ActivityLog {
  profile: Pick<Profile, 'nickname' | 'avatar_url'> | null
}

const LOG_COLORS: Record<LogEventType, string> = {
  user_signed_up:    'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  profile_completed: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  discovery_action:  'text-primary bg-primary/10 border-primary/20',
  match_created:     'text-pink-400 bg-pink-400/10 border-pink-400/20',
  user_blocked:      'text-orange-400 bg-orange-400/10 border-orange-400/20',
  user_reported:     'text-amber-400 bg-amber-400/10 border-amber-400/20',
  user_banned:       'text-destructive bg-destructive/10 border-destructive/20',
  admin_action:      'text-muted-foreground bg-secondary border-border',
}

const LOG_LABELS: Record<LogEventType, string> = {
  user_signed_up:    'Signed up',
  profile_completed: 'Profile set up',
  discovery_action:  'Discovery',
  match_created:     'Matched',
  user_blocked:      'Blocked',
  user_reported:     'Reported',
  user_banned:       'Banned',
  admin_action:      'Admin',
}

export default function AdminPage() {
  const supabase = useSupabase()
  const { user } = useAuthStore()
  const [reports, setReports] = useState<ReportWithProfiles[]>([])
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeMatches: 0, pendingReports: 0, bannedUsers: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [noteText, setNoteText] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<LogWithProfile[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsFilter, setLogsFilter] = useState<LogEventType | 'all'>('all')
  const [logsPage, setLogsPage] = useState(0)
  const [logsHasMore, setLogsHasMore] = useState(true)
  const LOG_PAGE_SIZE = 50

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      const [
        { data: reportData },
        { count: totalUsers },
        { count: activeMatches },
        { count: pendingReports },
        { count: bannedUsers },
      ] = await Promise.all([
        supabase
          .from('reports')
          .select('*, reporter:profiles!reports_reporter_id_fkey(*), reported:profiles!reports_reported_id_fkey(*)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true),
      ])

      setReports((reportData as unknown as ReportWithProfiles[]) ?? [])
      setStats({
        totalUsers: totalUsers ?? 0,
        activeMatches: activeMatches ?? 0,
        pendingReports: pendingReports ?? 0,
        bannedUsers: bannedUsers ?? 0,
      })
      setLoading(false)
    }
    fetchData()
  }, [user, supabase])

  const handleDismiss = async (reportId: string) => {
    await Promise.all([
      supabase.from('reports').update({ status: 'reviewed' }).eq('id', reportId),
      supabase.rpc('log_event', { p_user_id: user!.id, p_event: 'admin_action', p_metadata: { action: 'dismiss_report', report_id: reportId } }),
    ])
    setReports((prev) => prev.filter((r) => r.id !== reportId))
    setStats((s) => ({ ...s, pendingReports: s.pendingReports - 1 }))
    toast.success('Report dismissed')
  }

  const handleBanUser = async (reportId: string, userId: string, note: string) => {
    await Promise.all([
      supabase.from('profiles').update({ is_banned: true }).eq('id', userId),
      supabase.from('reports').update({ status: 'actioned' }).eq('id', reportId),
      note.trim() && supabase.from('admin_notes').insert({
        report_id: reportId,
        admin_id: user!.id,
        note: note.trim(),
      }),
      supabase.rpc('log_event', { p_user_id: user!.id, p_event: 'admin_action', p_metadata: { action: 'ban_user', target_user: userId, report_id: reportId } }),
    ])
    setReports((prev) => prev.filter((r) => r.id !== reportId))
    setStats((s) => ({
      ...s,
      pendingReports: s.pendingReports - 1,
      bannedUsers: s.bannedUsers + 1,
    }))
    toast.success('User banned and report actioned')
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('nickname', `%${searchQuery}%`)
      .limit(10)
    setSearchResults(data ?? [])
  }

  const handleToggleBan = async (userId: string, currentBanned: boolean) => {
    await supabase.from('profiles').update({ is_banned: !currentBanned }).eq('id', userId)
    setSearchResults((prev) =>
      prev.map((p) => p.id === userId ? { ...p, is_banned: !currentBanned } : p)
    )
    toast.success(currentBanned ? 'User unbanned' : 'User banned')
  }

  const fetchLogs = async (filter: LogEventType | 'all', page: number, replace: boolean) => {
    setLogsLoading(true)
    let query = supabase
      .from('activity_logs')
      .select('*, profile:profiles(nickname, avatar_url)')
      .order('created_at', { ascending: false })
      .range(page * LOG_PAGE_SIZE, (page + 1) * LOG_PAGE_SIZE - 1)

    if (filter !== 'all') query = query.eq('event_type', filter)

    const { data } = await query
    const rows = (data as unknown as LogWithProfile[]) ?? []
    setLogs((prev) => replace ? rows : [...prev, ...rows])
    setLogsHasMore(rows.length === LOG_PAGE_SIZE)
    setLogsLoading(false)
  }

  const handleLogsTabOpen = () => {
    if (logs.length === 0) fetchLogs('all', 0, true)
  }

  const handleLogsFilterChange = (filter: LogEventType | 'all') => {
    setLogsFilter(filter)
    setLogsPage(0)
    fetchLogs(filter, 0, true)
  }

  const handleLogsLoadMore = () => {
    const next = logsPage + 1
    setLogsPage(next)
    fetchLogs(logsFilter, next, false)
  }

  const STAT_CARDS = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-primary' },
    { label: 'Active Matches', value: stats.activeMatches, icon: MessageCircle, color: 'text-emerald-500' },
    { label: 'Pending Reports', value: stats.pendingReports, icon: AlertTriangle, color: 'text-amber-500' },
    { label: 'Banned Users', value: stats.bannedUsers, icon: Ban, color: 'text-destructive' },
  ]

  return (
    <AppShell>
      <div className="min-h-screen max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck className="w-5 h-5 text-destructive" />
          <h1 className="font-bold text-xl">Admin Dashboard</h1>
          <Badge variant="outline" className="border-destructive/30 text-destructive text-xs ml-2">Admin</Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {STAT_CARDS.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn('w-4 h-4', color)} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-2xl font-bold">{loading ? '…' : value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="reports">
          <TabsList className="mb-6">
            <TabsTrigger value="reports">
              Reports
              {stats.pendingReports > 0 && (
                <Badge className="ml-2 brand-gradient border-0 text-white text-xs px-1.5 py-0">
                  {stats.pendingReports}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users">User Search</TabsTrigger>
            <TabsTrigger value="logs" onClick={handleLogsTabOpen}>
              <Activity className="w-3.5 h-3.5 mr-1.5" />
              Activity Logs
            </TabsTrigger>
          </TabsList>

          {/* Reports tab */}
          <TabsContent value="reports">
            {loading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 rounded-2xl bg-card animate-pulse" />
                ))}
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-60" />
                <h2 className="text-lg font-semibold mb-1">All clear!</h2>
                <p className="text-muted-foreground text-sm">No pending reports to review.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {reports.map((report) => (
                  <div key={report.id} className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        {/* Reported user */}
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={report.reported?.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-destructive/20 text-destructive text-xs">
                            {report.reported?.nickname?.slice(0, 2).toUpperCase() ?? '??'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-sm">
                            {report.reported?.nickname ?? 'Anonymous'}
                            <span className="text-muted-foreground font-normal"> reported by </span>
                            {report.reporter?.nickname ?? 'Anonymous'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-amber-500/30 text-amber-500 text-xs capitalize">
                        {report.reason.replace('_', ' ')}
                      </Badge>
                    </div>

                    {report.details && (
                      <p className="text-sm text-muted-foreground bg-secondary px-3 py-2 rounded-lg mb-4">
                        &ldquo;{report.details}&rdquo;
                      </p>
                    )}

                    {/* Reported user info */}
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-4">
                      <span className="bg-secondary px-2 py-1 rounded">Age: {report.reported?.age}</span>
                      <span className="bg-secondary px-2 py-1 rounded capitalize">Gender: {report.reported?.gender?.replace('_', ' ')}</span>
                      {report.reported?.country && (
                        <span className="bg-secondary px-2 py-1 rounded">{report.reported.country}</span>
                      )}
                    </div>

                    {/* Admin note */}
                    <Textarea
                      placeholder="Admin note (optional)…"
                      className="mb-3 text-sm h-16 resize-none"
                      value={noteText[report.id] ?? ''}
                      onChange={(e) => setNoteText((prev) => ({ ...prev, [report.id]: e.target.value }))}
                    />

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                        onClick={() => handleDismiss(report.id)}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1.5" />
                        Dismiss
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={() => handleBanUser(report.id, report.reported_id, noteText[report.id] ?? '')}
                      >
                        <Ban className="w-3.5 h-3.5 mr-1.5" />
                        Ban User
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Activity logs tab */}
          <TabsContent value="logs">
            {/* Filter row */}
            <div className="flex flex-wrap gap-2 mb-5">
              {(['all', 'user_signed_up', 'profile_completed', 'discovery_action', 'match_created', 'user_blocked', 'user_reported', 'user_banned', 'admin_action'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => handleLogsFilterChange(f)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    logsFilter === f
                      ? f === 'all'
                        ? 'bg-secondary border-border text-foreground'
                        : LOG_COLORS[f as LogEventType]
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-border/60'
                  )}
                >
                  {f === 'all' ? 'All events' : LOG_LABELS[f as LogEventType]}
                </button>
              ))}
            </div>

            {logsLoading && logs.length === 0 ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 rounded-xl bg-card animate-pulse" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16">
                <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-40" />
                <p className="text-muted-foreground text-sm">No events recorded yet.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 px-4 py-3 bg-card border border-border rounded-xl hover:border-border/80 transition-colors"
                    >
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] shrink-0 mt-0.5', LOG_COLORS[log.event_type])}
                      >
                        {LOG_LABELS[log.event_type]}
                      </Badge>

                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">
                          {log.profile?.nickname ?? 'Anonymous'}
                        </span>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {Object.entries(log.metadata)
                              .filter(([k]) => !['match_id', 'to_user', 'with_user', 'blocked_id', 'reported_id'].includes(k))
                              .map(([k, v]) => `${k}: ${String(v)}`)
                              .join(' · ')}
                          </span>
                        )}
                      </div>

                      <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>

                {logsHasMore && (
                  <button
                    className="w-full mt-4 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:border-border/60 hover:text-foreground transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                    onClick={handleLogsLoadMore}
                    disabled={logsLoading}
                  >
                    <ChevronDown className="w-4 h-4" />
                    {logsLoading ? 'Loading…' : 'Load more'}
                  </button>
                )}
              </>
            )}
          </TabsContent>

          {/* User search tab */}
          <TabsContent value="users">
            <div className="flex gap-2 mb-6">
              <Input
                placeholder="Search by nickname…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} className="brand-gradient border-0 text-white">
                <Search className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {searchResults.map((profile) => (
                <div key={profile.id} className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={profile.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-secondary text-xs">
                      {profile.nickname?.slice(0, 2).toUpperCase() ?? '??'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{profile.nickname ?? 'Anonymous'}</p>
                    <p className="text-xs text-muted-foreground">
                      Age {profile.age} · {profile.country ?? 'Unknown'} · Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
                    </p>
                    <div className="flex gap-1 mt-1">
                      {profile.is_banned && <Badge className="text-[10px] bg-destructive/20 text-destructive border-0">Banned</Badge>}
                      {profile.is_admin && <Badge className="text-[10px] bg-primary/20 text-primary border-0">Admin</Badge>}
                      {profile.is_premium && <Badge className="text-[10px] brand-gradient border-0 text-white">Premium</Badge>}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'shrink-0 text-xs',
                      profile.is_banned
                        ? 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
                        : 'border-destructive/30 text-destructive hover:bg-destructive/10'
                    )}
                    onClick={() => handleToggleBan(profile.id, profile.is_banned)}
                  >
                    <Ban className="w-3 h-3 mr-1" />
                    {profile.is_banned ? 'Unban' : 'Ban'}
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
