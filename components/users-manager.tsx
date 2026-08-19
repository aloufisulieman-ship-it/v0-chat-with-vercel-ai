"use client"

import { useState, useTransition } from "react"
import { Check, X, Trash2, ShieldCheck, UserCog, UserPlus, SlidersHorizontal, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { PermissionsEditor } from "@/components/permissions-editor"
import {
  approveUser,
  rejectUser,
  setUserRole,
  deleteUser,
  createUser,
  updateUserPermissions,
} from "@/app/actions/users"
import { parsePermissions } from "@/lib/permissions"
import { departmentOptions } from "@/lib/labels"
import { toast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n/client"
import { departmentLabel, moduleLabel } from "@/lib/i18n/labels"

type UserRow = {
  id: string
  name: string
  email: string
  role: string
  status: string
  department: string
  permissions: string
  createdAt: Date
}

const statusStyles: Record<string, string> = {
  approved: "bg-primary/15 text-primary",
  pending: "bg-accent/15 text-accent",
  rejected: "bg-destructive/15 text-destructive",
}

const roleLabelKeys: Record<string, string> = {
  admin: "usersManager.roleAdmin",
  manager: "usersManager.roleManager",
  user: "usersManager.roleUser",
}

const statusLabelKeys: Record<string, string> = {
  approved: "usersManager.statusApproved",
  pending: "usersManager.statusPending",
  rejected: "usersManager.statusRejected",
}

function RoleSelect({
  userId,
  role,
  disabled,
  onChange,
}: {
  userId: string
  role: string
  disabled: boolean
  onChange: (id: string, role: "admin" | "manager" | "user") => void
}) {
  const { t } = useI18n()
  return (
    <Select value={role} disabled={disabled} onValueChange={(v) => onChange(userId, v as "admin" | "manager" | "user")}>
      <SelectTrigger className="h-9 w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">{t("usersManager.roleAdmin")}</SelectItem>
        <SelectItem value="manager">{t("usersManager.roleManager")}</SelectItem>
        <SelectItem value="user">{t("usersManager.roleUser")}</SelectItem>
      </SelectContent>
    </Select>
  )
}

function DepartmentSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { t } = useI18n()
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={t("usersManager.selectDepartment")} />
      </SelectTrigger>
      <SelectContent>
        {departmentOptions.map((d) => (
          <SelectItem key={d.value} value={d.value}>
            {departmentLabel(t, d.value)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function CreateUserDialog() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"admin" | "manager" | "user">("user")
  const [department, setDepartment] = useState("")
  const [perms, setPerms] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  function reset() {
    setName("")
    setEmail("")
    setPassword("")
    setRole("user")
    setDepartment("")
    setPerms([])
  }

  function submit() {
    startTransition(async () => {
      const res = await createUser({ name, email, password, role, department, permissions: perms })
      if (res.error) {
        toast({ title: t("usersManager.createFailed"), description: res.error, variant: "destructive" })
        return
      }
      toast({ title: t("usersManager.createdTitle"), description: t("usersManager.createdDesc").replace("{name}", name) })
      reset()
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="size-4" />
          إضافة مستخدم
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>إضافة مستخدم جديد</DialogTitle>
          <DialogDescription>أنشئ حساباً وحدّد قسمه والصفحات المسموح له بالوصول إليها.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cu-name">الاسم</Label>
            <Input id="cu-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: محمد أحمد" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cu-email">البريد الإلكتروني</Label>
            <Input
              id="cu-email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cu-password">كلمة المرور</Label>
            <Input
              id="cu-password"
              type="text"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 أحرف على الأقل"
            />
          </div>
          <div className="grid gap-2">
            <Label>القسم</Label>
            <DepartmentSelect value={department} onChange={setDepartment} />
          </div>
          <div className="grid gap-2">
            <Label>الدور</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "manager" | "user")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">مدير النظام</SelectItem>
                <SelectItem value="manager">مدير</SelectItem>
                <SelectItem value="user">مستخدم</SelectItem>
              </SelectContent>
            </Select>
            {role === "admin" && (
              <p className="text-xs text-muted-foreground">مدير النظام يملك صلاحية كاملة على جميع الصفحات.</p>
            )}
          </div>

          {role !== "admin" && (
            <div className="grid gap-2">
              <Label>الصفحات المسموح بها</Label>
              <PermissionsEditor value={perms} onChange={setPerms} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="size-4 animate-spin" />}
            إنشاء الحساب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PermissionsDialog({ user }: { user: UserRow }) {
  const [open, setOpen] = useState(false)
  const [department, setDepartment] = useState(user.department || "")
  const [perms, setPerms] = useState<string[]>(() => parsePermissions(user.permissions))
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      await updateUserPermissions(user.id, department, perms)
      toast({ title: "تم حفظ الصلاحيات", description: `تم تحديث صلاحيات ${user.name}.` })
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setDepartment(user.department || "")
          setPerms(parsePermissions(user.permissions))
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 bg-transparent">
          <SlidersHorizontal className="size-4" />
          الصلاحيات
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>صلاحيات {user.name}</DialogTitle>
          <DialogDescription>حدّد القسم والصفحات التي يمكن لهذا المستخدم الوصول إليها.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label>القسم</Label>
            <DepartmentSelect value={department} onChange={setDepartment} />
          </div>
          <div className="grid gap-2">
            <Label>الصفحات المسموح بها</Label>
            <PermissionsEditor value={perms} onChange={setPerms} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            إلغاء
          </Button>
          <Button onClick={save} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="size-4 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PermissionsSummary({ user }: { user: UserRow }) {
  if (user.role === "admin") {
    return <span className="text-xs font-medium text-primary">كل الصلاحيات</span>
  }
  const mods = parsePermissions(user.permissions)
  if (mods.length === 0) {
    return <span className="text-xs text-muted-foreground">لا توجد صلاحيات</span>
  }
  const shown = mods.slice(0, 3).map((m) => moduleLabels[m] ?? m)
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((label) => (
        <span key={label} className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
          {label}
        </span>
      ))}
      {mods.length > 3 && (
        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          +{mods.length - 3}
        </span>
      )}
    </div>
  )
}

export function UsersManager({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function run(id: string, fn: () => Promise<void>) {
    setBusyId(id)
    startTransition(async () => {
      await fn()
      setBusyId(null)
    })
  }

  const pending = users.filter((u) => u.status === "pending")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {users.length} {users.length === 1 ? "مستخدم" : "مستخدمين"} في النظام
        </p>
        <CreateUserDialog />
      </div>

      {pending.length > 0 && (
        <Card className="border-accent/40 bg-accent/5 p-4">
          <p className="text-sm font-medium text-foreground">
            {pending.length === 1
              ? "يوجد طلب وصول واحد بانتظار موافقتك."
              : `يوجد ${pending.length} طلبات وصول بانتظار موافقتك.`}
          </p>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">الاسم</th>
                <th className="px-4 py-3 font-medium">البريد</th>
                <th className="px-4 py-3 font-medium">القسم</th>
                <th className="px-4 py-3 font-medium">الصلاحيات</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">الدور</th>
                <th className="px-4 py-3 font-medium text-center">ال��جراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => {
                const isSelf = u.id === currentUserId
                const busy = busyId === u.id && isPending
                return (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        {u.role === "admin" && <ShieldCheck className="size-4 text-primary" />}
                        {u.name}
                        {isSelf && <span className="text-xs text-muted-foreground">(أنت)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground" dir="ltr">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {u.department ? departmentLabels[u.department] ?? u.department : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <PermissionsSummary user={u} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[u.status] ?? ""}`}
                      >
                        {statusLabels[u.status] ?? u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                          <UserCog className="size-4 text-muted-foreground" />
                          {roleLabels[u.role] ?? u.role}
                        </span>
                      ) : (
                        <RoleSelect
                          userId={u.id}
                          role={u.role}
                          disabled={busy}
                          onChange={(id, role) => run(id, () => setUserRole(id, role))}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {!isSelf && u.role !== "admin" && <PermissionsDialog user={u} />}
                        {u.status === "pending" && (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => run(u.id, () => approveUser(u.id))}
                            className="gap-1"
                          >
                            <Check className="size-4" />
                            موافقة
                          </Button>
                        )}
                        {!isSelf && u.status !== "rejected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => run(u.id, () => rejectUser(u.id))}
                            className="gap-1"
                          >
                            <X className="size-4" />
                            رفض
                          </Button>
                        )}
                        {!isSelf && (
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => run(u.id, () => deleteUser(u.id))}
                            aria-label="حذف المستخدم"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
