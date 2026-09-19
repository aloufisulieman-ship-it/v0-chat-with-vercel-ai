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
  QrCode,
  ScrollText,
  CheckSquare,
  BarChart3,
  Settings,
  Users,
  UserCog,
  KeyRound,
  FileWarning,
  LogOut,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RaqeebMark } from "@/components/raqeeb-logo"
import { authClient } from "@/lib/auth-client"
import { hasModuleAccess, type ModuleKey } from "@/lib/permissions"
import { useI18n } from "@/lib/i18n/client"
import { useIsMobile } from "@/hooks/use-mobile"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type IconType = typeof LayoutDashboard

// labelKey: مفتاح ترجمة (namespace modules أو nav) يُترجَم وقت العرض.
// module: يحكم ظهور البند حسب صلاحية المستخدم (الأدمن يرى كل شيء).
// clause: رقم بند ISO 45001 يُعرَض بجانب العنوان (لأبناء التدقيق).
// adminOnly: بند لا يظهر إلا للأدمن مهما كانت صلاحية الوحدة (إدارة المستخدمين/الصلاحيات).
type NavLeaf = {
  kind?: "leaf"
  href: string
  labelKey: string
  icon: IconType
  module: ModuleKey
  clause?: string
  adminOnly?: boolean
}
// مجموعة فرعية داخل مجموعة رئيسية (مستوى ثالث) — «التدقيق» بكل بنود ISO تحت «الحوكمة».
type NavSubGroup = {
  kind: "subgroup"
  id: string
  labelKey: string
  icon: IconType
  module: ModuleKey
  children: NavLeaf[]
}
type NavGroupChild = NavLeaf | NavSubGroup
// مجموعة رئيسية قابلة للطي في القائمة الأساسية.
type NavGroup = {
  kind: "group"
  id: string
  labelKey: string
  icon: IconType
  children: NavGroupChild[]
}
type NavDashboard = { kind: "dashboard"; href: string; labelKey: string; icon: IconType; module: ModuleKey }
// عنصر ديناميكي يمثّل «الأقسام» — يُبنى وقت التشغيل من /api/departments/nav (لا يُكتب ثابتاً).
type NavDepartments = { kind: "departments" }
type Section = NavDashboard | NavGroup | NavDepartments

// شكل استجابة /api/departments/nav المستهلَكة في القائمة الجانبية.
type DeptNav = {
  visible: boolean
  mode: "group" | "single" | "none"
  canSeeOverview: boolean
  overdueTotal: number
  departments: { code: string; nameAr: string; open: number }[]
}

// «المعدات» مجموعة فرعية تحت «الموارد»: سجل المعدات + الفحص اليومي + ملصقات QR.
const equipmentSubGroup: NavSubGroup = {
  kind: "subgroup",
  id: "equipment",
  labelKey: "nav.equipment",
  icon: Truck,
  module: "equipment",
  children: [
    { href: "/equipment", labelKey: "nav.equipment", icon: Truck, module: "equipment" },
    { href: "/equipment/checks", labelKey: "equipChecks.title", icon: ClipboardCheck, module: "equipment" },
    { href: "/equipment/qr-labels", labelKey: "equipQr.title", icon: QrCode, module: "equipment" },
  ],
}

// «التدقيق» مجموعة فرعية (مستوى ثالث) تحت «الحوكمة»: نظرة عامة + كل بنود ISO 45001.
const auditSubGroup: NavSubGroup = {
  kind: "subgroup",
  id: "audit",
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

// القائمة الرئيسية: لوحة التحكم (رابط مباشر) + 6 مجموعات قابلة للطي (إحداها «الأقسام» الديناميكية).
const sections: Section[] = [
  { kind: "dashboard", href: "/", labelKey: "modules.dashboard", icon: LayoutDashboard, module: "dashboard" },
  {
    kind: "group",
    id: "operations",
    labelKey: "nav.groupOperations",
    icon: ClipboardCheck,
    children: [
      { href: "/patrol", labelKey: "nav.patrol", icon: Footprints, module: "patrol" },
      { href: "/inspections", labelKey: "modules.inspections", icon: ClipboardCheck, module: "inspections" },
      { href: "/ai-monitoring", labelKey: "modules.ai_monitoring", icon: Cctv, module: "ai_monitoring" },
      { href: "/permits", labelKey: "modules.permits", icon: FileSignature, module: "permits" },
    ],
  },
  {
    kind: "group",
    id: "records",
    labelKey: "nav.groupRecords",
    icon: FileWarning,
    children: [
      { href: "/incidents", labelKey: "modules.incidents", icon: AlertTriangle, module: "incidents" },
      { href: "/violations", labelKey: "modules.violations", icon: Ban, module: "violations" },
      { href: "/risks", labelKey: "modules.risks", icon: ShieldAlert, module: "risks" },
      { href: "/actions", labelKey: "modules.actions", icon: CheckSquare, module: "actions" },
    ],
  },
  { kind: "departments" },
  {
    kind: "group",
    id: "resources",
    labelKey: "nav.groupResources",
    icon: Users,
    children: [
      { href: "/employees", labelKey: "nav.employees", icon: Users, module: "employees" },
      equipmentSubGroup,
      { href: "/training", labelKey: "modules.training", icon: GraduationCap, module: "training" },
      { href: "/documents", labelKey: "modules.documents", icon: FolderKanban, module: "documents" },
      { href: "/safety-rules", labelKey: "nav.safetyRules", icon: ScrollText, module: "safety_rules" },
    ],
  },
  {
    kind: "group",
    id: "governance",
    labelKey: "nav.groupGovernance",
    icon: ShieldCheck,
    children: [auditSubGroup, { href: "/reports", labelKey: "modules.reports", icon: BarChart3, module: "reports" }],
  },
  {
    kind: "group",
    id: "system",
    labelKey: "nav.groupSystem",
    icon: Settings,
    children: [
      { href: "/settings", labelKey: "modules.settings", icon: Settings, module: "settings" },
      { href: "/admin/users", labelKey: "nav.adminUsers", icon: UserCog, module: "settings", adminOnly: true },
      { href: "/users", labelKey: "nav.users", icon: KeyRound, module: "settings", adminOnly: true },
    ],
  },
]

// يحسب المجموعة التي يجب فتحها تلقائياً عند التحميل من المسار الحالي (بلا اعتبار للصلاحيات:
// إن كانت المجموعة مخفيّة لن تُعرَض أصلاً فلا ضرر). يُستدعى مرّة واحدة كحالة أولية.
function initialOpen(pathname: string): string | null {
  if (pathname.startsWith("/departments")) return "departments"
  for (const s of sections) {
    if (s.kind !== "group") continue
    const hrefs: string[] = []
    for (const c of s.children) {
      if (c.kind === "subgroup") hrefs.push(...c.children.map((l) => l.href))
      else hrefs.push(c.href)
    }
    if (hrefs.some((h) => (h === "/" ? pathname === "/" : pathname.startsWith(h)))) return s.id
  }
  return null
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

  // إغلاق درج الجوال تلقائياً عند تغيّر المسار.
  useEffect(() => {
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // القائمة المفتوحة (أكورديون: مجموعة واحدة مفتوحة في كل مرة). الحالة الأولية فقط تُشتقّ من
  // المسار — ولا يُعاد تطبيقها بعدها كي لا يمنع المسارُ طيّ المجموعة عند الضغط عليها ثانيةً.
  const [openMenu, setOpenMenu] = useState<string | null>(() => initialOpen(pathname))
  // «التدقيق» (مستوى ثالث) له حالته المستقلّة، يُفتح تلقائياً إن كان المستخدم داخل أحد بنوده.
  const [auditOpen, setAuditOpen] = useState<boolean>(() =>
    auditSubGroup.children.some((l) => pathname.startsWith(l.href)),
  )
  // وضع الطيّ على الحاسوب (أيقونات فقط + قوائم منبثقة جانبية). لا ينطبق على الجوال.
  const [collapsed, setCollapsed] = useState(false)
  // أي قائمة منبثقة مفتوحة في وضع الطيّ (id المجموعة أو "departments").
  const [flyout, setFlyout] = useState<string | null>(null)

  const iconOnly = collapsed && !isMobile

  const canSee = (module: ModuleKey) => hasModuleAccess(user?.role, user?.permissions, module)
  // لوحة التحكم دائماً ظاهرة كي لا يُقفَل أي مستخدم خارج النظام.
  const alwaysOn: ModuleKey[] = ["dashboard"]
  const canSeeLeaf = (leaf: NavLeaf) =>
    leaf.adminOnly ? user?.role === "admin" : alwaysOn.includes(leaf.module) || canSee(leaf.module)
  const visibleSubChildren = (sg: NavSubGroup) => sg.children.filter(canSeeLeaf)
  const visibleGroupChildren = (g: NavGroup): NavGroupChild[] =>
    g.children.filter((c) => (c.kind === "subgroup" ? visibleSubChildren(c).length > 0 : canSeeLeaf(c)))

  const isLeafActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))
  const groupHasActive = (g: NavGroup) =>
    visibleGroupChildren(g).some((c) =>
      c.kind === "subgroup" ? visibleSubChildren(c).some((l) => isLeafActive(l.href)) : isLeafActive(c.href),
    )

  // بيانات «الأقسام» للقائمة: الأقسام المرئية للمستخدم وعدّاداتها ومجموع المتأخرات.
  const { data: deptNav } = useSWR<DeptNav>("/api/departments/nav", fetcher, { refreshInterval: 30000 })

  // المجموعات الظاهرة: تُخفى المجموعة إن لم يملك المستخدم صلاحية أي بند تحتها.
  const visibleSections = sections.filter((s) => {
    if (s.kind === "dashboard") return true
    if (s.kind === "departments") return true // يُحسم عميلياً حسب deptNav.visible
    return visibleGroupChildren(s).length > 0
  })

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  const closeFlyout = () => {
    setFlyout(null)
    onClose()
  }

  // ── بند فرعي (رابط) مشترك بين الوضعين ──
  function renderLeaf(leaf: NavLeaf, onNavigate?: () => void) {
    const active = isLeafActive(leaf.href)
    const Icon = leaf.icon
    return (
      <li key={leaf.href}>
        <Link
          href={leaf.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            active
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
          )}
        >
          <Icon className="size-4 shrink-0" />
          <span className="flex-1">{t(leaf.labelKey)}</span>
          {leaf.clause && (
            <span
              className={cn("font-mono text-xs", active ? "text-sidebar-primary-foreground/70" : "text-sidebar-foreground/40")}
              dir="ltr"
            >
              {leaf.clause}
            </span>
          )}
        </Link>
      </li>
    )
  }

  // ── مجموعة «التدقيق» الفرعية (مستوى ثالث) داخل «الحوكمة» في الوضع الموسّع ──
  function renderAuditSubGroup(sg: NavSubGroup) {
    const SgIcon = sg.icon
    const active = visibleSubChildren(sg).some((l) => isLeafActive(l.href))
    return (
      <li key={sg.id}>
        <button
          type="button"
          onClick={() => setAuditOpen((o) => !o)}
          aria-expanded={auditOpen}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            active ? "text-sidebar-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
          )}
        >
          <SgIcon className="size-4 shrink-0" />
          <span className="flex-1 text-start">{t(sg.labelKey)}</span>
          <ChevronDown
            className={cn("size-4 shrink-0 transition-transform", auditOpen ? "rotate-180" : "rotate-0")}
            aria-label={auditOpen ? t("nav.collapseGroup") : t("nav.expandGroup")}
          />
        </button>
        {auditOpen && (
          <ul className="mt-1 flex flex-col gap-1 border-e border-sidebar-border pe-3 me-3">
            {visibleSubChildren(sg).map((l) => renderLeaf(l, onClose))}
          </ul>
        )}
      </li>
    )
  }

  // ── محتوى «الأقسام» المشترك (قائمة أقسام ديناميكية + نظرة عامة) ──
  function renderDepartmentChildren(onNavigate?: () => void) {
    if (!deptNav) return null
    return (
      <>
        {deptNav.departments.map((d) => {
          const href = `/departments/${d.code}`
          const childActive = pathname === href
          return (
            <li key={d.code}>
              <Link
                href={href}
                onClick={onNavigate}
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
                      childActive ? "bg-sidebar-primary-foreground text-sidebar-primary" : "bg-primary text-primary-foreground",
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
              onClick={onNavigate}
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
      </>
    )
  }

  // ════════════ الوضع الموسّع ════════════
  function renderExpanded() {
    return visibleSections.map((s) => {
      if (s.kind === "dashboard") {
        const active = pathname === "/"
        const Icon = s.icon
        return (
          <li key="dashboard">
            <Link
              href={s.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="flex-1">{t(s.labelKey)}</span>
            </Link>
          </li>
        )
      }

      if (s.kind === "departments") {
        if (!deptNav?.visible) return null
        // مستخدم عادي مرتبط بقسم واحد: بند مباشر «واردي» بلا قائمة فرعية.
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
                      active ? "bg-sidebar-primary-foreground text-sidebar-primary" : "bg-primary text-primary-foreground",
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
        // مدير/مسؤول: مجموعة قابلة للطي. الشارة الحمراء = مجموع المتأخرات في كل الأقسام المرئية.
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
            {renderDepartmentChildren(onClose)}
          </CollapsibleNavGroup>
        )
      }

      // مجموعة رئيسية عادية.
      const kids = visibleGroupChildren(s)
      return (
        <CollapsibleNavGroup
          key={s.id}
          icon={s.icon}
          label={t(s.labelKey)}
          isOpen={openMenu === s.id}
          onToggle={() => setOpenMenu((prev) => (prev === s.id ? null : s.id))}
          active={groupHasActive(s)}
          t={t}
        >
          {kids.map((c) => (c.kind === "subgroup" ? renderAuditSubGroup(c) : renderLeaf(c, onClose)))}
        </CollapsibleNavGroup>
      )
    })
  }

  // ════════════ الوضع المطويّ (أيقونات + قوائم منبثقة) ════════════
  function renderCollapsed() {
    return visibleSections.map((s) => {
      if (s.kind === "dashboard") {
        const active = pathname === "/"
        const Icon = s.icon
        return (
          <li key="dashboard">
            <Link
              href={s.href}
              onClick={onClose}
              title={t(s.labelKey)}
              aria-label={t(s.labelKey)}
              className={cn(
                "flex items-center justify-center rounded-lg p-2.5 transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-5 shrink-0" />
            </Link>
          </li>
        )
      }

      if (s.kind === "departments") {
        if (!deptNav?.visible) return null
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
                title={t("nav.myInbox")}
                aria-label={t("nav.myInbox")}
                className={cn(
                  "relative flex items-center justify-center rounded-lg p-2.5 transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Inbox className="size-5 shrink-0" />
                {d.open > 0 && <span className="absolute end-1 top-1 size-2 rounded-full bg-primary" />}
              </Link>
            </li>
          )
        }
        return renderFlyout("departments", Building2, t("nav.departments"), deptNav.overdueTotal, pathname.startsWith("/departments"), (
          <ul className="flex flex-col gap-1">{renderDepartmentChildren(closeFlyout)}</ul>
        ))
      }

      const kids = visibleGroupChildren(s)
      return renderFlyout(
        s.id,
        s.icon,
        t(s.labelKey),
        0,
        groupHasActive(s),
        <ul className="flex flex-col gap-1">
          {kids.map((c) =>
            c.kind === "subgroup" ? (
              <li key={c.id}>
                <div className="px-3 pb-1 pt-1 text-xs font-semibold text-sidebar-foreground/50">{t(c.labelKey)}</div>
                <ul className="flex flex-col gap-1">{visibleSubChildren(c).map((l) => renderLeaf(l, closeFlyout))}</ul>
              </li>
            ) : (
              renderLeaf(c, closeFlyout)
            ),
          )}
        </ul>,
      )
    })
  }

  // قائمة منبثقة جانبية لمجموعة في الوضع المطويّ.
  function renderFlyout(id: string, Icon: IconType, label: string, badge: number, active: boolean, content: ReactNode) {
    return (
      <li key={id}>
        <Popover open={flyout === id} onOpenChange={(o) => setFlyout(o ? id : null)}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title={label}
              aria-label={label}
              className={cn(
                "relative flex w-full items-center justify-center rounded-lg p-2.5 transition-colors",
                active ? "bg-sidebar-primary/20 text-sidebar-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-5 shrink-0" />
              {badge > 0 && (
                <span
                  className="absolute -end-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
                  aria-label={`${badge}`}
                >
                  {badge}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="left"
            align="start"
            sideOffset={8}
            className="w-60 border-sidebar-border bg-sidebar p-2 text-sidebar-foreground"
          >
            <div className="mb-1 px-3 py-1 text-sm font-bold">{label}</div>
            {content}
          </PopoverContent>
        </Popover>
      </li>
    )
  }

  const inner = (
    <>
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border py-4",
          iconOnly ? "flex-col gap-3 px-2" : "justify-between gap-2 px-5",
        )}
      >
        <div className="flex items-center gap-3">
          <RaqeebMark className="size-10 shrink-0 rounded-lg bg-white" />
          {!iconOnly && (
            <div className="flex flex-col">
              <span className="text-lg font-extrabold leading-tight">رقيب</span>
              <span className="text-xs text-sidebar-foreground/60">{t("nav.brandSubtitle")}</span>
            </div>
          )}
        </div>
        {isMobile ? (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent"
            aria-label={t("common.close")}
          >
            <X className="size-5" />
          </button>
        ) : (
          <button
            onClick={() => {
              setCollapsed((c) => !c)
              setFlyout(null)
            }}
            title={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
            aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
            className="rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
          >
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className={cn("flex flex-col gap-1", iconOnly ? "px-2" : "px-3")}>
          {iconOnly ? renderCollapsed() : renderExpanded()}
        </ul>
      </nav>

      <div className={cn("border-t border-sidebar-border py-4", iconOnly ? "px-2" : "px-3")}>
        {iconOnly ? (
          <div className="flex flex-col items-center gap-3">
            <div
              title={user.name}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground"
            >
              {initials(user.name)}
            </div>
            <button
              onClick={handleSignOut}
              title={t("common.logout")}
              aria-label={t("common.logout")}
              className="rounded-lg p-2 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut className="size-5 shrink-0" />
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </>
  )

  // الجوال: درج منزلق من اليمين (RTL) عبر Sheet — دائماً بالوضع الموسّع.
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

  // الحاسوب: قائمة ثابتة بكامل ارتفاع الشاشة، عرضها يتبدّل بين الموسّع (w-72) والمطويّ (w-16).
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
        iconOnly ? "w-16" : "w-72",
      )}
    >
      {inner}
    </aside>
  )
}

// مكوّن القائمة القابلة للطي — مشترك بين كل المجموعات الرئيسية. النقر على البند الأب يستدعي
// onToggle الذي يبدّل الحالة (open ⇄ close) لا أن يفتح فقط، فيصحّ الانطواء. الشارة الحمراء
// (badgeCount) تظهر على الأب حتى وهو مطويّ.
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
  icon: IconType
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
          active ? "text-sidebar-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
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
      {isOpen && <ul className="mt-1 flex flex-col gap-1 border-e border-sidebar-border pe-3 me-4">{children}</ul>}
    </li>
  )
}
