"use client"

import { useState, useTransition } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatusBadge } from "@/components/status-badge"
import { toast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n/client"
import { statusLabel } from "@/lib/i18n/labels"
import { inspectionStatusOptions } from "@/lib/labels"
import { formatMuscatDateTime } from "@/lib/datetime"
import { updateAuditStatus } from "@/app/actions/hse"

// تغيير حالة التدقيق من نافذة التفاصيل. يظهر كقائمة منسدلة لمدير النظام، ومدير
// السلامة والصحة المهنية تحديداً (بقسمه لا بدور "manager" العام)، والمدقق؛
// وغيرهم يرى الحالة وأثر آخر تغيير للقراءة. القيد مفروض على الخادم في
// updateAuditStatus أيضاً (canChangeAuditStatus)، فالإخفاء هنا للتجربة لا للحماية.
export function AuditStatusControl({
  auditId,
  status,
  statusChangedBy,
  statusChangedAt,
  canChange,
}: {
  auditId: number
  status: string
  statusChangedBy?: string | null
  statusChangedAt?: Date | string | null
  canChange: boolean
}) {
  const { t, locale } = useI18n()
  const [value, setValue] = useState(status)
  const [pending, startTransition] = useTransition()

  const changedLine =
    statusChangedBy && statusChangedAt
      ? t("auditsMod.statusChangedBy")
          .replace("{name}", statusChangedBy)
          .replace("{date}", formatMuscatDateTime(statusChangedAt, locale === "en" ? "en" : "ar"))
      : null

  function save() {
    if (value === status) return
    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.set("id", String(auditId))
        fd.set("status", value)
        await updateAuditStatus(fd)
        toast({ title: t("auditsMod.statusSaved") })
      } catch (err) {
        setValue(status)
        toast({
          title: err instanceof Error ? err.message : t("auditsMod.statusSaveFailed"),
          variant: "destructive",
        })
      }
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ShieldCheck className="size-4 text-muted-foreground" />
        {t("auditsMod.statusSectionTitle")}
      </h4>

      {canChange ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-40 flex-1 flex-col gap-1.5">
            <Label htmlFor={`audit-status-${auditId}`}>{t("auditsMod.fStatus")}</Label>
            <Select value={value} onValueChange={setValue} disabled={pending}>
              <SelectTrigger id={`audit-status-${auditId}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {inspectionStatusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {statusLabel(t, o.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} disabled={pending || value === status} className="gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? t("auditsMod.statusSaving") : t("auditsMod.statusSave")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-xs text-muted-foreground">{t("auditsMod.statusManagersOnly")}</span>
        </div>
      )}

      {changedLine && <p className="text-xs text-muted-foreground">{changedLine}</p>}
    </section>
  )
}
