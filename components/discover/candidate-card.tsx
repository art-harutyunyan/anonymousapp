'use client'

import { useState } from 'react'
import { Globe, MapPin, X, Heart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { INTENT_LABELS, GENDER_LABELS, ageRangeLabel } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'
import type { DiscoveryCandidate } from '@/lib/supabase/types'

interface CandidateCardProps {
  candidate: DiscoveryCandidate
  myInterests: string[]
  onStartTalking: () => Promise<void>
  onSkip: () => void
  loading: boolean
}

export function CandidateCard({
  candidate,
  myInterests,
  onStartTalking,
  onSkip,
  loading,
}: CandidateCardProps) {
  const [action, setAction] = useState<'start' | 'skip' | null>(null)

  const initials = candidate.nickname
    ? candidate.nickname.slice(0, 2).toUpperCase()
    : '??'

  const sharedInterests = candidate.interests.filter((i) => myInterests.includes(i))
  const otherInterests = candidate.interests.filter((i) => !myInterests.includes(i))

  const handleStart = async () => {
    setAction('start')
    await onStartTalking()
  }

  const handleSkip = () => {
    setAction('skip')
    onSkip()
  }

  return (
    <div
      className={cn(
        'w-full max-w-sm mx-auto bg-white/90 backdrop-blur-xl border-[1.5px] border-black/[0.08] rounded-[24px] overflow-hidden shadow-[0_12px_48px_rgba(0,0,0,0.08)] transition-all duration-300',
        action === 'start' && 'scale-95 opacity-0 translate-y-4',
        action === 'skip' && 'scale-95 opacity-0 -translate-y-2'
      )}
    >
      {/* Avatar area */}
      <div className="relative p-8 pb-4 flex flex-col items-center">
        <div className="absolute top-0 left-0 right-0 h-32 bg-[linear-gradient(135deg,rgba(124,58,237,0.08)_0%,rgba(219,39,119,0.06)_100%)]" />

        <Avatar className="w-24 h-24 border-[3px] border-primary/25 relative shadow-lg">
          <AvatarImage src={candidate.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="mt-3 text-center">
          <h2 className="text-xl font-bold font-display text-foreground">
            {candidate.nickname ?? 'Anonymous'}
          </h2>
          <p className="text-foreground/45 text-sm mt-0.5">
            {ageRangeLabel(candidate.age)} · {GENDER_LABELS[candidate.gender]}
            {candidate.country && (
              <span className="inline-flex items-center gap-1 ml-2">
                <MapPin className="w-3 h-3" />
                {candidate.country}
              </span>
            )}
          </p>
        </div>

        <Badge className="mt-2 brand-gradient border-0 text-white text-xs px-3 py-1 shadow-[0_2px_14px_rgba(124,58,237,0.25)]">
          {INTENT_LABELS[candidate.intent]}
        </Badge>
      </div>

      {/* Interests */}
      <div className="px-6 pb-6">
        {sharedInterests.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-foreground/45 mb-2 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
              {sharedInterests.length} shared interest{sharedInterests.length !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sharedInterests.map((i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/15 font-medium"
                >
                  {i}
                </span>
              ))}
            </div>
          </div>
        )}

        {otherInterests.length > 0 && (
          <div>
            {sharedInterests.length > 0 && (
              <p className="text-xs text-foreground/45 mb-2 font-medium flex items-center gap-1">
                <Globe className="w-3 h-3" /> Their interests
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {otherInterests.slice(0, 5).map((i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full bg-black/[0.04] text-foreground/55 border-[1.5px] border-black/[0.08]"
                >
                  {i}
                </span>
              ))}
              {otherInterests.length > 5 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-black/[0.04] text-foreground/55 border-[1.5px] border-black/[0.08]">
                  +{otherInterests.length - 5}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Circular action buttons */}
        <div className="flex items-center justify-center gap-6 mt-6">
          <button
            onClick={handleSkip}
            disabled={loading || !!action}
            className="w-[58px] h-[58px] rounded-full bg-black/[0.05] border-[1.5px] border-black/[0.10] flex items-center justify-center transition-all active:scale-[0.92] disabled:opacity-40 hover:bg-black/[0.08]"
          >
            <X className="w-6 h-6 text-foreground/50" strokeWidth={2.5} />
          </button>
          <button
            onClick={handleStart}
            disabled={loading || !!action}
            className="w-[68px] h-[68px] rounded-full brand-gradient flex items-center justify-center shadow-[0_8px_30px_rgba(124,58,237,0.35)] transition-all active:scale-[0.92] active:shadow-[0_4px_20px_rgba(124,58,237,0.25)] disabled:opacity-40"
          >
            <Heart className="w-7 h-7 text-white fill-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
