"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  AlertTriangle,
  ClipboardCheck,
  ShieldAlert,
  GraduationCap,
  FileSignature,
  ClipboardList,
  FolderKanban,
  HardHat,
  Ban,
  CheckSquare,
  BarChart3,
  Settings,
  ShieldCheck,
  Users,
  LogOut,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"
import { canView, type SectionKey } from "@/lib/permissions"

// section: when set, the item is gated by the user's view permission for that section.
const nav: { href: string; label: string; icon: typeof LayoutDashboard; section?: SectionKey }[] = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/incidents", label: "الحوادث", icon: AlertTriangle, section: "incidents" },
  { href: "/inspections", label: "التفتيش", icon: ClipboardCheck, section: "inspections" },
  { href: "/risks", label: "تقييم المخاطر", icon: ShieldAlert, section: "risks" },
  { href: "/permits", label: "تصاريح العمل", icon: FileSignature, section: "permits" },
  { href: "/training", label: "التدريب", icon: GraduationCap, section: "training" },
  { href: "/ppe", label: "معدات الوقاية", icon: HardHat, section: "ppe" },
  { href: "/violations", label: "المخالفات", icon: Ban, section: "violations" },
  { href: "/actions", label: "الإجراءات التصحيحية", icon: CheckSquare, section: "actions" },
  { href: "/audits", label: "التدقيق", icon: ClipboardList, section: "audits" },
  { href: "/documents", label: "الوثائق", icon: FolderKanban, section: "documents" },
  { href: "/reports", label: "التقارير", icon: BarChart3, section: "reports" },
  { href: "/settings", label: "الإعدادات", icon: Settings },
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

  const visible = nav.filter((item) => !item.section || canView(user?.role, user?.permissions, item.section))
  const items =
    user?.role === "admin" ? [...visible, { href: "/users", label: "إدارة المستخدمين", icon: Users }] : visible

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
          "fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <ShieldCheck className="size-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-tight">نظام HSE</span>
              <span className="text-xs text-sidebar-foreground/60">الصحة والسلامة والبيئة</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
              const Icon = item.icon
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
                    <span>{item.label}</span>
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
            تسجيل الخروج
          </button>
        </div>
      </aside>
    </>
  )
}
