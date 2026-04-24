import Link from 'next/link'
import { ArrowLeft, Shield, Heart, MessageCircle, AlertTriangle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Community Guidelines — Anonymous Match' }

const rules = [
  {
    icon: Heart,
    title: 'Treat everyone with respect',
    items: [
      'Be kind and courteous, even if you decide not to continue a conversation.',
      'No hate speech, discrimination, or derogatory language based on gender, age, ethnicity, religion, sexual orientation, or disability.',
      'No threatening, intimidating, or abusive messages.',
    ],
  },
  {
    icon: Shield,
    title: 'Keep it safe',
    items: [
      'Do not share or request personally identifying information (real name, address, phone number, social media handles).',
      'Do not attempt to move conversations to external platforms in ways that pressure or manipulate other users.',
      'Do not impersonate another person or claim to be a minor.',
      '18+ only. If you encounter someone you believe is underage, report them immediately.',
    ],
  },
  {
    icon: AlertTriangle,
    title: 'No harmful content',
    items: [
      'No sexually explicit images or videos.',
      'No graphic violence or gore.',
      'No content that promotes self-harm or suicide.',
      'No content promoting illegal activity.',
      'No spam, chain messages, or unsolicited advertising.',
    ],
  },
  {
    icon: MessageCircle,
    title: 'Use the platform as intended',
    items: [
      'This is a chat platform — do not use it to solicit money, goods, or services.',
      'Do not create multiple accounts to circumvent bans or rate limits.',
      'Do not use automated tools or bots to interact with other users.',
      'Do not attempt to exploit technical vulnerabilities.',
    ],
  },
]

export default function CommunityGuidelinesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mb-8 -ml-2')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Link>

        <h1 className="text-3xl font-bold font-display mb-2">Community Guidelines</h1>
        <p className="text-sm text-muted-foreground mb-4">These rules apply to all users of Anonymous Match at all times.</p>
        <p className="text-muted-foreground leading-relaxed mb-10">
          Anonymous Match exists to help adults have better, safer conversations. Anonymity is a privilege — it only works when everyone uses it responsibly. Violations of these guidelines may result in immediate suspension or permanent ban.
        </p>

        <div className="space-y-8">
          {rules.map(({ icon: Icon, title, items }) => (
            <div key={title} className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">{title}</h2>
              </div>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 bg-destructive/10 border border-destructive/30 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-2 text-destructive">Enforcement</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Violations are reviewed by our moderation team. Depending on severity, consequences range from a warning to a permanent ban. We reserve the right to cooperate with law enforcement where activity may be illegal. If you believe someone is in immediate danger, contact local emergency services immediately.
          </p>
        </div>

        <div className="mt-8 bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-2">How to Report</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Use the <strong className="text-foreground">Report</strong> button in any active chat (tap the three-dot menu in the top right). Reports are reviewed by our team within 24 hours. You can also contact us at <strong className="text-foreground">safety@anonymousmatch.app</strong>.
          </p>
        </div>

        <div className="mt-12 pt-6 border-t border-border text-xs text-muted-foreground flex gap-4">
          <Link href="/terms" className="hover:text-foreground underline">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-foreground underline">Privacy Policy</Link>
        </div>
      </div>
    </div>
  )
}
