"use client"

import { useEffect, useState } from "react"
import { Clock, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { remainingTime } from "@/lib/permit-workflow"
import { useI18n } from "@/lib/i18n/client"

// شارة الوقت المتبقي الحية: تُحدَّث كل دقيقة وتتغيّر لونها عند اقتراب الانتهاء.
export function PermitRemainingBadge({
  startAt,
  endAt,
  status,
}: {
  startAt: string | null
  endAt: string | null
  status: string
}) {
  const { t } = useI18n()
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // لا وقت متبقٍ للحالات النهائية.
  if (status === "closed" || status === "rejected") {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  if (!endAt) return <span className="text-xs text-muted-foreground">—</span>
  // قبل ترطيب العميل نعرض مكاناً محايداً لتفادي عدم تطابق SSR.
  if (!now) return <span className="text-xs text-muted-foreground" dir="ltr">··:··</span>

  const rt = remainingTime(startAt, endAt, now)
  if (!rt) return <span className="text-xs text-muted-foreground">—</span>

  if (rt.expired || status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        <AlertTriangle className="size-3" />
        {t("permitTime.expired")}
      </span>
    )
  }

  // أقل من ساعة → تحذير.
  const soon = rt.hours === 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums",
        soon
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-success/30 bg-success/10 text-success",
      )}
      dir="ltr"
    >
      <Clock className="size-3" />
      {rt.hours > 0 ? `${rt.hours}${t("permitTime.h")} ` : ""}
      {rt.minutes}
      {t("permitTime.m")}
    </span>
  )
}
