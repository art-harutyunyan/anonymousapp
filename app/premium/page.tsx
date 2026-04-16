import { Crown, Check, Zap, Eye, Filter, Heart, Star, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppShell } from '@/components/layout/app-shell'

const FREE_FEATURES = [
  'Anonymous profile',
  'Discover compatible matches',
  'Basic interest matching',
  'Realtime chat with matches',
  'Block & report users',
]

const PREMIUM_FEATURES = [
  { icon: Zap,           text: 'Unlimited daily matches (free: 20/day)' },
  { icon: Eye,           text: 'See who pressed "Start Talking" on you' },
  { icon: Filter,        text: 'Advanced filters: age range, country' },
  { icon: Heart,         text: 'Priority ranking in discovery' },
  { icon: MessageCircle, text: 'Read receipts in chat' },
  { icon: Star,          text: 'Premium badge on your profile' },
]

const PLANS = [
  {
    id: 'monthly',
    label: 'Monthly',
    price: '$9.99',
    period: '/month',
    badge: null,
    savings: null,
  },
  {
    id: 'annual',
    label: 'Annual',
    price: '$4.99',
    period: '/month',
    badge: 'Best Value',
    savings: 'Save 50% · Billed $59.88/year',
  },
]

export default function PremiumPage() {
  return (
    <AppShell>
      <div className="min-h-screen max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl brand-gradient mb-4 shadow-lg shadow-primary/30">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            Anonymous Match <span className="brand-gradient-text">Premium</span>
          </h1>
          <p className="text-muted-foreground">
            Unlock the full experience. More matches, better filters, exclusive features.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative p-6 rounded-2xl border ${
                plan.badge
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                  : 'border-border bg-card'
              }`}
            >
              {plan.badge && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 brand-gradient border-0 text-white text-xs px-3">
                  {plan.badge}
                </Badge>
              )}
              <p className="font-semibold text-sm text-muted-foreground mb-2">{plan.label}</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground text-sm mb-1">{plan.period}</span>
              </div>
              {plan.savings && (
                <p className="text-xs text-primary mb-4">{plan.savings}</p>
              )}
              {!plan.savings && <div className="mb-4" />}
              <Button
                className={`w-full ${plan.badge ? 'brand-gradient border-0 text-white' : ''}`}
                variant={plan.badge ? 'default' : 'outline'}
                disabled
              >
                Coming Soon
              </Button>
            </div>
          ))}
        </div>

        {/* Feature comparison */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-3 text-sm font-medium border-b border-border">
            <div className="px-4 py-3 text-muted-foreground">Feature</div>
            <div className="px-4 py-3 text-center text-muted-foreground border-x border-border">Free</div>
            <div className="px-4 py-3 text-center">
              <span className="brand-gradient-text font-semibold">Premium</span>
            </div>
          </div>

          {FREE_FEATURES.map((feat) => (
            <div key={feat} className="grid grid-cols-3 text-sm border-b border-border/50 last:border-0">
              <div className="px-4 py-3 text-muted-foreground">{feat}</div>
              <div className="px-4 py-3 flex justify-center items-center border-x border-border/50">
                <Check className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="px-4 py-3 flex justify-center items-center">
                <Check className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
          ))}

          {PREMIUM_FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="grid grid-cols-3 text-sm border-b border-border/50 last:border-0">
              <div className="px-4 py-3 flex items-center gap-2 text-muted-foreground">
                <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs">{text}</span>
              </div>
              <div className="px-4 py-3 flex justify-center items-center border-x border-border/50">
                <span className="text-muted-foreground text-xs">—</span>
              </div>
              <div className="px-4 py-3 flex justify-center items-center">
                <Check className="w-4 h-4 text-primary" />
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Payment processing coming soon. Pricing is subject to change before launch.
          Cancel anytime — no hidden fees.
        </p>
      </div>
    </AppShell>
  )
}
