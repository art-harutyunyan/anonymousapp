'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Compass, MessageCircle, User, LogOut, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useSupabase } from '@/components/providers/supabase-provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/discover', icon: Compass,        label: 'Discover'  },
  { href: '/chat',     icon: MessageCircle,   label: 'Chats'     },
  { href: '/settings', icon: User,            label: 'Profile'   },
]

export function SidebarNav() {
  const pathname = usePathname()
  const { profile } = useAuthStore()
  const supabase = useSupabase()
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  const initials = profile?.nickname
    ? profile.nickname.slice(0, 2).toUpperCase()
    : '?'

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen border-r border-border bg-[#f5f0e8]/80 backdrop-blur-xl p-4 gap-2 fixed top-0 left-0 z-40">
      {/* Logo */}
      <div className="px-3 py-4 mb-2">
        <Link href="/" className="text-xl font-bold font-display brand-gradient-text hover:opacity-80 transition-opacity">
          Anonymous Match
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/50 hover:bg-black/[0.04] hover:text-foreground'
              )}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              {label}
            </Link>
          )
        })}

        {profile?.is_admin && (
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
              pathname.startsWith('/admin')
                ? 'bg-destructive/10 text-destructive'
                : 'text-foreground/50 hover:bg-black/[0.04] hover:text-foreground'
            )}
          >
            <ShieldCheck className="w-4.5 h-4.5 shrink-0" />
            Admin
          </Link>
        )}
      </nav>

      {/* User profile footer */}
      <div className="border-t border-border pt-4 flex items-center gap-3">
        <Avatar className="w-8 h-8">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{profile?.nickname ?? 'Anonymous'}</p>
          <p className="text-xs text-foreground/40">
            {profile?.is_premium ? '✦ Premium' : 'Free plan'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-foreground/40 hover:text-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </aside>
  )
}
