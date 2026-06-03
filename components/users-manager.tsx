"use client"

import { useState, useTransition } from "react"
import { Check, X, Trash2, ShieldCheck, UserCog } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { approveUser, rejectUser, setUserRole, deleteUser } from "@/app/actions/users"

type UserRow = {
  id: string
  name: string
  email: string
  role: string
  status: string
  createdAt: Date
}

const roleLabels: Record<string, string> = {
  admin: "مدير النظام",
  manager: "مدير",
  user: "مستخدم",
}

const statusStyles: Record<string, string> = {
  approved: "bg-primary/15 text-primary",
  pending: "bg-accent/15 text-accent",
  rejected: "bg-destructive/15 text-destructive",
}

const statusLabels: Record<string, string> = {
  approved: "معتمد",
  pending: "بانتظار الموافقة",
  rejected: "مرفوض",
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
  return (
    <Select value={role} disabled={disabled} onValueChange={(v) => onChange(userId, v as "admin" | "manager" | "user")}>
      <SelectTrigger className="h-9 w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">مدير النظام</SelectItem>
        <SelectItem value="manager">مدير</SelectItem>
        <SelectItem value="user">مستخدم</SelectItem>
      </SelectContent>
    </Select>
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
                <th className="px-4 py-3 font-medium">المستخدم</th>
                <th className="px-4 py-3 font-medium">البريد الإلكتروني</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">الدور</th>
                <th className="px-4 py-3 font-medium text-center">الإجراءات</th>
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
