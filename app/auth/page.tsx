'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { useSupabase } from '@/components/providers/supabase-provider'
import { cn } from '@/lib/utils'

// ─── Validation schemas ───────────────────────────────────────────────────────

const signUpSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  age18: z.literal(true, { error: 'You must confirm you are 18 or older' }),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

const signInSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})

type SignUpData = z.infer<typeof signUpSchema>
type SignInData = z.infer<typeof signInSchema>

const inputCls =
  'w-full rounded-[14px] border-[1.5px] border-black/[0.08] bg-white/90 px-4 py-3.5 text-[15px] text-foreground ' +
  'outline-none transition-all placeholder:text-foreground/30 ' +
  'focus:border-primary/50 focus:bg-black/[0.04] focus:ring-[4px] focus:ring-primary/[0.06] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const router = useRouter()
  const supabase = useSupabase()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [isBanned, setIsBanned] = useState(false)

  useEffect(() => {
    setIsBanned(new URLSearchParams(window.location.search).get('banned') === 'true')
  }, [])

  const signUpForm = useForm<SignUpData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      age18: undefined as unknown as true,
    },
  })

  const signInForm = useForm<SignInData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const handleSignUp = async (data: SignUpData) => {
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Account created! Set up your profile to start matching.')
    router.refresh()
    router.push('/onboarding')
  }

  const handleSignIn = async (data: SignInData) => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    router.refresh()
    router.push('/discover')
  }

  const submitSignIn = () => { if (!loading) signInForm.handleSubmit(handleSignIn)() }
  const submitSignUp = () => { if (!loading) signUpForm.handleSubmit(handleSignUp)() }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.1)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-64 h-64 rounded-full bg-[radial-gradient(circle,rgba(219,39,119,0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-display brand-gradient-text mb-2">Anonymous Match</h1>
          <p className="text-sm text-foreground/50">Connect without revealing who you are</p>
        </div>

        {isBanned && (
          <div className="mb-6 p-4 rounded-2xl border border-destructive/30 bg-destructive/8 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">
              Your account has been suspended for violating our community guidelines.
            </p>
          </div>
        )}

        <div className="bg-white/90 backdrop-blur-xl border-[1.5px] border-black/[0.08] rounded-[20px] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.06)]">
          {/* Tab switcher */}
          <div className="flex bg-black/[0.04] rounded-xl p-[3px] mb-6">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={cn(
                'flex-1 py-2.5 text-sm font-semibold rounded-[9px] transition-all',
                mode === 'signin'
                  ? 'brand-gradient text-white shadow-sm'
                  : 'text-foreground/50'
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={cn(
                'flex-1 py-2.5 text-sm font-semibold rounded-[9px] transition-all',
                mode === 'signup'
                  ? 'brand-gradient text-white shadow-sm'
                  : 'text-foreground/50'
              )}
            >
              Sign Up
            </button>
          </div>

          {/* ── Sign In ── */}
          {mode === 'signin' && (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                submitSignIn()
              }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="si-email" className="text-sm font-semibold text-foreground/70 leading-none">
                  Email
                </label>
                <input
                  id="si-email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={inputCls}
                  {...signInForm.register('email')}
                />
                {signInForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{signInForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="si-password" className="text-sm font-semibold text-foreground/70 leading-none">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="si-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className={cn(inputCls, 'pr-10')}
                    {...signInForm.register('password')}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/35"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {signInForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{signInForm.formState.errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full brand-gradient rounded-full py-3.5 text-white text-base font-semibold mt-1 disabled:opacity-40 shadow-[0_6px_28px_rgba(124,58,237,0.3)] hover:shadow-[0_4px_20px_rgba(124,58,237,0.22)] transition-all active:scale-[0.97]"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          )}

          {/* ── Sign Up ── */}
          {mode === 'signup' && (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                submitSignUp()
              }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="su-email" className="text-sm font-semibold text-foreground/70 leading-none">
                  Email
                </label>
                <input
                  id="su-email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={inputCls}
                  {...signUpForm.register('email')}
                />
                {signUpForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{signUpForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="su-password" className="text-sm font-semibold text-foreground/70 leading-none">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="su-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className={cn(inputCls, 'pr-10')}
                    {...signUpForm.register('password')}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/35"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {signUpForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{signUpForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="su-confirm" className="text-sm font-semibold text-foreground/70 leading-none">
                  Confirm Password
                </label>
                <input
                  id="su-confirm"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={inputCls}
                  {...signUpForm.register('confirmPassword')}
                />
                {signUpForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-destructive">{signUpForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-primary"
                  {...signUpForm.register('age18')}
                />
                <span className="text-sm text-foreground/50 leading-snug">
                  I confirm I am <strong className="text-foreground">18 years or older</strong> and agree
                  to the Terms of Service
                </span>
              </label>
              {signUpForm.formState.errors.age18 && (
                <p className="text-xs text-destructive -mt-2">{signUpForm.formState.errors.age18.message}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full brand-gradient rounded-full py-3.5 text-white text-base font-semibold mt-1 disabled:opacity-40 shadow-[0_6px_28px_rgba(124,58,237,0.3)] hover:shadow-[0_4px_20px_rgba(124,58,237,0.22)] transition-all active:scale-[0.97]"
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-foreground/30 mt-6">
          18+ only · Anonymous profiles · Safe environment
        </p>
      </div>
    </div>
  )
}
