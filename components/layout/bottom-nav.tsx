'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, MessageCircle, Heart, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/components/providers/supabase-provider'
import { useAuthStore } from '@/lib/stores/auth-store'

const navItems = [
  { href: '/discover', icon: Compass,       label: 'Discover' },
  { href: '/matches',  icon: Heart,          label: 'Matches'  },
  { href: '/chat',     icon: MessageCircle,  label: 'Chat'     },
  { href: '/settings', icon: Settings,       label: 'Settings' },
]

export function BottomNav() {
  const pathname = usePathname()
  const supabase = useSupabase()
  const { profile } = useAuthStore()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/80 backdrop-blur-md md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors min-w-0',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'drop-shadow-[0_0_6px_hsl(var(--primary))]')} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          )
        })}
        <button
          onClick={handleSignOut}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors min-w-0 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none max-w-[4rem] truncate">
            {profile?.nickname ?? 'Logout'}
          </span>
        </button>
      </div>
    </nav>
  )
}
