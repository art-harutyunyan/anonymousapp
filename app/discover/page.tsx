'use client'

import { useEffect, useState, useCallback } from 'react'
import { Compass, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/layout/app-shell'
import { CandidateCard } from '@/components/discover/candidate-card'
import { MatchModal } from '@/components/discover/match-modal'
import { useSupabase } from '@/components/providers/supabase-provider'
import { useAuthStore } from '@/lib/stores/auth-store'
import type { DiscoveryCandidate } from '@/lib/supabase/types'

export default function DiscoverPage() {
  const supabase = useSupabase()
  const { user, profile } = useAuthStore()

  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [matchModal, setMatchModal] = useState<{
    open: boolean
    candidate: DiscoveryCandidate | null
    matchId: string | null
  }>({ open: false, candidate: null, matchId: null })

  const fetchCandidates = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase.rpc('get_discovery_candidates', {
      p_user_id: user.id,
    })
    setLoading(false)
    if (error) {
      toast.error('Could not load candidates')
      return
    }
    setCandidates(data ?? [])
    setCurrentIndex(0)
  }, [user, supabase])

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  const currentCandidate = candidates[currentIndex] ?? null
  const hasMore = currentIndex < candidates.length

  const handleSkip = async () => {
    if (!user || !currentCandidate) return
    setActionLoading(true)

    await supabase.from('discovery_actions').upsert({
      from_user: user.id,
      to_user: currentCandidate.id,
      action: 'skip',
    }, { onConflict: 'from_user,to_user' })

    setActionLoading(false)
    // Short delay for card animation
    setTimeout(() => setCurrentIndex((i) => i + 1), 300)
  }

  const handleStartTalking = async () => {
    if (!user || !currentCandidate) return
    setActionLoading(true)

    // Record start_talking action
    const { error: actionError } = await supabase
      .from('discovery_actions')
      .upsert({
        from_user: user.id,
        to_user: currentCandidate.id,
        action: 'start_talking',
      }, { onConflict: 'from_user,to_user' })

    if (actionError) {
      toast.error('Something went wrong. Please try again.')
      setActionLoading(false)
      return
    }

    // Try to create a match (mutual check happens inside the function)
    const { data: matchId, error: matchError } = await supabase.rpc('try_create_match', {
      p_actor_id: user.id,
      p_target_id: currentCandidate.id,
    })

    setActionLoading(false)

    if (!matchError && matchId) {
      // Mutual match!
      setMatchModal({ open: true, candidate: currentCandidate, matchId })
    }

    setTimeout(() => setCurrentIndex((i) => i + 1), 300)
  }

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
              disabled={loading}
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          {loading ? (
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <p className="text-sm">Finding matches…</p>
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
              {/* Stack hint */}
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

      {/* Match modal */}
      <MatchModal
        open={matchModal.open}
        onClose={() => setMatchModal({ open: false, candidate: null, matchId: null })}
        candidate={matchModal.candidate}
        matchId={matchModal.matchId}
      />
    </AppShell>
  )
}
