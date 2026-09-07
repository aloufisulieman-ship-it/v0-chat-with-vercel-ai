"use client"

import { useMemo, useState } from "react"
import { Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/client"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { PermitRemainingBadge } from "@/components/permit-remaining-badge"
import { PermitLifecycleActions } from "@/components/permit-lifecycle-actions"
import { PermitViewDialog } from "@/components/permit-view-dialog"
import { getPermitById } from "@/app/actions/permit-workflow"
import { openPermitPrint } from "@/lib/permit-print"
import {
  normalizePermitStatus,
  permitStatusBadgeClass,
  permitStatusLabel,
  permitTypeLabel,
  type PermitStatus,
} from "@/lib/permit-workflow"

export type PermitRow = {
  id: number
  documentNo: string | null
  title: string
  type: string | null
  location: string | null
  requestedBy: string | null
  status: string | null
  startAt: string | null
  endAt: string | null
  archivedAt: string | null
  riskLevel: string | null
  contractorName: string | null
  supervisorName: string | null
}

type FilterKey = "all" | "pending" | "active" | "suspended" | "expired" | "closed" | "archived"

const FILTERS: { key: FilterKey; labelKey: string }[] = [
  { key: "all", labelKey: "permitsReg.all" },
  { key: "pending", labelKey: "permitsReg.pending" },
  { key: "active", labelKey: "permitsReg.active" },
  { key: "suspended", labelKey: "permitsReg.suspended" },
  { key: "expired", labelKey: "permitsReg.expired" },
  { key: "closed", labelKey: "permitsReg.closed" },
  { key: "archived", labelKey: "permitsReg.archived" },
]

export function PermitsRegistry({
  permits,
  isManager,
  companyName,
}: {
  permits: PermitRow[]
  isManager: boolean
  companyName?: string | null
}) {
  const { t, locale } = useI18n()
  const loc = locale === "en" ? "en" : "ar"
  const [filter, setFilter] = useState<FilterKey>("all")
  const [viewId, setViewId] = useState<number | null>(null)

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: permits.length,
      pending: 0,
      active: 0,
      suspended: 0,
      expired: 0,
      closed: 0,
      archived: 0,
    }
    for (const p of permits) {
      if (p.archivedAt) c.archived++
      const st = normalizePermitStatus(p.status)
      if (st in c) (c as Record<string, number>)[st]++
    }
    return c
  }, [permits])

  const rows = useMemo(() => {
    if (filter === "all") return permits.filter((p) => !p.archivedAt)
    if (filter === "archived") return permits.filter((p) => p.archivedAt)
    return permits.filter((p) => !p.archivedAt && normalizePermitStatus(p.status) === filter)
  }, [permits, filter])

  // الطباعة الكاملة: نجلب تفاصيل التصريح كاملة ثم نفتح القالب المشترك (A4 + تواقيع + QR).
  async function printPermit(p: PermitRow) {
    try {
      const detail = await getPermitById(p.id)
      if (!detail) {
        toast({ title: t("permitDetail.loadError"), variant: "destructive" })
        return
      }
      await openPermitPrint(detail, { t, loc, companyName })
    } catch {
      toast({ title: t("permitDetail.loadError"), variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* شرائط التصفية حسب الحالة */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("permitsReg.filterLabel")}>
        {FILTERS.map((f) => {
          const activeTab = filter === f.key
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={activeTab}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                activeTab
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {t(f.labelKey)}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  activeTab ? "bg-primary-foreground/20" : "bg-muted",
                )}
              >
                {counts[f.key]}
              </span>
            </button>
          )
        })}
      </div>

      {/* الجدول */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{t("permits.colPermitNo")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("permits.colPermit")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("permits.colType")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("permits.colLocation")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("permitsReg.remaining")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("permits.colStatus")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  {t("permitsReg.empty")}
                </td>
              </tr>
            ) : (
              rows.map((p) => {
                const st = normalizePermitStatus(p.status) as PermitStatus
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setViewId(p.id)}
                        className="font-mono text-xs text-primary hover:underline"
                        dir="ltr"
                      >
                        {p.documentNo || `#${p.id}`}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{p.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{permitTypeLabel(p.type, loc)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.location || "-"}</td>
                    <td className="px-4 py-3">
                      <PermitRemainingBadge startAt={p.startAt} endAt={p.endAt} status={st} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          permitStatusBadgeClass(st),
                        )}
                      >
                        {permitStatusLabel(st, loc)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={t("permitDetail.view")}
                          onClick={() => setViewId(p.id)}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <PermitLifecycleActions
                          permitId={p.id}
                          documentNo={p.documentNo ?? `#${p.id}`}
                          status={st}
                          isManager={isManager}
                          onPrint={() => printPermit(p)}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <PermitViewDialog
        permitId={viewId}
        open={viewId != null}
        onOpenChange={(o) => !o && setViewId(null)}
        isManager={isManager}
        companyName={companyName}
      />
    </div>
  )
}
