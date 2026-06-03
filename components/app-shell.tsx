"use client"

import { useState, type ReactNode } from "react"
import { Menu, Search, Bell } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"

export function AppShell({
  title,
  subtitle,
  action,
  user,
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  user: { name: string; email: string; role?: string }
  children: ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur md:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-foreground hover:bg-muted lg:hidden"
            aria-label="فتح القائمة"
          >
            <Menu className="size-5" />
          </button>

          <div className="relative hidden flex-1 max-w-md md:block">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="بحث في النظام..."
              className="w-full rounded-lg border border-input bg-background py-2 pr-9 pl-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
            <button
              className="relative rounded-md p-2 text-foreground hover:bg-muted"
              aria-label="الإشعارات"
            >
              <Bell className="size-5" />
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground text-balance">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground text-pretty">{subtitle}</p>}
            </div>
            {action}
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
