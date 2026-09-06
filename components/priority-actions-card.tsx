"use client"

import { useMemo } from "react"
import Link from "next/link"
import { AlertCircle, CalendarDays, CheckSquare, Plus, ArrowLeft } from "lucide-react"
import { Card } from "@/components/ui/card"
import { SeverityBadge } from "@/components/status-badge"
import { useI18n } from "@/lib/i18n/client"
import { cn } from "@/lib/utils"
import { compareActionPriority, isActionOverdue, isActionOpen, sourceHref } from "@/lib/corrective-actions"

// الشكل الأدنى المطلوب من صف الإجراء التصحيحي (يأتي من getDashboardData بحالة مطبَّعة).
export type PriorityAction = {
  id: number
  code: string | null
  title: string
  assignedTo: string | null
  priority: string | null
  status: string | null
  dueDate: string | null
  sourceType: string | null
  sourceId: number | null
}

const MAX_ROWS = 5

// بطاقة "الإجراءات التصحيحية ذات الأولوية": ترتّب المفتوح (المتأخر أولاً، ثم الأعلى
// خطورة، ثم الأقدم استحقاقاً)، تعرض حتى 5 صفوف مع رابط للسجل الأصلي وشارة "متأخر"،
// وفي الفراغ الحقيقي تعرض رسالة عملية + تحذير السجلات الحرجة بلا إجراء.
export function PriorityActionsCard({
  actions,
  criticalWithoutAction = 0,
}: {
  actions: PriorityAction[]
  criticalWithoutAction?: number
}) {
  const { t, locale } = useI18n()

  const sourceLabel = (type: string | null): string => {
    switch (type) {
      case "incident":
        return t("dashboard.actionSourceIncident")
      case "violation":
        return t("dashboard.actionSourceViolation")
      case "risk":
        return t("dashboard.actionSourceRisk")
      case "audit":
        return t("dashboard.actionSourceAudit")
      default:
        return t("dashboard.actionSourceManual")
    }
  }

  const rows = useMemo(
    () => actions.filter((a) => isActionOpen(a.status)).sort(compareActionPriority).slice(0, MAX_ROWS),
    [actions],
  )

  const numLocale = locale === "en" ? "en-US" : "ar-EG"

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">{t("dashboard.priorityActions")}</h3>
          {rows.length > 0 && (
            <Link
              href="/actions"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {t("dashboard.viewAll")}
              <ArrowLeft className="size-4 rtl:rotate-0 ltr:rotate-180" />
            </Link>
          )}
        </div>
        <CheckSquare className="size-5 text-muted-foreground" aria-hidden />
      </div>

      {/* تحذير مطابقة (بند 10.2): سجلات حرجة بلا إجراء تصحيحي — يظهر مع القائمة أو الفراغ. */}
      {criticalWithoutAction > 0 && (
        <Link
          href="/incidents?severity=critical"
          className="mb-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/15"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          <span className="text-pretty">
            {t("dashboard.criticalNoActionWarn").replace("{n}", criticalWithoutAction.toLocaleString(numLocale))}
          </span>
        </Link>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <p className="text-sm font-medium text-foreground">{t("dashboard.actionsEmptyTitle")}</p>
          <p className="max-w-xs text-xs text-muted-foreground text-pretty">{t("dashboard.actionsEmptyHint")}</p>
          <Link
            href="/actions"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-4" aria-hidden />
            {t("dashboard.createAction")}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((a) => {
            const overdue = isActionOverdue(a.dueDate, a.status)
            const href = a.sourceType && a.sourceId != null ? sourceHref(a.sourceType) : null
            return (
              <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.code && (
                      <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                        {a.code}
                      </span>
                    )}
                    <span className="truncate text-sm font-medium text-foreground">{a.title}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {href ? (
                      <Link href={href} className="text-primary hover:underline">
                        {sourceLabel(a.sourceType)}
                      </Link>
                    ) : (
                      <span>{sourceLabel(a.sourceType)}</span>
                    )}
                    <span>{a.assignedTo || t("dashboard.unassigned")}</span>
                    {a.dueDate && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3" aria-hidden />
                        <span dir="ltr">{a.dueDate}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {overdue && (
                    <span className={cn(
                      "inline-flex items-center rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive",
                    )}>
                      {t("dashboard.overdueBadge")}
                    </span>
                  )}
                  <SeverityBadge severity={a.priority ?? "medium"} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
