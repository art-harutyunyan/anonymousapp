import type { Metadata, Viewport } from 'next'
import { DM_Sans, Playfair_Display } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
import { SupabaseProvider } from '@/components/providers/supabase-provider'

const dmSans = DM_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const playfair = Playfair_Display({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: ['400', '700'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: 'Anonymous Match — Find Your Connection',
  description: 'Anonymous chat and matching for meaningful connections. 18+ only.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${playfair.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased">
        <SupabaseProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-foreground)',
              },
            }}
          />
        </SupabaseProvider>
      </body>
    </html>
  )
}
