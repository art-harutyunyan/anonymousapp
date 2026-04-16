import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { MessageCircle, Shield, Zap, Heart, Globe, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

const features = [
  {
    icon: Lock,
    title: 'Truly Anonymous',
    description: 'No real names, no photos required. Connect through personality and shared interests.',
  },
  {
    icon: Heart,
    title: 'Mutual Matches Only',
    description: 'A chat opens only when both of you say "Start Talking". No unwanted messages.',
  },
  {
    icon: Zap,
    title: 'Smart Matching',
    description: 'We match by gender preference, chat intent, and rank by shared interests.',
  },
  {
    icon: MessageCircle,
    title: 'Realtime Chat',
    description: 'Instant messaging once matched. Clean, distraction-free conversation.',
  },
  {
    icon: Shield,
    title: 'Safe by Design',
    description: 'Block, report, and moderated by admins. 18+ verified platform.',
  },
  {
    icon: Globe,
    title: 'Global Community',
    description: 'Meet people from around the world who share your interests and vibe.',
  },
]

const intents = [
  { label: 'Friendship', emoji: '🤝' },
  { label: 'Dating',     emoji: '💕' },
  { label: 'Casual Chat',emoji: '☕' },
  { label: 'Just Talk',  emoji: '💬' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-lg brand-gradient-text">Anonymous Match</span>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs border-primary/30 text-primary hidden sm:flex">
              18+ Only
            </Badge>
            <Link
              href="/auth"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              Sign In
            </Link>
            <Link
              href="/auth"
              className={cn(buttonVariants({ size: 'sm' }), 'brand-gradient border-0 text-white')}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        </div>

        <Badge variant="outline" className="mb-6 border-primary/40 text-primary/90 bg-primary/5">
          Anonymous · Safe · 18+ Only
        </Badge>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 max-w-3xl leading-tight">
          Connect without revealing{' '}
          <span className="brand-gradient-text">who you are</span>
        </h1>

        <p className="text-muted-foreground text-lg sm:text-xl max-w-xl mb-10 leading-relaxed">
          Match with real people based on shared interests and chat intent.
          No photos required. No full names. Just genuine conversation.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-16">
          <Link
            href="/auth"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'brand-gradient border-0 text-white text-base px-8 shadow-lg shadow-primary/25'
            )}
          >
            Start Matching — It&apos;s Free
          </Link>
          <Link
            href="#how-it-works"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'text-base px-8')}
          >
            How it works
          </Link>
        </div>

        {/* Intent pills */}
        <div className="flex flex-wrap gap-2 justify-center">
          {intents.map(({ label, emoji }) => (
            <span
              key={label}
              className="px-4 py-2 bg-secondary rounded-full text-sm text-muted-foreground border border-border"
            >
              {emoji} {label}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 border-t border-border/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            How Anonymous Match works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {[
              {
                step: '01',
                title: 'Build your anonymous profile',
                desc: 'Set your gender, age, intent, and interests. Add a nickname if you want — nothing identifiable required.',
              },
              {
                step: '02',
                title: 'Swipe through candidates',
                desc: 'See one card at a time. Press "Start Talking" or skip. We only show compatible matches.',
              },
              {
                step: '03',
                title: 'Chat when it\'s mutual',
                desc: 'Both press Start Talking? A match is created and your chat room opens instantly.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-sm">
                  {step}
                </div>
                <h3 className="font-semibold text-base">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 px-4 border-t border-border/50 bg-card/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">Built for safety & connection</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="p-5 rounded-2xl border border-border bg-card hover:border-primary/30 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 border-t border-border/50 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to find your match?</h2>
          <p className="text-muted-foreground mb-8">
            Join thousands of people having real conversations. Anonymous. Safe. Free.
          </p>
          <Link
            href="/auth"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'brand-gradient border-0 text-white text-base px-10 shadow-lg shadow-primary/25'
            )}
          >
            Create Your Profile
          </Link>
          <p className="text-xs text-muted-foreground mt-4">18+ only · No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 px-4 text-center text-xs text-muted-foreground">
        <p>© 2026 Anonymous Match · For adults 18 and over · <Link href="#" className="hover:text-foreground underline">Privacy</Link> · <Link href="#" className="hover:text-foreground underline">Terms</Link></p>
      </footer>
    </div>
  )
}
