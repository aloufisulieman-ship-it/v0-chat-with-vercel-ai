"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { KeyRound, LogOut, MoreHorizontal, Search, ShieldCheck, ShieldOff, Ban, UserCog, Users, ScrollText, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { AdminUserRow, AuditRow } from "@/app/actions/admin-users"
import { resetUserPassword, revokeUserSessions, setAccountStatus, setUserRole } from "@/app/actions/admin-users"
import { ACCOUNT_STATUS_UI, ASSIGNABLE_ROLES, AUDIT_ACTION_LABELS, ROLE_DEFINITIONS, type AccountStatus } from "@/lib/roles"
import { moduleOptions, parsePermissions } from "@/lib/permissions"

type Loc = "ar" | "en"

const STATUS_TONE: Record<string, string> = {
  active: "bg-primary/10 text-primary border-primary/20",
  suspended: "bg-accent/15 text-accent-foreground border-accent/30",
  banned: "bg-destructive/10 text-destructive border-destructive/20",
}

const ROLE_TONE: Record<string, string> = {
  platform_admin: "bg-foreground text-background",
  admin: "bg-primary text-primary-foreground",
  manager: "bg-secondary text-secondary-foreground",
  user: "bg-muted text-muted-foreground",
}

function fmt(d: Date | string | null | undefined, loc: Loc) {
  if (!d) return "—"
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleString(loc === "en" ? "en-GB" : "ar-SA", { dateStyle: "medium", timeStyle: "short" })
}

function shortDevice(ua: string) {
  if (!ua) return ""
  if (/iPhone|iPad/.test(ua)) return "iOS"
  if (/Android/.test(ua)) return "Android"
  if (/Windows/.test(ua)) return "Windows"
  if (/Mac OS/.test(ua)) return "macOS"
  if (/Linux/.test(ua)) return "Linux"
  return ""
}

export function AdminUsersManager({
  users,
  audit,
  currentUserId,
  locale,
}: {
  users: AdminUserRow[]
  audit: AuditRow[]
  currentUserId: string
  locale: Loc
}) {
  const en = locale === "en"
  const [q, setQ] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false
      if (statusFilter !== "all" && u.accountStatus !== statusFilter) return false
      if (needle && !`${u.name} ${u.email} ${u.department}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [users, q, roleFilter, statusFilter])

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.accountStatus === "active").length,
      suspended: users.filter((u) => u.accountStatus === "suspended").length,
      banned: users.filter((u) => u.accountStatus === "banned").length,
      admins: users.filter((u) => u.role === "admin").length,
    }),
    [users],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label={en ? "Total" : "الإجمالي"} value={counts.total} icon={Users} />
        <Stat label={en ? "Active" : "مفعّل"} value={counts.active} icon={ShieldCheck} tone="primary" />
        <Stat label={en ? "Suspended" : "موقوف"} value={counts.suspended} icon={ShieldOff} tone="accent" />
        <Stat label={en ? "Banned" : "محظور"} value={counts.banned} icon={Ban} tone="destructive" />
        <Stat label={en ? "Admins" : "مدراء"} value={counts.admins} icon={UserCog} />
      </div>

      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-grid">
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="size-4" aria-hidden /> {en ? "Users" : "المستخدمون"}
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <ScrollText className="size-4" aria-hidden /> {en ? "Audit log" : "سجل التدقيق"}
            {audit.length > 0 && <span className="ms-1 rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{audit.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <BookOpen className="size-4" aria-hidden /> {en ? "Roles guide" : "دليل الأدوار"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={en ? "Search name, email, department…" : "ابحث بالاسم أو البريد أو القسم…"}
                className="ps-9"
                aria-label={en ? "Search users" : "بحث في المستخدمين"}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="md:w-44" aria-label={en ? "Filter by role" : "تصفية حسب الدور"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{en ? "All roles" : "كل الأدوار"}</SelectItem>
                {ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_DEFINITIONS[r].label[locale]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-44" aria-label={en ? "Filter by status" : "تصفية حسب الحالة"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{en ? "All statuses" : "كل الحالات"}</SelectItem>
                {(Object.keys(ACCOUNT_STATUS_UI) as AccountStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{ACCOUNT_STATUS_UI[s].label[locale]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild variant="outline" className="bg-transparent">
              <Link href="/users">{en ? "Permissions & approvals" : "الصلاحيات والاعتماد"}</Link>
            </Button>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr className="text-start [&>th]:px-4 [&>th]:py-3 [&>th]:text-start [&>th]:font-medium">
                    <th>{en ? "User" : "المستخدم"}</th>
                    <th>{en ? "Role" : "الدور"}</th>
                    <th>{en ? "Modules" : "الوحدات"}</th>
                    <th>{en ? "Account" : "الحساب"}</th>
                    <th>{en ? "Last login" : "آخر دخول"}</th>
                    <th>{en ? "Created" : "تاريخ الإنشاء"}</th>
                    <th className="w-12"><span className="sr-only">{en ? "Actions" : "إجراءات"}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        {en ? "No users match the filters." : "لا يوجد مستخدمون مطابقون."}
                      </td>
                    </tr>
                  )}
                  {filtered.map((u) => (
                    <UserRow key={u.id} u={u} self={u.id === currentUserId} locale={locale} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditTable rows={audit} locale={locale} />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <RolesGuide locale={locale} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  tone?: "primary" | "accent" | "destructive"
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          tone === "primary" && "bg-primary/10 text-primary",
          tone === "accent" && "bg-accent/15 text-accent-foreground",
          tone === "destructive" && "bg-destructive/10 text-destructive",
          !tone && "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
      </div>
    </Card>
  )
}

function UserRow({ u, self, locale }: { u: AdminUserRow; self: boolean; locale: Loc }) {
  const en = locale === "en"
  const [pending, start] = useTransition()
  const [dialog, setDialog] = useState<null | "password" | "suspend" | "ban">(null)
  // نحسب فقط المفاتيح المعروفة حالياً (قد تحوي القيمة المخزّنة مفاتيح وحدات قديمة).
  const validKeys = new Set<string>(moduleOptions.map((m) => m.value))
  const modules =
    u.role === "admin" || u.role === "manager"
      ? null
      : parsePermissions(u.permissions).filter((k) => validKeys.has(k)).length
  const statusUi = ACCOUNT_STATUS_UI[(u.accountStatus as AccountStatus) ?? "active"] ?? ACCOUNT_STATUS_UI.active

  const run = (fn: () => Promise<{ success?: true; error?: string }>, okMsg: string) =>
    start(async () => {
      const r = await fn()
      if (r.error) toast.error(r.error)
      else toast.success(okMsg)
    })

  return (
    <>
      <tr className={cn("[&>td]:px-4 [&>td]:py-3 [&>td]:align-middle", pending && "opacity-60")}>
        <td>
          <div className="flex flex-col">
            <span className="font-medium text-foreground">
              {u.name}
              {self && <span className="ms-2 text-xs text-muted-foreground">({en ? "you" : "أنت"})</span>}
            </span>
            <span className="text-xs text-muted-foreground" dir="ltr">{u.email}</span>
            {u.department && <span className="text-xs text-muted-foreground">{u.department}</span>}
          </div>
        </td>
        <td>
          {self ? (
            <Badge className={ROLE_TONE[u.role]}>{ROLE_DEFINITIONS[u.role as keyof typeof ROLE_DEFINITIONS]?.label[locale] ?? u.role}</Badge>
          ) : (
            <Select
              value={u.role}
              disabled={pending}
              onValueChange={(v) => run(() => setUserRole(u.id, v), en ? "Role updated" : "تم تحديث الدور")}
            >
              <SelectTrigger className="h-8 w-32" aria-label={en ? "Change role" : "تغيير الدور"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_DEFINITIONS[r].label[locale]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </td>
        <td className="text-muted-foreground">
          {modules === null ? (en ? "All" : "الكل") : `${modules} / ${validKeys.size}`}
        </td>
        <td>
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className={cn("w-fit", STATUS_TONE[u.accountStatus])}>{statusUi.label[locale]}</Badge>
            {u.status !== "approved" && (
              <span className="text-[11px] text-muted-foreground">{en ? "Pending approval" : "بانتظار الاعتماد"}</span>
            )}
          </div>
        </td>
        <td>
          <div className="flex flex-col">
            <span className="text-foreground tabular-nums">{fmt(u.lastLoginAt, locale)}</span>
            <span className="text-xs text-muted-foreground">
              {[shortDevice(u.lastLoginDevice), u.activeSessions > 0 ? (en ? `${u.activeSessions} active session(s)` : `${u.activeSessions} جلسة نشطة`) : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        </td>
        <td className="text-muted-foreground tabular-nums">{fmt(u.createdAt, locale)}</td>
        <td>
          {!self && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label={en ? "User actions" : "إجراءات المستخدم"}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate text-xs" dir="ltr">{u.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {u.accountStatus !== "active" ? (
                  <DropdownMenuItem onClick={() => run(() => setAccountStatus(u.id, "active"), en ? "Account activated" : "تم تفعيل الحساب")}>
                    <ShieldCheck className="size-4" /> {en ? "Activate" : "تفعيل الحساب"}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setDialog("suspend")}>
                    <ShieldOff className="size-4" /> {en ? "Suspend" : "إيقاف مؤقت"}
                  </DropdownMenuItem>
                )}
                {u.accountStatus !== "banned" && (
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDialog("ban")}>
                    <Ban className="size-4" /> {en ? "Ban permanently" : "حظر نهائي"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDialog("password")}>
                  <KeyRound className="size-4" /> {en ? "Reset password" : "إعادة تعيين كلمة المرور"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={u.activeSessions === 0}
                  onClick={() => run(() => revokeUserSessions(u.id), en ? "Sessions revoked" : "تم إنهاء الجلسات")}
                >
                  <LogOut className="size-4" /> {en ? "Sign out everywhere" : "إنهاء كل الجلسات"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </td>
      </tr>

      {dialog === "password" && (
        <PasswordDialog user={u} locale={locale} onClose={() => setDialog(null)} />
      )}
      {(dialog === "suspend" || dialog === "ban") && (
        <StatusDialog user={u} status={dialog === "ban" ? "banned" : "suspended"} locale={locale} onClose={() => setDialog(null)} />
      )}
    </>
  )
}

function PasswordDialog({ user, locale, onClose }: { user: AdminUserRow; locale: Loc; onClose: () => void }) {
  const en = locale === "en"
  const [pw, setPw] = useState("")
  const [pw2, setPw2] = useState("")
  const [pending, start] = useTransition()
  const mismatch = pw2.length > 0 && pw !== pw2
  const valid = pw.length >= 8 && pw === pw2

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{en ? "Reset password" : "إعادة تعيين كلمة المرور"}</DialogTitle>
          <DialogDescription dir="ltr" className="text-start">{user.email}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`pw-${user.id}`}>{en ? "New password (min 8)" : "كلمة المرور الجديدة (8 أحرف على الأقل)"}</Label>
            <Input id={`pw-${user.id}`} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`pw2-${user.id}`}>{en ? "Confirm" : "تأكيد كلمة المرور"}</Label>
            <Input id={`pw2-${user.id}`} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" aria-invalid={mismatch} />
            {mismatch && <p className="text-xs text-destructive">{en ? "Passwords do not match" : "كلمتا المرور غير متطابقتين"}</p>}
          </div>
          <p className="text-xs text-muted-foreground">
            {en ? "All active sessions of this user will be signed out." : "سيتم إنهاء كل جلسات هذا المستخدم النشطة."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" className="bg-transparent" onClick={onClose} disabled={pending}>{en ? "Cancel" : "إلغاء"}</Button>
          <Button
            disabled={!valid || pending}
            onClick={() =>
              start(async () => {
                const r = await resetUserPassword(user.id, pw)
                if (r.error) toast.error(r.error)
                else {
                  toast.success(en ? "Password reset" : "تمت إعادة تعيين كلمة المرور")
                  onClose()
                }
              })
            }
          >
            {en ? "Reset" : "إعادة التعيين"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StatusDialog({
  user,
  status,
  locale,
  onClose,
}: {
  user: AdminUserRow
  status: "suspended" | "banned"
  locale: Loc
  onClose: () => void
}) {
  const en = locale === "en"
  const [note, setNote] = useState("")
  const [pending, start] = useTransition()
  const ban = status === "banned"

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ban ? (en ? "Ban account" : "حظر الحساب نهائياً") : (en ? "Suspend account" : "إيقاف الحساب مؤقتاً")}</DialogTitle>
          <DialogDescription className="text-start">
            {ACCOUNT_STATUS_UI[status].description[locale]} <span dir="ltr">({user.email})</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`note-${user.id}`}>{en ? "Reason (recorded in audit log)" : "السبب (يُسجَّل في سجل التدقيق)"}</Label>
          <Textarea id={`note-${user.id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" className="bg-transparent" onClick={onClose} disabled={pending}>{en ? "Cancel" : "إلغاء"}</Button>
          <Button
            variant={ban ? "destructive" : "default"}
            disabled={pending || (ban && note.trim().length < 3)}
            onClick={() =>
              start(async () => {
                const r = await setAccountStatus(user.id, status, note)
                if (r.error) toast.error(r.error)
                else {
                  toast.success(ban ? (en ? "Account banned" : "تم حظر الحساب") : (en ? "Account suspended" : "تم إيقاف الحساب"))
                  onClose()
                }
              })
            }
          >
            {ban ? (en ? "Ban" : "حظر") : (en ? "Suspend" : "إيقاف")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AuditTable({ rows, locale }: { rows: AuditRow[]; locale: Loc }) {
  const en = locale === "en"
  const val = (field: string, v: string) => {
    if (!v) return "—"
    if (field === "role") return ROLE_DEFINITIONS[v as keyof typeof ROLE_DEFINITIONS]?.label[locale] ?? v
    if (field === "account_status") return ACCOUNT_STATUS_UI[v as AccountStatus]?.label[locale] ?? v
    if (field === "permissions") return `${parsePermissions(v).length} ${en ? "modules" : "وحدة"}`
    return v
  }
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-start [&>th]:font-medium">
              <th>{en ? "When" : "الوقت"}</th>
              <th>{en ? "By" : "بواسطة"}</th>
              <th>{en ? "Action" : "الإجراء"}</th>
              <th>{en ? "Target" : "المستخدم المتأثر"}</th>
              <th>{en ? "Before → After" : "قبل ← بعد"}</th>
              <th>{en ? "Note" : "ملاحظة"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">{en ? "No changes recorded yet." : "لا توجد تغييرات مسجّلة بعد."}</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="[&>td]:px-4 [&>td]:py-2.5 [&>td]:align-top">
                <td className="whitespace-nowrap tabular-nums text-muted-foreground">{fmt(r.createdAt, locale)}</td>
                <td>
                  <div className="flex flex-col"><span className="text-foreground">{r.actorName}</span><span className="text-xs text-muted-foreground" dir="ltr">{r.actorEmail}</span></div>
                </td>
                <td><Badge variant="outline">{AUDIT_ACTION_LABELS[r.action]?.[locale] ?? r.action}</Badge></td>
                <td dir="ltr" className="text-start text-foreground">{r.targetEmail}</td>
                <td className="text-muted-foreground">
                  {r.field ? <span dir={locale === "ar" ? "rtl" : "ltr"}>{val(r.field, r.oldValue)} {"←"} <span className="text-foreground">{val(r.field, r.newValue)}</span></span> : "—"}
                </td>
                <td className="max-w-xs text-muted-foreground">{r.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function RolesGuide({ locale }: { locale: Loc }) {
  const en = locale === "en"
  const roles = ["admin", "manager", "user", "platform_admin"] as const
  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-start [&>th]:font-medium">
              <th>{en ? "Role" : "الدور"}</th>
              <th>{en ? "Access" : "نطاق الوصول"}</th>
              <th>{en ? "Description" : "الوصف"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {roles.map((r) => (
              <tr key={r} className="[&>td]:px-4 [&>td]:py-3 [&>td]:align-top">
                <td><Badge className={ROLE_TONE[r]}>{ROLE_DEFINITIONS[r].label[locale]}</Badge></td>
                <td className="whitespace-nowrap text-foreground">{ROLE_DEFINITIONS[r].access[locale]}</td>
                <td className="text-muted-foreground text-pretty">{ROLE_DEFINITIONS[r].description[locale]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-start [&>th]:font-medium">
              <th>{en ? "Account status" : "حالة الحساب"}</th>
              <th>{en ? "Effect" : "الأثر"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(Object.keys(ACCOUNT_STATUS_UI) as AccountStatus[]).map((s) => (
              <tr key={s} className="[&>td]:px-4 [&>td]:py-3 [&>td]:align-top">
                <td><Badge variant="outline" className={STATUS_TONE[s]}>{ACCOUNT_STATUS_UI[s].label[locale]}</Badge></td>
                <td className="text-muted-foreground text-pretty">{ACCOUNT_STATUS_UI[s].description[locale]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground text-pretty">
        {en
          ? "Enforcement is server-side: sign-in is refused for suspended/banned accounts before a session is created, existing sessions are revoked immediately, and every page guard redirects blocked accounts to /suspended."
          : "التطبيق على مستوى الخادم: يُرفض تسجيل دخول الحساب الموقوف/المحظور قبل إنشاء الجلسة، وتُنهى الجلسات القائمة فوراً، وكل حارس صفحة يوجّه الحساب المحجوب إلى /suspended."}
      </p>
    </div>
  )
}
