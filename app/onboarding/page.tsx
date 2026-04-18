'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ChevronRight, ChevronLeft, Check, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSupabase } from '@/components/providers/supabase-provider'
import { useAuthStore } from '@/lib/stores/auth-store'
import { INTERESTS, INTENT_LABELS, GENDER_LABELS, COUNTRIES, AGE_RANGES } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'
import type { Gender, Intent } from '@/lib/supabase/types'

const schema = z.object({
  gender: z.enum(['man', 'woman', 'non_binary', 'other'] as const),
  age: z.number().min(18, 'You must be at least 18').max(100),
  looking_for: z.enum(['man', 'woman', 'non_binary', 'other'] as const),
  intent: z.enum(['friendship', 'dating', 'casual', 'talk'] as const),
  interests: z.array(z.string()).min(1, 'Select at least one interest').max(15),
  nickname: z.string().max(20).optional(),
  country: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const TOTAL_STEPS = 4

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = useSupabase()
  const { user, setProfile } = useAuthStore()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const { control, register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      interests: [],
      nickname: '',
      country: '',
    },
  })

  const selectedInterests = watch('interests')

  const toggleInterest = (interest: string) => {
    const current = selectedInterests ?? []
    if (current.includes(interest)) {
      setValue('interests', current.filter((i) => i !== interest))
    } else if (current.length < 15) {
      setValue('interests', [...current, interest])
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Avatar must be under 5MB')
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const onSubmit = async (data: FormData) => {
    if (!user) return
    setSaving(true)

    let avatar_url: string | null = null

    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true })

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        avatar_url = urlData.publicUrl
      }
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        gender: data.gender,
        age: data.age,
        looking_for: data.looking_for,
        intent: data.intent,
        interests: data.interests,
        nickname: data.nickname || null,
        country: data.country || null,
        avatar_url,
        onboarding_complete: true,
      })
      .eq('id', user.id)
      .select()
      .single()

    setSaving(false)

    if (error) {
      toast.error('Failed to save profile. Please try again.')
      return
    }

    setProfile(profile)
    toast.success('Profile created! Time to start matching.')
    window.location.href = '/discover'
  }

  const canProceed = () => {
    const vals = watch()
    if (step === 1) return vals.gender && vals.age >= 18 && AGE_RANGES.some(r => r.min === vals.age)
    if (step === 2) return vals.looking_for && vals.intent
    if (step === 3) return (vals.interests ?? []).length >= 1
    return true
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold brand-gradient-text mb-1">Set Up Your Profile</h1>
          <p className="text-sm text-muted-foreground">Anonymous — only what you choose is visible</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Step {step} of {TOTAL_STEPS}</span>
            <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <Progress value={(step / TOTAL_STEPS) * 100} className="h-1.5" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="bg-card border border-border rounded-2xl p-6">

            {/* Step 1: Gender + Age */}
            {step === 1 && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold mb-1">About you</h2>
                  <p className="text-sm text-muted-foreground">This helps us find compatible matches</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>I am a…</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(GENDER_LABELS) as [Gender, string][]).map(([value, label]) => {
                      const selected = watch('gender') === value
                      return (
                        <button
                          key={value}
                          type="button"
                          className={cn(
                            'px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                            selected
                              ? 'border-primary bg-primary/15 text-primary'
                              : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                          )}
                          onClick={() => setValue('gender', value)}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  {errors.gender && <p className="text-xs text-destructive">{errors.gender.message}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Age range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {AGE_RANGES.map((range) => {
                      const selected = watch('age') === range.min
                      return (
                        <button
                          key={range.min}
                          type="button"
                          className={cn(
                            'px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                            selected
                              ? 'border-primary bg-primary/15 text-primary'
                              : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                          )}
                          onClick={() => setValue('age', range.min)}
                        >
                          {range.label}
                        </button>
                      )
                    })}
                  </div>
                  {errors.age && <p className="text-xs text-destructive">{errors.age.message}</p>}
                </div>
              </div>
            )}

            {/* Step 2: Looking for + Intent */}
            {step === 2 && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold mb-1">What you&apos;re looking for</h2>
                  <p className="text-sm text-muted-foreground">We match on both — no unwanted results</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Interested in…</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(GENDER_LABELS) as [Gender, string][]).map(([value, label]) => {
                      const selected = watch('looking_for') === value
                      return (
                        <button
                          key={value}
                          type="button"
                          className={cn(
                            'px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                            selected
                              ? 'border-primary bg-primary/15 text-primary'
                              : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                          )}
                          onClick={() => setValue('looking_for', value)}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Chat intent</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(INTENT_LABELS) as [Intent, string][]).map(([value, label]) => {
                      const selected = watch('intent') === value
                      return (
                        <button
                          key={value}
                          type="button"
                          className={cn(
                            'px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                            selected
                              ? 'border-primary bg-primary/15 text-primary'
                              : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                          )}
                          onClick={() => setValue('intent', value)}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  {errors.intent && <p className="text-xs text-destructive">{errors.intent.message}</p>}
                </div>
              </div>
            )}

            {/* Step 3: Interests */}
            {step === 3 && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Your interests</h2>
                  <p className="text-sm text-muted-foreground">
                    Select 1–15 interests · <span className="text-primary">{selectedInterests?.length ?? 0} selected</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((interest) => {
                    const selected = selectedInterests?.includes(interest)
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all',
                          selected
                            ? 'border-primary bg-primary/15 text-primary'
                            : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {selected && <Check className="w-3 h-3" />}
                        {interest}
                      </button>
                    )
                  })}
                </div>
                {errors.interests && <p className="text-xs text-destructive">{errors.interests.message}</p>}
              </div>
            )}

            {/* Step 4: Optional info */}
            {step === 4 && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Optional details</h2>
                  <p className="text-sm text-muted-foreground">Everything here is optional</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nickname">Nickname <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="nickname"
                    placeholder="e.g. SkyWalker, Moonlight…"
                    maxLength={20}
                    {...register('nickname')}
                  />
                  <p className="text-xs text-muted-foreground">Shown instead of "Anonymous" if you set one</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Country <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Controller
                    name="country"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select country…" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Profile photo <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <label className={cn(
                    'flex flex-col items-center justify-center gap-2 h-28 rounded-xl border-2 border-dashed border-border cursor-pointer hover:border-primary/40 transition-colors',
                    avatarPreview && 'border-primary/40'
                  )}>
                    {avatarPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Click to upload · Max 5MB</span>
                      </>
                    )}
                    <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange} />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3 mt-6">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep(step - 1)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            )}

            {step < TOTAL_STEPS ? (
              <Button
                type="button"
                className="flex-1 brand-gradient border-0 text-white"
                disabled={!canProceed()}
                onClick={() => setStep(step + 1)}
              >
                Continue <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                className="flex-1 brand-gradient border-0 text-white"
                disabled={saving}
                onClick={handleSubmit(onSubmit)}
              >
                {saving ? 'Saving…' : 'Start Matching ✦'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
