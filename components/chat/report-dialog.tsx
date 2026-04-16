'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useSupabase } from '@/components/providers/supabase-provider'
import { useAuthStore } from '@/lib/stores/auth-store'
import { cn } from '@/lib/utils'

const REASONS = [
  { value: 'spam', label: 'Spam or scam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'underage', label: 'Appears to be underage' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'other', label: 'Other' },
] as const

interface ReportDialogProps {
  open: boolean
  onClose: () => void
  reportedUserId: string
  reportedNickname: string
}

export function ReportDialog({ open, onClose, reportedUserId, reportedNickname }: ReportDialogProps) {
  const supabase = useSupabase()
  const { user } = useAuthStore()
  const [reason, setReason] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!user || !reason) return
    setSubmitting(true)

    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_id: reportedUserId,
      reason,
      details: details.trim() || null,
    })

    setSubmitting(false)

    if (error) {
      toast.error('Could not submit report. Please try again.')
      return
    }

    toast.success('Report submitted. Our team will review it shortly.')
    setReason(null)
    setDetails('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Report {reportedNickname}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          <p className="text-sm text-muted-foreground">Why are you reporting this user?</p>

          <div className="flex flex-col gap-2">
            {REASONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={cn(
                  'text-left px-4 py-2.5 rounded-xl border text-sm transition-all',
                  reason === value
                    ? 'border-destructive bg-destructive/10 text-destructive'
                    : 'border-border hover:border-muted-foreground text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setReason(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <Textarea
            placeholder="Additional details (optional)…"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            maxLength={500}
          />

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleSubmit}
              disabled={!reason || submitting}
            >
              {submitting ? 'Submitting…' : 'Submit Report'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
