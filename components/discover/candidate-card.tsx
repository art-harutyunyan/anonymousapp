'use client'

import { useState } from 'react'
import { MessageCircle, SkipForward, Globe, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
        'w-full max-w-sm mx-auto bg-card border border-border rounded-3xl overflow-hidden shadow-xl transition-all duration-300',
        action === 'start' && 'scale-95 opacity-0 translate-y-4',
        action === 'skip' && 'scale-95 opacity-0 -translate-y-2'
      )}
    >
      {/* Avatar area */}
      <div className="relative p-8 pb-4 flex flex-col items-center">
        {/* Background gradient ring */}
        <div className="absolute top-0 left-0 right-0 h-32 brand-gradient opacity-10" />

        <Avatar className="w-24 h-24 border-4 border-primary/30 relative">
          <AvatarImage src={candidate.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-3xl font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Name + age */}
        <div className="mt-3 text-center">
          <h2 className="text-xl font-bold">
            {candidate.nickname ?? 'Anonymous'}
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {ageRangeLabel(candidate.age)} · {GENDER_LABELS[candidate.gender]}
            {candidate.country && (
              <span className="inline-flex items-center gap-1 ml-2">
                <MapPin className="w-3 h-3" />
                {candidate.country}
              </span>
            )}
          </p>
        </div>

        {/* Intent badge */}
        <Badge className="mt-2 brand-gradient border-0 text-white text-xs px-3 py-1">
          {INTENT_LABELS[candidate.intent]}
        </Badge>
      </div>

      {/* Interests */}
      <div className="px-6 pb-6">
        {sharedInterests.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-2 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
              {sharedInterests.length} shared interest{sharedInterests.length !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sharedInterests.map((i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/20"
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
              <p className="text-xs text-muted-foreground mb-2 font-medium flex items-center gap-1">
                <Globe className="w-3 h-3" /> Their interests
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {otherInterests.slice(0, 5).map((i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border"
                >
                  {i}
                </span>
              ))}
              {otherInterests.length > 5 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border">
                  +{otherInterests.length - 5}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            className="flex-1 h-12 text-sm border-border hover:border-muted-foreground"
            onClick={handleSkip}
            disabled={loading || !!action}
          >
            <SkipForward className="w-4 h-4 mr-1.5" />
            Skip
          </Button>
          <Button
            className="flex-1 h-12 text-sm brand-gradient border-0 text-white shadow-md shadow-primary/25"
            onClick={handleStart}
            disabled={loading || !!action}
          >
            <MessageCircle className="w-4 h-4 mr-1.5" />
            Start Talking
          </Button>
        </div>
      </div>
    </div>
  )
}
