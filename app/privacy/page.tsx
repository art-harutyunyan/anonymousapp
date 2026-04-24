import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Privacy Policy — Anonymous Match' }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mb-8 -ml-2')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Link>

        <h1 className="text-3xl font-bold font-display mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Effective date: January 1, 2026</p>

        <div className="space-y-8 text-foreground">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Our Privacy Commitment</h2>
            <p className="text-muted-foreground leading-relaxed">
              Anonymous Match is built on the principle of anonymity. We collect only the minimum data necessary to provide the matching and chat service, and we will never sell your personal data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Data We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-1">Account data</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">Email address (required for sign-in and account recovery). We do not store your real name.</p>
              </div>
              <div>
                <h3 className="font-medium mb-1">Profile data</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">Gender, age range, chat intent, interests, optional nickname, optional country, optional avatar. This data is used solely for matching and is displayed only in limited form to compatible users.</p>
              </div>
              <div>
                <h3 className="font-medium mb-1">Chat data</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">Messages and media you send within matched conversations. Chat content is stored to deliver the service and is not read by staff unless flagged via a report.</p>
              </div>
              <div>
                <h3 className="font-medium mb-1">Activity data</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">Actions such as swipes, matches, blocks, and reports are logged for safety, abuse prevention, and product improvement.</p>
              </div>
              <div>
                <h3 className="font-medium mb-1">Technical data</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">IP address, device type, and browser type collected automatically for security and fraud prevention.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>To match you with compatible users based on your preferences.</li>
              <li>To operate the realtime chat service.</li>
              <li>To detect and prevent abuse, spam, and policy violations.</li>
              <li>To send transactional emails (account confirmation, password reset, subscription receipts).</li>
              <li>To improve the service through aggregated, anonymised analytics.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data Sharing</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">We do not sell your data. We share data only with:</p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Supabase</strong> — database and authentication infrastructure.</li>
              <li><strong className="text-foreground">Stripe</strong> — payment processing (premium subscriptions only); we do not store payment card numbers.</li>
              <li><strong className="text-foreground">Law enforcement</strong> — where required by valid legal process.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Chat media (images, videos) is retained for up to 90 days then purged automatically.</li>
              <li>Activity logs are retained for up to 12 months for safety and abuse-prevention purposes.</li>
              <li>When you delete your account, your profile is removed immediately; residual data in backups is purged within 90 days.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Depending on your jurisdiction you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Access a copy of the personal data we hold about you (available via Settings → Download my data).</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your account and associated data.</li>
              <li>Object to processing or request restriction of processing.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">To exercise any of these rights, contact us at <strong className="text-foreground">privacy@anonymousmatch.app</strong>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use only essential session cookies required for authentication. We do not use tracking or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              All data is transmitted over TLS. Passwords are hashed and never stored in plain text. Database access is governed by Row-Level Security policies ensuring users can only access their own data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We will notify registered users of material changes via email at least 14 days before they take effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Privacy questions: <strong className="text-foreground">privacy@anonymousmatch.app</strong>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border text-xs text-muted-foreground flex gap-4">
          <Link href="/terms" className="hover:text-foreground underline">Terms of Service</Link>
          <Link href="/community-guidelines" className="hover:text-foreground underline">Community Guidelines</Link>
        </div>
      </div>
    </div>
  )
}
