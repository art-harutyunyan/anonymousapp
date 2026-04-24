'use client'

import { SidebarNav } from './sidebar-nav'
import { BottomNav } from './bottom-nav'
import { ConnectionIndicator } from './connection-indicator'
import { useAuthStore } from '@/lib/stores/auth-store'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthStore()

  return (
    <div className="flex min-h-screen">
      <SidebarNav />
      <main className="flex-1 md:ml-60 pb-20 md:pb-0">
        {profile && (
          <div className="bg-black/[0.03] border-b border-border px-4 py-1 flex items-center justify-between gap-3 text-xs text-foreground/50">
            <span className="flex-1 text-center">
              Logged in as <strong className="text-foreground">{profile.nickname}</strong>
            </span>
            <ConnectionIndicator className="shrink-0" />
          </div>
        )}
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
