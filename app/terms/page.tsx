import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Terms of Service — Anonymous Match' }

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mb-8 -ml-2')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Link>

        <h1 className="text-3xl font-bold font-display mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Effective date: January 1, 2026</p>

        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Anonymous Match (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform. We may update these terms at any time; continued use constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Eligibility</h2>
            <p className="text-muted-foreground leading-relaxed">
              You must be at least <strong className="text-foreground">18 years of age</strong> to use the Platform. By creating an account you confirm that you are 18 or older. We reserve the right to terminate any account where we have reason to believe the user is under 18.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Account Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>You are responsible for maintaining the confidentiality of your credentials.</li>
              <li>You may not create accounts for others or operate bot accounts without our written permission.</li>
              <li>You must provide accurate information during registration and keep it up to date.</li>
              <li>One account per person. Duplicate accounts used to circumvent bans are prohibited.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">You agree not to use the Platform to:</p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Harass, threaten, or intimidate other users.</li>
              <li>Share sexually explicit or violent content.</li>
              <li>Solicit money, personal information, or off-platform contact from other users.</li>
              <li>Impersonate any person or entity.</li>
              <li>Send spam, unsolicited advertising, or chain messages.</li>
              <li>Attempt to identify, dox, or expose the real-world identity of other users.</li>
              <li>Violate any applicable law or regulation.</li>
              <li>Circumvent any technical measures designed to enforce these terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of content you submit, but grant us a non-exclusive, royalty-free licence to store, display, and moderate that content for the purpose of operating the Platform. We may remove any content that violates these terms without notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Premium Subscriptions</h2>
            <p className="text-muted-foreground leading-relaxed">
              Premium features are billed on a recurring basis. You may cancel at any time; cancellation takes effect at the end of the current billing period. Refunds are not issued for partial billing periods except where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may suspend or terminate your account at any time for violation of these terms. You may delete your account at any time via Settings. Upon deletion, your profile data is removed from public view; residual data may be retained in backups for up to 90 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Disclaimers &amp; Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Platform is provided &quot;as is&quot; without warranties of any kind. We are not liable for the conduct of other users or for any loss arising from your use of the Platform. Our total liability to you shall not exceed the amount you paid us in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These terms are governed by the laws of the jurisdiction in which the operator is established. Any disputes shall be resolved through binding arbitration except where prohibited by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these terms, contact us at <strong className="text-foreground">legal@anonymousmatch.app</strong>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border text-xs text-muted-foreground flex gap-4">
          <Link href="/privacy" className="hover:text-foreground underline">Privacy Policy</Link>
          <Link href="/community-guidelines" className="hover:text-foreground underline">Community Guidelines</Link>
        </div>
      </div>
    </div>
  )
}
