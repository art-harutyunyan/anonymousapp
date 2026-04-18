'use client'

import { useRouter } from 'next/navigation'
import { Heart, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { DiscoveryCandidate } from '@/lib/supabase/types'

interface MatchModalProps {
  open: boolean
  onClose: () => void
  onKeepSwiping?: () => void
  candidate: DiscoveryCandidate | null
  matchId: string | null
}

export function MatchModal({ open, onClose, onKeepSwiping, candidate, matchId }: MatchModalProps) {
  const router = useRouter()

  if (!candidate) return null

  const initials = candidate.nickname
    ? candidate.nickname.slice(0, 2).toUpperCase()
    : '??'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm text-center border-primary/30 bg-card">
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 brand-gradient opacity-5" />
        </div>

        <div className="relative flex flex-col items-center gap-5 pt-2">
          {/* Animated hearts */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full brand-gradient flex items-center justify-center shadow-lg shadow-primary/30">
              <Heart className="w-9 h-9 text-white fill-white" />
            </div>
            <span className="absolute -top-1 -right-1 text-2xl animate-bounce">✨</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-1">It&apos;s a Match!</h2>
            <p className="text-muted-foreground text-sm">
              You and <strong className="text-foreground">{candidate.nickname ?? 'Anonymous'}</strong> both want to talk
            </p>
          </div>

          <Avatar className="w-16 h-16 border-2 border-primary/40">
            <AvatarImage src={candidate.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-xl">{initials}</AvatarFallback>
          </Avatar>

          <div className="flex flex-wrap gap-1.5 justify-center">
            {candidate.interests.slice(0, 4).map((i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                {i}
              </span>
            ))}
          </div>

          <div className="flex gap-3 w-full pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { onClose(); onKeepSwiping?.() }}>
              Keep Swiping
            </Button>
            <Button
              className="flex-1 brand-gradient border-0 text-white"
              onClick={() => {
                onClose()
                if (matchId) router.push(`/chat/${matchId}`)
              }}
            >
              <MessageCircle className="w-4 h-4 mr-1.5" />
              Chat Now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
