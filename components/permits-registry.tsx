"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/client"
import { PermitRemainingBadge } from "@/components/permit-remaining-badge"
import { PermitLifecycleActions } from "@/components/permit-lifecycle-actions"
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

export function PermitsRegistry({ permits, isManager }: { permits: PermitRow[]; isManager: boolean }) {
  const { t, locale } = useI18n()
  const loc = locale === "en" ? "en" : "ar"
  const [filter, setFilter] = useState<FilterKey>("all")

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

  function printPermit(p: PermitRow) {
    const st = normalizePermitStatus(p.status)
    const win = window.open("", "_blank", "width=800,height=1000")
    if (!win) return
    const rows: [string, string][] = [
      [t("permits.fPermitNo"), p.documentNo ?? "-"],
      [t("permitWizard.type"), permitTypeLabel(p.type, loc)],
      [t("permitWizard.workTitle"), p.title],
      [t("permitWizard.location"), p.location ?? "-"],
      [t("permitWizard.requestedBy"), p.requestedBy ?? "-"],
      [t("permitWizard.contractor"), p.contractorName ?? "-"],
      [t("permitWizard.supervisor"), p.supervisorName ?? "-"],
      [t("permitWizard.startAt"), p.startAt ? new Date(p.startAt).toLocaleString(loc === "en" ? "en-US" : "ar") : "-"],
      [t("permitWizard.endAt"), p.endAt ? new Date(p.endAt).toLocaleString(loc === "en" ? "en-US" : "ar") : "-"],
      [t("permits.colStatus"), permitStatusLabel(st, loc)],
    ]
    win.document.write(`
      <html dir="${loc === "ar" ? "rtl" : "ltr"}" lang="${loc}">
      <head><meta charset="utf-8"><title>${p.documentNo ?? ""}</title>
      <style>
        body{font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;padding:40px;color:#0f172a}
        h1{font-size:20px;margin-bottom:4px}
        .sub{color:#64748b;margin-bottom:24px;font-size:13px}
        table{width:100%;border-collapse:collapse}
        td{border:1px solid #e2e8f0;padding:10px 12px;font-size:14px}
        td:first-child{background:#f8fafc;font-weight:600;width:38%;color:#475569}
      </style></head>
      <body>
        <h1>${t("permitPrint.header")}</h1>
        <div class="sub">${p.documentNo ?? ""}</div>
        <table><tbody>
          ${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
        </tbody></table>
      </body></html>`)
    win.document.close()
    win.focus()
    win.print()
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
                      <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                        {p.documentNo || "-"}
                      </span>
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
                      <PermitLifecycleActions
                        permitId={p.id}
                        documentNo={p.documentNo ?? `#${p.id}`}
                        status={st}
                        isManager={isManager}
                        onPrint={() => printPermit(p)}
                      />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
