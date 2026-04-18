'use client'

import { useEffect, useState, useCallback } from 'react'
import { Compass, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AppShell } from '@/components/layout/app-shell'
import { CandidateCard } from '@/components/discover/candidate-card'
import { MatchModal } from '@/components/discover/match-modal'
import { getFetchClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/auth-store'
import type { DiscoveryCandidate } from '@/lib/supabase/types'

export default function DiscoverPage() {
  // All data operations go through the fetch client — it receives the token
  // via callback rather than calling getSession(), so it's never blocked by a
  // concurrent auth-lock token refresh (which would hang indefinitely and cause
  // infinite loading).
  const db = getFetchClient()
  const { user, profile, loading: authLoading } = useAuthStore()

  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [matchModal, setMatchModal] = useState<{
    open: boolean
    candidate: DiscoveryCandidate | null
    matchId: string | null
  }>({ open: false, candidate: null, matchId: null })

  const fetchCandidates = useCallback(async () => {
    if (!user) return
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any).rpc('get_discovery_candidates', {
      p_user_id: user.id,
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
    if (authLoading) return   // wait for auth before attempting to fetch
    fetchCandidates()
  }, [authLoading, fetchCandidates])

  const currentCandidate = candidates[currentIndex] ?? null
  const hasMore = currentIndex < candidates.length

  const handleSkip = async () => {
    if (!user || !currentCandidate) return
    setActionLoading(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from('discovery_actions').upsert({
      from_user: user.id,
      to_user: currentCandidate.id,
      action: 'skip',
    }, { onConflict: 'from_user,to_user' })

    setActionLoading(false)
    setTimeout(() => setCurrentIndex((i) => i + 1), 300)
  }

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: matchId, error: matchError } = await (db as any).rpc('try_create_match', {
      p_actor_id: user.id,
      p_target_id: currentCandidate.id,
    })

    setActionLoading(false)

    if (!matchError && matchId) {
      setMatchModal({ open: true, candidate: currentCandidate, matchId })
    }

    setTimeout(() => setCurrentIndex((i) => i + 1), 300)
  }

  const showSkeleton = authLoading || loading

  return (
    <AppShell>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md px-4 h-14 flex items-center gap-3">
          <Compass className="w-5 h-5 text-primary" />
          <h1 className="font-semibold">Discover</h1>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchCandidates}
              disabled={showSkeleton}
              title="Refresh"
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
                <Skeleton className="h-12 flex-1 rounded-2xl" />
                <Skeleton className="h-12 flex-1 rounded-2xl" />
              </div>
            </div>
          ) : !hasMore || candidates.length === 0 ? (
            <div className="text-center max-w-xs">
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                <Compass className="w-9 h-9 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No more candidates</h2>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                You&apos;ve seen everyone compatible for now. Check back later or refresh to see new people.
              </p>
              <Button className="brand-gradient border-0 text-white" onClick={fetchCandidates}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          ) : (
            <div className="w-full max-w-sm">
              {candidates.length - currentIndex > 1 && (
                <div className="relative mb-0">
                  <div className="absolute -bottom-2 left-4 right-4 h-full bg-card border border-border rounded-3xl opacity-30" />
                  <div className="absolute -bottom-1 left-2 right-2 h-full bg-card border border-border rounded-3xl opacity-50" />
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

              <p className="text-center text-xs text-muted-foreground mt-4">
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
    </AppShell>
  )
}
