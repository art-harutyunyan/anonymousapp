'use client'

import { useEffect, useState, useRef } from 'react'
import { Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { DiscoveryCandidate } from '@/lib/supabase/types'

interface WaitingModalProps {
  open: boolean
  candidate: DiscoveryCandidate | null
  onAccepted: () => void  // other side opted in → trigger match flow
  onExpired: () => void   // 60s timeout or cancel → advance to next
  onCancel: () => void    // user dismisses manually
}

const TIMEOUT_SEC = 60

export function WaitingModal({ open, candidate, onAccepted, onExpired, onCancel }: WaitingModalProps) {
  const [remaining, setRemaining] = useState(TIMEOUT_SEC)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!open) {
      setRemaining(TIMEOUT_SEC)
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    setRemaining(TIMEOUT_SEC)
    timerRef.current = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!)
          onExpired()
          return 0
        }
        return s - 1
      })
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const progress = remaining / TIMEOUT_SEC
  const circumference = 2 * Math.PI * 28
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-xs text-center border-[1.5px] border-primary/20 bg-[#faf6f0]">
        {/* Countdown ring */}
        <div className="flex justify-center mb-4">
          <div className="relative w-20 h-20">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-primary/10" />
              <circle
                cx="32" cy="32" r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="text-primary transition-all duration-1000"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-bold text-lg text-primary">
              {remaining}
            </span>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <h2 className="text-lg font-bold font-display">Waiting…</h2>
          <p className="text-sm text-foreground/55 leading-relaxed">
            {candidate?.nickname ?? 'This person'} has 60 seconds to accept. If they do, you&apos;ll be matched!
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-center gap-1.5 text-xs text-foreground/35">
            <Clock className="w-3 h-3" />
            <span>Request expires in {remaining}s</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-foreground/45 hover:text-foreground mt-1"
            onClick={onCancel}
          >
            <X className="w-3.5 h-3.5 mr-1.5" />
            Cancel request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
