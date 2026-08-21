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
          {t("usersManager.addUser")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("usersManager.addUserTitle")}</DialogTitle>
          <DialogDescription>{t("usersManager.addUserDesc")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cu-name">{t("usersManager.nameLabel")}</Label>
            <Input id="cu-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("usersManager.namePlaceholder")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cu-email">{t("usersManager.emailLabel")}</Label>
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
            <Label htmlFor="cu-password">{t("usersManager.passwordLabel")}</Label>
            <Input
              id="cu-password"
              type="text"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("usersManager.passwordPlaceholder")}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("usersManager.departmentLabel")}</Label>
            <DepartmentSelect value={department} onChange={setDepartment} />
          </div>
          <div className="grid gap-2">
            <Label>{t("usersManager.roleLabel")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "manager" | "user")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">{t("usersManager.roleAdmin")}</SelectItem>
                <SelectItem value="manager">{t("usersManager.roleManager")}</SelectItem>
                <SelectItem value="user">{t("usersManager.roleUser")}</SelectItem>
              </SelectContent>
            </Select>
            {role === "admin" && (
              <p className="text-xs text-muted-foreground">{t("usersManager.adminAllAccess")}</p>
            )}
          </div>

          {role !== "admin" && (
            <div className="grid gap-2">
              <Label>{t("usersManager.allowedPages")}</Label>
              <PermissionsEditor value={perms} onChange={setPerms} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            {t("usersManager.cancel")}
          </Button>
          <Button onClick={submit} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {t("usersManager.createAccount")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PermissionsDialog({ user }: { user: UserRow }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [department, setDepartment] = useState(user.department || "")
  const [perms, setPerms] = useState<string[]>(() => parsePermissions(user.permissions))
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      await updateUserPermissions(user.id, department, perms)
      toast({ title: t("usersManager.permsSaved"), description: t("usersManager.permsSavedDesc").replace("{name}", user.name) })
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
          {t("usersManager.permissions")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("usersManager.permsDialogTitle").replace("{name}", user.name)}</DialogTitle>
          <DialogDescription>{t("usersManager.permsDialogDesc")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label>{t("usersManager.departmentLabel")}</Label>
            <DepartmentSelect value={department} onChange={setDepartment} />
          </div>
          <div className="grid gap-2">
            <Label>{t("usersManager.allowedPages")}</Label>
            <PermissionsEditor value={perms} onChange={setPerms} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            {t("usersManager.cancel")}
          </Button>
          <Button onClick={save} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {t("usersManager.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PermissionsSummary({ user }: { user: UserRow }) {
  const { t } = useI18n()
  if (user.role === "admin") {
    return <span className="text-xs font-medium text-primary">{t("usersManager.allPermissions")}</span>
  }
  const mods = parsePermissions(user.permissions)
  if (mods.length === 0) {
    return <span className="text-xs text-muted-foreground">{t("usersManager.noPermissions")}</span>
  }
  const shown = mods.slice(0, 3).map((m) => moduleLabel(t, m))
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
  const { t } = useI18n()
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
          {users.length} {users.length === 1 ? t("usersManager.userCountOne") : t("usersManager.userCountMany")} {t("usersManager.inSystem")}
        </p>
        <CreateUserDialog />
      </div>

      {pending.length > 0 && (
        <Card className="border-accent/40 bg-accent/5 p-4">
          <p className="text-sm font-medium text-foreground">
            {pending.length === 1
              ? t("usersManager.onePending")
              : t("usersManager.manyPending").replace("{count}", String(pending.length))}
          </p>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("usersManager.colName")}</th>
                <th className="px-4 py-3 font-medium">{t("usersManager.colEmail")}</th>
                <th className="px-4 py-3 font-medium">{t("usersManager.colDepartment")}</th>
                <th className="px-4 py-3 font-medium">{t("usersManager.colPermissions")}</th>
                <th className="px-4 py-3 font-medium">{t("usersManager.colStatus")}</th>
                <th className="px-4 py-3 font-medium">{t("usersManager.colRole")}</th>
                <th className="px-4 py-3 font-medium text-center">{t("usersManager.colActions")}</th>
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
                        {isSelf && <span className="text-xs text-muted-foreground">{t("usersManager.you")}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground" dir="ltr">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {u.department ? departmentLabel(t, u.department) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <PermissionsSummary user={u} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[u.status] ?? ""}`}
                      >
                        {statusLabelKeys[u.status] ? t(statusLabelKeys[u.status]) : u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                          <UserCog className="size-4 text-muted-foreground" />
                          {roleLabelKeys[u.role] ? t(roleLabelKeys[u.role]) : u.role}
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
                            {t("usersManager.approve")}
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
                            {t("usersManager.reject")}
                          </Button>
                        )}
                        {!isSelf && (
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => run(u.id, () => deleteUser(u.id))}
                            aria-label={t("usersManager.deleteUser")}
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
