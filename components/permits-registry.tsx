"use client"

import { useMemo, useState } from "react"
import { Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/client"
import { Button } from "@/components/ui/button"
import { PermitRemainingBadge } from "@/components/permit-remaining-badge"
import { PermitLifecycleActions } from "@/components/permit-lifecycle-actions"
import { PermitViewDialog } from "@/components/permit-view-dialog"
import {
  normalizePermitStatus,
  permitStatusBadgeClass,
  permitStatusLabel,
  permitTypeLabel,
  type PermitStatus,
  type SignRole,
} from "@/lib/permit-workflow"
import { PERMIT_SIGNATORIES, SIGN_ROW_ISSUANCE, SIGN_ROW_CLOSURE } from "@/lib/permit-signatories"

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
    // بطاقة توقيع للطباعة: المسمى الوظيفي + الاسم الثابت حسب الدور + خط توقيع.
    const sigBox = (role: SignRole) => {
      const sc = PERMIT_SIGNATORIES[role]
      return `<div class="sg"><div class="sg-r">${loc === "ar" ? sc.ar : sc.en}</div><div class="sg-n">${sc.name || "&nbsp;"}</div><div class="sg-l"></div><div class="sg-c">${t("permitPrint.signAndDate")}</div></div>`
    }
    win.document.write(`
      <html dir="${loc === "ar" ? "rtl" : "ltr"}" lang="${loc}">
      <head><meta charset="utf-8"><title>${p.documentNo ?? ""}</title>
      <style>
        @page{size:A4;margin:12mm}
        *{box-sizing:border-box}
        body{font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;padding:0;color:#0f172a;font-size:12px}
        h1{font-size:18px;margin:0 0 2px}
        .sub{color:#64748b;margin-bottom:14px;font-size:12px}
        table{width:100%;border-collapse:collapse}
        td{border:1px solid #e2e8f0;padding:6px 10px;font-size:12px}
        td:first-child{background:#f8fafc;font-weight:600;width:34%;color:#475569}
        .sec{font-size:13px;font-weight:700;margin:16px 0 6px;color:#0f172a}
        .sg-row{display:flex;gap:8px;margin-bottom:8px}
        .sg{flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:8px}
        .sg-r{font-size:10px;color:#64748b}
        .sg-n{font-size:12px;font-weight:700;margin-top:2px}
        .sg-l{border-top:1px dashed #cbd5e1;margin-top:24px}
        .sg-c{font-size:9px;color:#94a3b8;margin-top:3px}
      </style></head>
      <body>
        <h1>${t("permitPrint.header")}</h1>
        <div class="sub">${p.documentNo ?? ""}</div>
        <table><tbody>
          ${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
        </tbody></table>
        <div class="sec">${t("permitDetail.rowIssuance")}</div>
        <div class="sg-row">${SIGN_ROW_ISSUANCE.map(sigBox).join("")}</div>
        <div class="sec">${t("permitDetail.rowClosure")}</div>
        <div class="sg-row">${SIGN_ROW_CLOSURE.map(sigBox).join("")}</div>
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
      />
    </div>
  )
}
