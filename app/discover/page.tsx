'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Compass, RefreshCw, Undo2, Crown, Eye, Filter, Lock, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AppShell } from '@/components/layout/app-shell'
import { CandidateCard } from '@/components/discover/candidate-card'
import { MatchModal } from '@/components/discover/match-modal'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { getFetchClient } from '@/lib/supabase/client'
import { useSupabase } from '@/components/providers/supabase-provider'
import { useAuthStore } from '@/lib/stores/auth-store'
import { WaitingModal } from '@/components/discover/waiting-modal'
import type { DiscoveryCandidate } from '@/lib/supabase/types'

interface AppliedFilters {
  minAge: number | null
  maxAge: number | null
  country: string | null
}

export default function DiscoverPage() {
  const db = getFetchClient()
  const supabase = useSupabase()
  const { user, profile, loading: authLoading } = useAuthStore()
  const router = useRouter()

  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [matchModal, setMatchModal] = useState<{
    open: boolean
    candidate: DiscoveryCandidate | null
    matchId: string | null
  }>({ open: false, candidate: null, matchId: null })
  const [waitingModal, setWaitingModal] = useState<{
    open: boolean
    candidate: DiscoveryCandidate | null
  }>({ open: false, candidate: null })
  const [pendingInviteCount, setPendingInviteCount] = useState(0)
  const lastSkippedRef = useRef<{ index: number; candidate: DiscoveryCandidate } | null>(null)
  // Track pending match resolution after waiting modal triggers try_create_match
  const pendingMatchCandidateRef = useRef<DiscoveryCandidate | null>(null)

  // Filters — UI state (pending) + committed state (ref)
  const [filterOpen, setFilterOpen] = useState(false)
  const [pendingMinAge, setPendingMinAge] = useState(18)
  const [pendingMaxAge, setPendingMaxAge] = useState(80)
  const [pendingCountry, setPendingCountry] = useState('')
  const appliedFiltersRef = useRef<AppliedFilters>({ minAge: null, maxAge: null, country: null })
  const hasActiveFilters =
    appliedFiltersRef.current.minAge !== null ||
    appliedFiltersRef.current.maxAge !== null ||
    !!appliedFiltersRef.current.country

  const fetchCandidates = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const f = appliedFiltersRef.current
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any).rpc('get_discovery_candidates', {
      p_user_id: user.id,
      p_min_age: f.minAge,
      p_max_age: f.maxAge,
      p_country: f.country,
    })
    setLoading(false)
    if (error) {
      toast.error('Could not load candidates')
      return
    }
    setCandidates(data ?? [])
    setCurrentIndex(0)
  }, [user, db])

  useEffect(() => {
    if (authLoading) return
    fetchCandidates()
  }, [authLoading, fetchCandidates])

  const currentCandidate = candidates[currentIndex] ?? null
  const hasMore = currentIndex < candidates.length

  const handleSkip = async () => {
    if (!user || !currentCandidate) return
    setActionLoading(true)

    lastSkippedRef.current = { index: currentIndex, candidate: currentCandidate }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from('discovery_actions').upsert({
      from_user: user.id,
      to_user: currentCandidate.id,
      action: 'skip',
    }, { onConflict: 'from_user,to_user' })

    setActionLoading(false)
    setTimeout(() => setCurrentIndex((i) => i + 1), 300)
  }

  const handleUndoSkip = () => {
    if (!profile?.is_premium) { router.push('/premium'); return }
    if (!lastSkippedRef.current) return
    setCurrentIndex(lastSkippedRef.current.index)
    lastSkippedRef.current = null
    toast.success('Skip undone — one more chance!')
  }

  // Called when the other side accepts our invite (Realtime on match_invites)
  const resolveWaitingMatch = useCallback(async (candidate: DiscoveryCandidate) => {
    if (!user) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: matchId, error: matchError } = await (db as any).rpc('try_create_match', {
      p_actor_id: user.id,
      p_target_id: candidate.id,
    })
    setWaitingModal({ open: false, candidate: null })
    if (!matchError && matchId) {
      setMatchModal({ open: true, candidate, matchId })
    }
    setTimeout(() => setCurrentIndex((i) => i + 1), 300)
  }, [user, db])

  // Realtime: watch own outgoing invite for acceptance; watch incoming invites for count
  useEffect(() => {
    if (!user) return

    // Load current pending invites count
    supabase
      .from('match_invites')
      .select('id', { count: 'exact', head: true })
      .eq('to_user', user.id)
      .eq('status', 'waiting')
      .then(({ count }) => setPendingInviteCount(count ?? 0))

    // Subscribe to match_invites changes for this user
    const channel = supabase
      .channel('match-invites-' + user.id)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_invites',
          filter: `to_user=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { status: string } | undefined
          // Update pending invite count for incoming invites
          supabase
            .from('match_invites')
            .select('id', { count: 'exact', head: true })
            .eq('to_user', user.id)
            .eq('status', 'waiting')
            .then(({ count }) => setPendingInviteCount(count ?? 0))
          // If someone accepted OUR outgoing invite (from_user perspective isn't here, handled below)
          if (row?.status === 'accepted' && pendingMatchCandidateRef.current) {
            resolveWaitingMatch(pendingMatchCandidateRef.current)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'match_invites',
          filter: `from_user=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { status: string } | undefined
          if (row?.status === 'accepted' && pendingMatchCandidateRef.current) {
            resolveWaitingMatch(pendingMatchCandidateRef.current)
          } else if (row?.status === 'expired') {
            setWaitingModal({ open: false, candidate: null })
            pendingMatchCandidateRef.current = null
            setTimeout(() => setCurrentIndex((i) => i + 1), 300)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const handleStartTalking = async () => {
    if (!user || !currentCandidate) return
    setActionLoading(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: actionError } = await (db as any)
      .from('discovery_actions')
      .upsert({
        from_user: user.id,
        to_user: currentCandidate.id,
        action: 'start_talking',
      }, { onConflict: 'from_user,to_user' })

    if (actionError) {
      if (actionError.message?.includes('daily_limit_reached')) {
        toast.error("You've reached today's limit of 20 matches. Upgrade to Premium for unlimited.")
      } else {
        toast.error('Something went wrong. Please try again.')
      }
      setActionLoading(false)
      return
    }

    // Check for immediate mutual match (other side already pressed start_talking)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inviteStatus } = await (db as any).rpc('upsert_match_invite', {
      p_from_user: user.id,
      p_to_user: currentCandidate.id,
    })

    setActionLoading(false)

    if (inviteStatus === 'accepted') {
      // Mutual! Create the match immediately
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: matchId, error: matchError } = await (db as any).rpc('try_create_match', {
        p_actor_id: user.id,
        p_target_id: currentCandidate.id,
      })
      if (!matchError && matchId) {
        setMatchModal({ open: true, candidate: currentCandidate, matchId })
      }
      setTimeout(() => setCurrentIndex((i) => i + 1), 300)
    } else {
      // Waiting for the other side — show waiting modal
      pendingMatchCandidateRef.current = currentCandidate
      setWaitingModal({ open: true, candidate: currentCandidate })
    }
  }

  const handleWaitingExpired = async () => {
    // Mark invite expired server-side
    if (user && pendingMatchCandidateRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any)
        .from('match_invites')
        .update({ status: 'expired' })
        .eq('from_user', user.id)
        .eq('to_user', pendingMatchCandidateRef.current.id)
    }
    pendingMatchCandidateRef.current = null
    setWaitingModal({ open: false, candidate: null })
    setTimeout(() => setCurrentIndex((i) => i + 1), 300)
  }

  const handleWaitingCancel = async () => {
    await handleWaitingExpired()
    toast('Request cancelled')
  }

  const handleApplyFilters = () => {
    appliedFiltersRef.current = {
      minAge: pendingMinAge > 18 ? pendingMinAge : null,
      maxAge: pendingMaxAge < 80 ? pendingMaxAge : null,
      country: pendingCountry.trim() || null,
    }
    setFilterOpen(false)
    fetchCandidates()
  }

  const handleResetFilters = () => {
    setPendingMinAge(18)
    setPendingMaxAge(80)
    setPendingCountry('')
    appliedFiltersRef.current = { minAge: null, maxAge: null, country: null }
    setFilterOpen(false)
    fetchCandidates()
  }

  const showSkeleton = authLoading || loading

  return (
    <AppShell>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-4 h-14 flex items-center gap-2">
          <Compass className="w-5 h-5 text-primary" />
          <h1 className="font-semibold">Discover</h1>
          <div className="ml-auto flex items-center gap-1">
            {lastSkippedRef.current && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleUndoSkip}
                title={profile?.is_premium ? 'Undo last skip' : 'Undo last skip (Premium)'}
                className={profile?.is_premium ? 'text-primary' : 'text-muted-foreground'}
              >
                <Undo2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/liked-me')}
              title="See who liked you"
              className={cn('relative', profile?.is_premium ? 'text-primary' : 'text-muted-foreground')}
            >
              <Eye className="w-4 h-4" />
              {pendingInviteCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full bg-primary text-[9px] text-white font-bold flex items-center justify-center px-0.5">
                  {pendingInviteCount}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFilterOpen(true)}
              title={profile?.is_premium ? 'Filter candidates' : 'Filter candidates (Premium)'}
              className="relative text-foreground/50 hover:text-foreground"
            >
              <Filter className="w-4 h-4" />
              {hasActiveFilters && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchCandidates}
              disabled={showSkeleton}
              title="Refresh"
              className="text-foreground/50 hover:text-foreground"
            >
              <RefreshCw className={`w-4 h-4 ${showSkeleton ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>


        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          {showSkeleton ? (
            <div className="w-full max-w-sm flex flex-col gap-4">
              <Skeleton className="h-[420px] w-full rounded-3xl" />
              <div className="flex gap-3">
                <Skeleton className="h-12 flex-1 rounded-full" />
                <Skeleton className="h-12 flex-1 rounded-full" />
              </div>
            </div>
          ) : !hasMore || candidates.length === 0 ? (
            <div className="text-center max-w-xs">
              <div className="w-20 h-20 rounded-full bg-black/[0.04] flex items-center justify-center mx-auto mb-6">
                <Compass className="w-9 h-9 text-foreground/35" />
              </div>
              <h2 className="text-xl font-bold font-display mb-2">No more candidates</h2>
              <p className="text-foreground/45 text-sm mb-6 leading-relaxed">
                You&apos;ve seen everyone compatible for now. Check back later or refresh to see new people.
              </p>
              <Button
                className="brand-gradient border-0 text-white rounded-full px-8 shadow-[0_6px_28px_rgba(124,58,237,0.3)]"
                onClick={fetchCandidates}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          ) : (
            <div className="w-full max-w-sm">
              {candidates.length - currentIndex > 1 && (
                <div className="relative mb-0">
                  <div className="absolute -bottom-2 left-4 right-4 h-full bg-white/60 border border-black/[0.06] rounded-3xl opacity-30" />
                  <div className="absolute -bottom-1 left-2 right-2 h-full bg-white/70 border border-black/[0.06] rounded-3xl opacity-50" />
                </div>
              )}

              <div className="relative z-10">
                {currentCandidate && (
                  <CandidateCard
                    key={currentCandidate.id}
                    candidate={currentCandidate}
                    myInterests={profile?.interests ?? []}
                    onStartTalking={handleStartTalking}
                    onSkip={handleSkip}
                    loading={actionLoading}
                  />
                )}
              </div>

              <p className="text-center text-xs text-foreground/35 mt-4">
                {candidates.length - currentIndex - 1} more candidate{candidates.length - currentIndex - 1 !== 1 ? 's' : ''} in queue
              </p>
            </div>
          )}
        </div>
      </div>

      <MatchModal
        open={matchModal.open}
        onClose={() => setMatchModal({ open: false, candidate: null, matchId: null })}
        onKeepSwiping={fetchCandidates}
        candidate={matchModal.candidate}
        matchId={matchModal.matchId}
      />

      <WaitingModal
        open={waitingModal.open}
        candidate={waitingModal.candidate}
        onAccepted={() => {
          if (pendingMatchCandidateRef.current) resolveWaitingMatch(pendingMatchCandidateRef.current)
        }}
        onExpired={handleWaitingExpired}
        onCancel={handleWaitingCancel}
      />

      {/* Filter panel */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="right" showCloseButton={false} className="w-[320px] sm:max-w-[320px] p-0">
          <SheetHeader className="px-5 pt-5 pb-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                Filter Candidates
              </SheetTitle>
              <button
                onClick={() => setFilterOpen(false)}
                className="text-foreground/40 hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </SheetHeader>

          {!profile?.is_premium ? (
            <div className="flex flex-col items-center justify-center flex-1 px-5 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                <Lock className="w-7 h-7 text-amber-500" />
              </div>
              <h3 className="font-semibold mb-2">Premium Feature</h3>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Filter by age range and country to find exactly who you&apos;re looking for.
              </p>
              <Button
                className="brand-gradient border-0 text-white w-full"
                onClick={() => { setFilterOpen(false); router.push('/premium') }}
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Premium
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-6 px-5 py-5 flex-1 overflow-y-auto">
              {/* Age range */}
              <div>
                <label className="text-sm font-medium text-foreground mb-3 block">
                  Age range: <span className="text-primary font-semibold">{pendingMinAge}–{pendingMaxAge}</span>
                </label>
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex justify-between text-xs text-foreground/45 mb-1">
                      <span>Min age</span>
                      <span>{pendingMinAge}</span>
                    </div>
                    <input
                      type="range"
                      min={18}
                      max={pendingMaxAge}
                      value={pendingMinAge}
                      onChange={(e) => setPendingMinAge(Number(e.target.value))}
                      className="w-full accent-primary h-1.5 rounded-full appearance-none bg-primary/20 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-foreground/45 mb-1">
                      <span>Max age</span>
                      <span>{pendingMaxAge}</span>
                    </div>
                    <input
                      type="range"
                      min={pendingMinAge}
                      max={80}
                      value={pendingMaxAge}
                      onChange={(e) => setPendingMaxAge(Number(e.target.value))}
                      className="w-full accent-primary h-1.5 rounded-full appearance-none bg-primary/20 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Country */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Country
                </label>
                <Input
                  placeholder="e.g. United States"
                  value={pendingCountry}
                  onChange={(e) => setPendingCountry(e.target.value)}
                  className="rounded-xl"
                />
                <p className="text-xs text-foreground/40 mt-1.5">Leave blank to see all countries</p>
              </div>
            </div>
          )}

          {profile?.is_premium && (
            <SheetFooter className="px-5 pb-5 pt-0 flex-col gap-2">
              <Button
                className="brand-gradient border-0 text-white w-full rounded-xl"
                onClick={handleApplyFilters}
              >
                Apply Filters
              </Button>
              <Button
                variant="ghost"
                className="w-full rounded-xl text-foreground/50"
                onClick={handleResetFilters}
              >
                Reset
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  )
}
