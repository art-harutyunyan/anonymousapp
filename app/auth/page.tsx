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

// ─── Shared input styling — native <input>, no @base-ui dependency ─────────
const inputCls =
  'w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-base ' +
  'outline-none transition-colors placeholder:text-muted-foreground ' +
  'focus:border-ring focus:ring-2 focus:ring-ring/30 ' +
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

  // Called from form onSubmit after e.preventDefault() is already called synchronously.
  // Using form + type="submit" so iOS Safari handles keyboard dismissal + tap in one gesture.
  const submitSignIn = () => { if (!loading) signInForm.handleSubmit(handleSignIn)() }
  const submitSignUp = () => { if (!loading) signUpForm.handleSubmit(handleSignUp)() }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/8 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold brand-gradient-text mb-1">Anonymous Match</h1>
          <p className="text-sm text-muted-foreground">Connect without revealing who you are</p>
        </div>

        {isBanned && (
          <div className="mb-6 p-4 rounded-xl border border-destructive/40 bg-destructive/10 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">
              Your account has been suspended for violating our community guidelines.
            </p>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-6">
          {/* Tab switcher — native <button>, no library dependency */}
          <div className="flex bg-muted rounded-lg p-[3px] mb-6">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                mode === 'signin'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                mode === 'signup'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
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
                <label htmlFor="si-email" className="text-sm font-medium leading-none">
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
                <label htmlFor="si-password" className="text-sm font-medium leading-none">
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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
                className="w-full brand-gradient rounded-lg py-3 text-white text-sm font-medium mt-1 disabled:opacity-50"
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
                <label htmlFor="su-email" className="text-sm font-medium leading-none">
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
                <label htmlFor="su-password" className="text-sm font-medium leading-none">
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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
                <label htmlFor="su-confirm" className="text-sm font-medium leading-none">
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
                <span className="text-sm text-muted-foreground leading-snug">
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
                className="w-full brand-gradient rounded-lg py-3 text-white text-sm font-medium mt-1 disabled:opacity-50"
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          18+ only · Anonymous profiles · Safe environment
        </p>
      </div>
    </div>
  )
}
