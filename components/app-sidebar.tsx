"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import useSWR from "swr"
import {
  LayoutDashboard,
  AlertTriangle,
  ClipboardCheck,
  ShieldAlert,
  GraduationCap,
  FileSignature,
  ClipboardList,
  FolderKanban,
  Ban,
  Banknote,
  Footprints,
  Cctv,
  CheckSquare,
  BarChart3,
  Settings,
  ShieldCheck,
  Users,
  UserCog,
  LogOut,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"
import { hasModuleAccess, type ModuleKey } from "@/lib/permissions"
import { useI18n } from "@/lib/i18n/client"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// labelKey: مفتاح ترجمة في namespace modules (mostly) أو nav — يُترجَم وقت العرض.
// module: يحكم ظهور العنصر حسب صلاحية المستخدم. الأدمن يرى كل شيء.
const nav: { href: string; labelKey: string; icon: typeof LayoutDashboard; module: ModuleKey }[] = [
  { href: "/", labelKey: "modules.dashboard", icon: LayoutDashboard, module: "dashboard" },
  { href: "/incidents", labelKey: "modules.incidents", icon: AlertTriangle, module: "incidents" },
  { href: "/inspections", labelKey: "modules.inspections", icon: ClipboardCheck, module: "inspections" },
  { href: "/risks", labelKey: "modules.risks", icon: ShieldAlert, module: "risks" },
  { href: "/permits", labelKey: "modules.permits", icon: FileSignature, module: "permits" },
  { href: "/training", labelKey: "modules.training", icon: GraduationCap, module: "training" },
  { href: "/employees", labelKey: "nav.employees", icon: Users, module: "training" },
  { href: "/violations", labelKey: "modules.violations", icon: Ban, module: "violations" },
  { href: "/patrol", labelKey: "nav.patrol", icon: Footprints, module: "violations" },
  { href: "/ai-monitoring", labelKey: "modules.ai_monitoring", icon: Cctv, module: "ai_monitoring" },
  { href: "/hr", labelKey: "modules.hr", icon: UserCog, module: "hr" },
  { href: "/finance", labelKey: "modules.finance", icon: Banknote, module: "finance" },
  { href: "/actions", labelKey: "modules.actions", icon: CheckSquare, module: "actions" },
  { href: "/audits", labelKey: "modules.audits", icon: ClipboardList, module: "audits" },
  { href: "/documents", labelKey: "modules.documents", icon: FolderKanban, module: "documents" },
  { href: "/reports", labelKey: "modules.reports", icon: BarChart3, module: "reports" },
  { href: "/settings", labelKey: "modules.settings", icon: Settings, module: "settings" },
]

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2)
  return (parts[0][0] ?? "") + (parts[1][0] ?? "")
}

export function AppSidebar({
  open,
  onClose,
  user,
}: {
  open: boolean
  onClose: () => void
  user: { name: string; email: string; role?: string; permissions?: string }
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useI18n()

  // Dashboard and settings are always available so no user gets locked out (settings holds password change).
  const alwaysOn: ModuleKey[] = ["dashboard", "settings"]
  // صفحات المراقبة الذكية (المراجعة) مقصورة على مسؤول HSE: admin أو manager.
  const isReviewer = user?.role === "admin" || user?.role === "manager"
  const visible = nav.filter((item) => {
    if (item.href === "/ai-monitoring") return isReviewer
    return alwaysOn.includes(item.module) || hasModuleAccess(user?.role, user?.permissions, item.module)
  })
  const items =
    user?.role === "admin"
      ? [...visible, { href: "/users", labelKey: "nav.users", icon: Users }]
      : visible

  // شارة الإشعار: عدد بنود الموارد البشرية غير المعالجة (تُجلب فقط لمن يملك الوصول).
  const hrVisible = visible.some((item) => item.href === "/hr")
  const { data: hrData } = useSWR<{ count: number }>(
    hrVisible ? "/api/hr/pending-count" : null,
    fetcher,
    { refreshInterval: 30000 },
  )
  const hrCount = hrData?.count ?? 0

  // شارة الإشعار: عدد المخالفات الخارجية غير المعالجة لدى المالية.
  const financeVisible = visible.some((item) => item.href === "/finance")
  const { data: financeData } = useSWR<{ count: number }>(
    financeVisible ? "/api/finance/pending-count" : null,
    fetcher,
    { refreshInterval: 30000 },
  )
  const financeCount = financeData?.count ?? 0

  // خريطة عدّادات الإشعارات حسب المسار.
  const countByHref: Record<string, number> = { "/hr": hrCount, "/finance": financeCount }

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          // في الشاشات الكبيرة: عنصر ثابت ضمن التدفق (يظهر تلقائيًا في جهة البداية حسب dir).
          // في الجوال: درج علوي منزلق مثبّت في جهة النهاية (end) ويُخفى بالانزلاق خارجها.
          "fixed inset-y-0 end-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <ShieldCheck className="size-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-tight">{t("nav.brandTitle")}</span>
              <span className="text-xs text-sidebar-foreground/60">{t("nav.brandSubtitle")}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent lg:hidden"
            aria-label={t("common.close")}
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
              const Icon = item.icon
              const badgeCount = countByHref[item.href] ?? 0
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="flex-1">{t(item.labelKey)}</span>
                    {badgeCount > 0 && (
                      <span
                        className={cn(
                          "flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold",
                          active
                            ? "bg-sidebar-primary-foreground text-sidebar-primary"
                            : "bg-destructive text-destructive-foreground",
                        )}
                        aria-label={`${badgeCount}`}
                      >
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border px-3 py-4">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
              {initials(user.name)}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="truncate text-xs text-sidebar-foreground/60" dir="ltr">
                {user.email}
              </span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="size-5 shrink-0" />
            {t("common.logout")}
          </button>
        </div>
      </aside>
    </>
  )
}
