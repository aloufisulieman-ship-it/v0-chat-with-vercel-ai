"use client"

import { useEffect, useState, type ReactNode } from "react"
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
  ShieldCheck,
  Building2,
  BookMarked,
  Target,
  Scale,
  MessagesSquare,
  Siren,
  HardHat,
  Gavel,
  FolderKanban,
  Ban,
  Inbox,
  Footprints,
  Cctv,
  Truck,
  ScrollText,
  CheckSquare,
  BarChart3,
  Settings,
  Users,
  UserCog,
  LogOut,
  ChevronDown,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RaqeebMark } from "@/components/raqeeb-logo"
import { authClient } from "@/lib/auth-client"
import { hasModuleAccess, type ModuleKey } from "@/lib/permissions"
import { useI18n } from "@/lib/i18n/client"
import { useIsMobile } from "@/hooks/use-mobile"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// labelKey: مفتاح ترجمة في namespace modules (mostly) أو nav — يُترجَم وقت العرض.
// module: يحكم ظهور العنصر حسب صلاحية المستخدم. الأدمن يرى كل شيء.
// clause: رقم بند ISO 45001 يُعرَض بجانب العنوان (لأبناء مجموعة التدقيق).
// soon: عنصر معطّل بشارة «قريباً» لصفحة لم تُنشأ بعد (للمستقبل).
type NavLeaf = {
  kind?: "leaf"
  href: string
  labelKey: string
  icon: typeof LayoutDashboard
  module: ModuleKey
  clause?: string
  soon?: boolean
}
type NavGroup = {
  kind: "group"
  labelKey: string
  icon: typeof LayoutDashboard
  module: ModuleKey
  children: NavLeaf[]
}
// عنصر ديناميكي يمثّل قسم «الأقسام» في القائمة — يُبنى وقت التشغيل من /api/departments/nav
// (لا يُكتب ثابتاً)، ويقرّر بنفسه أن يظهر كمجموعة قابلة للطي أو كبند مباشر «واردي».
type NavDepartments = { kind: "departments" }
type NavEntry = NavLeaf | NavGroup | NavDepartments

// شكل استجابة /api/departments/nav المستهلَكة في القائمة الجانبية.
type DeptNav = {
  visible: boolean
  mode: "group" | "single" | "none"
  canSeeOverview: boolean
  overdueTotal: number
  departments: { code: string; nameAr: string; open: number }[]
}

// عنصر «التدقيق» القابل للطي — يحتفظ بموقعه بين «الإجراءات التصحيحية» و«الوثائق»
// وبنفس أيقونة /audits السابقة، ويضم نظرة عامة على التدقيق وكل بنود ISO 45001.
const auditGroup: NavGroup = {
  kind: "group",
  labelKey: "modules.audits",
  icon: ClipboardList,
  module: "audits",
  children: [
    { href: "/audits", labelKey: "nav.auditOverview", icon: ClipboardList, module: "audits" },
    { href: "/compliance", labelKey: "modules.compliance", icon: ShieldCheck, module: "compliance" },
    { href: "/context", labelKey: "modules.context", icon: Building2, module: "context", clause: "4" },
    { href: "/policy", labelKey: "modules.policy", icon: BookMarked, module: "policy", clause: "5.2" },
    { href: "/consultation", labelKey: "modules.consultation", icon: MessagesSquare, module: "consultation", clause: "5.4" },
    { href: "/legal-register", labelKey: "modules.legal-register", icon: Scale, module: "legal-register", clause: "6.1.3" },
    { href: "/objectives", labelKey: "modules.objectives", icon: Target, module: "objectives", clause: "6.2" },
    { href: "/emergency", labelKey: "modules.emergency", icon: Siren, module: "emergency", clause: "8.2" },
    { href: "/contractors", labelKey: "modules.contractors", icon: HardHat, module: "contractors", clause: "8.1.4" },
    { href: "/management-review", labelKey: "modules.management-review", icon: Gavel, module: "management-review", clause: "9.3" },
  ],
}

// عناصر القائمة الرئيسية — عنصر «التدقيق» مجموعة قابلة للطي في موقعه بين الإجراءات والوثائق.
const nav: NavEntry[] = [
  { href: "/", labelKey: "modules.dashboard", icon: LayoutDashboard, module: "dashboard" },
  { href: "/incidents", labelKey: "modules.incidents", icon: AlertTriangle, module: "incidents" },
  { href: "/inspections", labelKey: "modules.inspections", icon: ClipboardCheck, module: "inspections" },
  { href: "/risks", labelKey: "modules.risks", icon: ShieldAlert, module: "risks" },
  { href: "/permits", labelKey: "modules.permits", icon: FileSignature, module: "permits" },
  { href: "/training", labelKey: "modules.training", icon: GraduationCap, module: "training" },
  { href: "/employees", labelKey: "nav.employees", icon: Users, module: "employees" },
  { href: "/violations", labelKey: "modules.violations", icon: Ban, module: "violations" },
  { href: "/patrol", labelKey: "nav.patrol", icon: Footprints, module: "patrol" },
  { href: "/ai-monitoring", labelKey: "modules.ai_monitoring", icon: Cctv, module: "ai_monitoring" },
  { href: "/equipment", labelKey: "nav.equipment", icon: Truck, module: "equipment" },
  { href: "/safety-rules", labelKey: "nav.safetyRules", icon: ScrollText, module: "safety_rules" },
  { kind: "departments" },
  { href: "/actions", labelKey: "modules.actions", icon: CheckSquare, module: "actions" },
  auditGroup,
  { href: "/documents", labelKey: "modules.documents", icon: FolderKanban, module: "documents" },
  { href: "/reports", labelKey: "modules.reports", icon: BarChart3, module: "reports" },
  { href: "/settings", labelKey: "modules.settings", icon: Settings, module: "settings" },
]

// مكوّن القائمة القابلة للطي — مشترك بين «التدقيق» و«الأقسام». النقر على البند الأب يستدعي
// onToggle الممرَّر من الأب الذي يبدّل الحالة (open ⇄ close) لا أن يفتح فقط، فيصحّ الانطواء
// للبندين معاً. الشارة الحمراء (badgeCount) اختيارية وتظهر على الأب عند وجود متأخرات.
function CollapsibleNavGroup({
  icon: Icon,
  label,
  isOpen,
  onToggle,
  active,
  badgeCount = 0,
  t,
  children,
}: {
  icon: typeof LayoutDashboard
  label: string
  isOpen: boolean
  onToggle: () => void
  active: boolean
  badgeCount?: number
  t: (key: string) => string
  children: ReactNode
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          active
            ? "text-sidebar-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        <Icon className="size-5 shrink-0" />
        <span className="flex-1 text-start">{label}</span>
        {badgeCount > 0 && (
          <span
            className="flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground"
            aria-label={`${badgeCount}`}
          >
            {badgeCount}
          </span>
        )}
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", isOpen ? "rotate-180" : "rotate-0")}
          aria-label={isOpen ? t("nav.collapseGroup") : t("nav.expandGroup")}
        />
      </button>
      {isOpen && (
        <ul className="mt-1 flex flex-col gap-1 border-e border-sidebar-border pe-3 me-4">{children}</ul>
      )}
    </li>
  )
}

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
  const isMobile = useIsMobile()

  // إغلاق القائمة تلقائياً عند تغيّر المسار (بعد الانتقال إلى صفحة جديدة على الجوال).
  useEffect(() => {
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const canSee = (module: ModuleKey) => hasModuleAccess(user?.role, user?.permissions, module)

  // أبناء مجموعة «التدقيق» المرئيون حسب صلاحية كل بند (الأدمن/المدير يرى الكل).
  const auditItems = auditGroup.children.filter((child) => canSee(child.module))
  // هل المستخدم داخل أي صفحة فرعية من صفحات التدقيق؟ (للتمييز البصري للأب فقط، لا للفتح/الإغلاق).
  const auditActive = auditItems.some((child) => pathname.startsWith(child.href))

  // القائمة المفتوحة مملوكة للمستخدم بالكامل (accordion: قائمة واحدة مفتوحة في كل مرة).
  // الحالة الأولية فقط تُشتقّ من المسار — تُحسب مرة واحدة عند التحميل ولا يُعاد تطبيقها بعدها،
  // كي لا يمنع المسارُ إغلاق القائمة عند الضغط عليها ثانيةً.
  const [openMenu, setOpenMenu] = useState<string | null>(() => {
    if (
      pathname.startsWith("/audit") ||
      auditGroup.children.some((child) => pathname.startsWith(child.href))
    )
      return "audit"
    if (pathname.startsWith("/departments")) return "departments"
    return null
  })

  // لوحة التحكم فقط هي الصفحة الأساسية الدائمة كي لا يُقفل أي مستخدم خارج النظام.
  // كل صفحة أخرى (بما فيها المراقبة الذكية والإعدادات والصفحات التي كانت "عامة")
  // تخضع لنظام الصلاحيات: تظهر فقط إذا مُنحت الوحدة صراحةً، أو كان الدور admin/manager.
  // مجموعة «التدقيق» تظهر إذا كان أي بند من أبنائها مرئياً.
  const alwaysOn: ModuleKey[] = ["dashboard"]
  const visible = nav.filter((entry) => {
    if (entry.kind === "group") return auditItems.length > 0
    // قسم «الأقسام» يمرّ دائماً؛ ظهوره الفعلي يُحسم عميلياً حسب deptNav.visible.
    if (entry.kind === "departments") return true
    return alwaysOn.includes(entry.module) || canSee(entry.module)
  })
  const items: NavEntry[] =
    user?.role === "admin"
      ? [
          ...visible,
          { href: "/admin/users", labelKey: "nav.adminUsers", icon: UserCog, module: "settings" },
          { href: "/users", labelKey: "nav.users", icon: Users, module: "settings" },
        ]
      : visible

  // بيانات قسم «الأقسام» للقائمة: الأقسام المرئية للمستخدم وعدّاداتها ومجموع المتأخرات.
  const { data: deptNav } = useSWR<DeptNav>("/api/departments/nav", fetcher, {
    refreshInterval: 30000,
  })

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  // محتوى القائمة مشترك بين وضع الجوال (داخل Sheet) والحاسوب (aside ثابت في التدفق).
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-5 py-4">
        <div className="flex items-center gap-3">
          <RaqeebMark className="size-10 shrink-0 rounded-lg bg-white" />
          <div className="flex flex-col">
            <span className="text-lg font-extrabold leading-tight">رقيب</span>
            <span className="text-xs text-sidebar-foreground/60">{t("nav.brandSubtitle")}</span>
          </div>
        </div>
        {isMobile && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent"
            aria-label={t("common.close")}
          >
            <X className="size-5" />
          </button>
        )}
      </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {items.map((entry) => {
              // مجموعة «التدقيق» القابلة للطي — تستخدم نفس مكوّن CollapsibleNavGroup المشترك.
              if (entry.kind === "group") {
                return (
                  <CollapsibleNavGroup
                    key="audit-group"
                    icon={entry.icon}
                    label={t(entry.labelKey)}
                    isOpen={openMenu === "audit"}
                    onToggle={() => setOpenMenu((prev) => (prev === "audit" ? null : "audit"))}
                    active={auditActive}
                    t={t}
                  >
                    {auditItems.map((child) => {
                      const childActive = pathname.startsWith(child.href)
                      const ChildIcon = child.icon
                      const label = t(child.labelKey)
                      if (child.soon) {
                        return (
                          <li key={child.href}>
                            <span
                              aria-disabled="true"
                              className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/40"
                            >
                              <ChildIcon className="size-4 shrink-0" />
                              <span className="flex-1">{label}</span>
                              {child.clause && (
                                <span className="font-mono text-xs text-sidebar-foreground/30" dir="ltr">
                                  {child.clause}
                                </span>
                              )}
                              <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold text-sidebar-foreground/50">
                                {t("nav.soon")}
                              </span>
                            </span>
                          </li>
                        )
                      }
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={onClose}
                            aria-current={childActive ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                              childActive
                                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                            )}
                          >
                            <ChildIcon className="size-4 shrink-0" />
                            <span className="flex-1">{label}</span>
                            {child.clause && (
                              <span
                                className={cn(
                                  "font-mono text-xs",
                                  childActive ? "text-sidebar-primary-foreground/70" : "text-sidebar-foreground/40",
                                )}
                                dir="ltr"
                              >
                                {child.clause}
                              </span>
                            )}
                          </Link>
                        </li>
                      )
                    })}
                  </CollapsibleNavGroup>
                )
              }

              // قسم «الأقسام» الديناميكي — يُبنى من نتيجة /api/departments/nav.
              if (entry.kind === "departments") {
                if (!deptNav?.visible) return null

                // مستخدم عادي مرتبط بقسم واحد: بند مباشر «واردي» يفتح قسمه فقط (لا قائمة فرعية).
                if (deptNav.mode === "single") {
                  const d = deptNav.departments[0]
                  if (!d) return null
                  const href = `/departments/${d.code}`
                  const active = pathname === href
                  return (
                    <li key="departments-single">
                      <Link
                        href={href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                        )}
                      >
                        <Inbox className="size-5 shrink-0" />
                        <span className="flex-1">{t("nav.myInbox")}</span>
                        {d.open > 0 && (
                          <span
                            className={cn(
                              "flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold",
                              active
                                ? "bg-sidebar-primary-foreground text-sidebar-primary"
                                : "bg-primary text-primary-foreground",
                            )}
                            aria-label={`${d.open}`}
                          >
                            {d.open}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                }

                // مدير/مسؤول: مجموعة قابلة للطي بكل الأقسام النشطة + «نظرة عامة».
                // الشارة الحمراء على الأب = مجموع الإحالات المتأخرة في كل الأقسام المرئية.
                return (
                  <CollapsibleNavGroup
                    key="departments-group"
                    icon={Building2}
                    label={t("nav.departments")}
                    isOpen={openMenu === "departments"}
                    onToggle={() => setOpenMenu((prev) => (prev === "departments" ? null : "departments"))}
                    active={pathname.startsWith("/departments")}
                    badgeCount={deptNav.overdueTotal}
                    t={t}
                  >
                    {deptNav.departments.map((d) => {
                      const href = `/departments/${d.code}`
                      const childActive = pathname === href
                      return (
                        <li key={d.code}>
                          <Link
                            href={href}
                            onClick={onClose}
                            aria-current={childActive ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                              childActive
                                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                            )}
                          >
                            <Building2 className="size-4 shrink-0" />
                            <span className="flex-1">{d.nameAr}</span>
                            {d.open > 0 && (
                              <span
                                className={cn(
                                  "flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold",
                                  childActive
                                    ? "bg-sidebar-primary-foreground text-sidebar-primary"
                                    : "bg-primary text-primary-foreground",
                                )}
                                aria-label={`${d.open}`}
                              >
                                {d.open}
                              </span>
                            )}
                          </Link>
                        </li>
                      )
                    })}
                    {deptNav.canSeeOverview && (
                      <li key="__overview">
                        <Link
                          href="/departments/overview"
                          onClick={onClose}
                          aria-current={pathname === "/departments/overview" ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            pathname === "/departments/overview"
                              ? "bg-sidebar-primary text-sidebar-primary-foreground"
                              : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                          )}
                        >
                          <BarChart3 className="size-4 shrink-0" />
                          <span className="flex-1">{t("nav.departmentsOverview")}</span>
                        </Link>
                      </li>
                    )}
                  </CollapsibleNavGroup>
                )
              }

              const active = entry.href === "/" ? pathname === "/" : pathname.startsWith(entry.href)
              const Icon = entry.icon
              return (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="flex-1">{t(entry.labelKey)}</span>
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
    </>
  )

  // الجوال (< 768px): درج منزلق من اليمين (RTL) عبر shadcn Sheet — يُبوّب المحتوى إلى body
  // فيتجنّب أي إزاحة أفقية، مغلق افتراضياً ويُدار عبر open/onClose من الغلاف.
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(next) => { if (!next) onClose() }}>
        <SheetContent
          side="right"
          className="flex w-72 max-w-[85vw] flex-col gap-0 border-none bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
        >
          <SheetTitle className="sr-only">{t("nav.brandSubtitle")}</SheetTitle>
          {inner}
        </SheetContent>
      </Sheet>
    )
  }

  // الحاسوب (>= 768px): قائمة ثابتة ضمن تدفق الصفحة بكامل ارتفاع الشاشة.
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      {inner}
    </aside>
  )
}
