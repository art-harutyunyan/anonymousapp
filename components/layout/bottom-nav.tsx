'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, MessageCircle, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/discover', icon: Compass,       label: 'Discover' },
  { href: '/chat',     icon: MessageCircle,  label: 'Chats'    },
  { href: '/settings', icon: User,           label: 'Profile'  },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-black/[0.04] bg-[#faf6f0]/95 backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-around h-16 px-2 pb-[env(safe-area-inset-bottom)]">
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
                  : 'text-foreground/40 hover:text-foreground'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'drop-shadow-[0_0_6px_rgba(124,58,237,0.4)]')} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
