"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import useSWR from "swr"
import { toast } from "sonner"
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
  user: { name: string; email: string; role?: string; permissions?: string }
  children: ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const previousCount = useRef(0)
  const { data: alertData, mutate: refreshAlerts } = useSWR<{ count: number; notifications: { message: string }[] }>(
    "/api/ai-monitoring/notifications",
    (url: string) => fetch(url).then((response) => response.json()),
    { refreshInterval: 10000 },
  )
  const unreadCount = alertData?.count ?? 0
  useEffect(() => {
    if (unreadCount > previousCount.current && previousCount.current > 0) toast.error("تنبيه سلامة جديد من المراقبة الذكية")
    previousCount.current = unreadCount
  }, [unreadCount])
  async function clearAlerts() {
    if (!unreadCount) return
    await fetch("/api/ai-monitoring/notifications", { method: "POST" })
    await refreshAlerts()
  }

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
              onClick={clearAlerts}
              className="relative rounded-md p-2 text-foreground hover:bg-muted"
              aria-label={`${unreadCount} تنبيهات غير مطّلع عليها`}
              title="تمييز تنبيهات المراقبة كمطّلع عليها"
            >
              <Bell className="size-5" />
              {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-destructive-foreground">{unreadCount > 99 ? "99+" : unreadCount}</span>}
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
