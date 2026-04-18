'use client'

import { SidebarNav } from './sidebar-nav'
import { BottomNav } from './bottom-nav'
import { useAuthStore } from '@/lib/stores/auth-store'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthStore()

  return (
    <div className="flex min-h-screen">
      <SidebarNav />
      <main className="flex-1 md:ml-60 pb-20 md:pb-0">
        {profile && (
          <div className="bg-muted/60 border-b border-border px-4 py-1 text-center text-xs text-muted-foreground">
            Logged in as <strong className="text-foreground">{profile.nickname}</strong>
          </div>
        )}
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
