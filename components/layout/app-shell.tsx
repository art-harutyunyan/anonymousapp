'use client'

import { SidebarNav } from './sidebar-nav'
import { BottomNav } from './bottom-nav'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <SidebarNav />
      <main className="flex-1 md:ml-60 pb-20 md:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
