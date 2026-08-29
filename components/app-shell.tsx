"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Menu, Search, Bell } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { LanguageSwitcher } from "@/components/language-switcher"
import { RaqeebLogo, RaqeebMark } from "@/components/raqeeb-logo"
import { useI18n } from "@/lib/i18n/client"

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
  const { t } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const previousCount = useRef(0)
  const { data: alertData, mutate: refreshAlerts } = useSWR<{ count: number; notifications: { message: string }[] }>(
    "/api/ai-monitoring/notifications",
    (url: string) => fetch(url).then((response) => response.json()),
    { refreshInterval: 10000 },
  )
  const unreadCount = alertData?.count ?? 0
  useEffect(() => {
    if (unreadCount > previousCount.current && previousCount.current > 0) toast.error(t("aiMonitoring.title"))
    previousCount.current = unreadCount
  }, [unreadCount, t])
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
            aria-label={t("common.actions")}
          >
            <Menu className="size-5" />
          </button>

          {/* أيقونة رقيب ثابتة في بداية الهيدر (مقابلة لاسم المستخدم/الإشعارات في النهاية) */}
          <RaqeebMark className="size-8 shrink-0" />

          <div className="relative hidden flex-1 max-w-md md:block">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder={`${t("common.search")}...`}
              className="w-full rounded-lg border border-input bg-background py-2 ps-9 pe-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>

          <div className="flex flex-1 items-center justify-end gap-1 md:flex-none">
            <LanguageSwitcher />
            <button
              onClick={clearAlerts}
              className="relative rounded-md p-2 text-foreground hover:bg-muted"
              aria-label={`${unreadCount} ${t("aiMonitoring.title")}`}
              title={t("toast.updated")}
            >
              <Bell className="size-5" />
              {unreadCount > 0 && <span className="absolute -end-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-destructive-foreground">{unreadCount > 99 ? "99+" : unreadCount}</span>}
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

        <footer className="mt-auto border-t border-border px-4 py-6 md:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-start">
            <RaqeebLogo />
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} رقيب — لأنظمة السلامة والصحة المهنية
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
