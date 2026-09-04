import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle, MinusCircle, CircleDashed } from "lucide-react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { Card } from "@/components/ui/card"
import { GapAnalysisExport } from "./gap-analysis-export"
import { requireModule } from "@/lib/session"
import { getServerT } from "@/lib/i18n/server"
import { formatDate } from "@/lib/i18n/translate"
import type { Locale } from "@/lib/i18n/config"
import {
  getDashboardData,
  getEmployees,
  getTrainings,
  getDocuments,
  getCompany,
  getContextIssues,
  getPolicies,
  getObjectives,
  getLegalRequirements,
  getConsultations,
  getEmergencyPlans,
  getContractors,
  getManagementReviews,
  getInternalAudits,
} from "@/app/actions/hse"
import {
  iso45001Clauses,
  clauseSections,
  clauseEvidence,
  moduleNames,
  formatClauseRef,
  type ClauseStatus,
  type IsoClause,
} from "@/lib/iso45001-clauses"
import { computeCompliance, type ComplianceResult } from "@/lib/compliance"

// وصف كل حالة مطابقة: تسمية ثنائية اللغة + لون + أيقونة.
const STATUS_META: Record<
  ClauseStatus,
  { ar: string; en: string; cls: string; dot: string; Icon: typeof CheckCircle2 }
> = {
  compliant: { ar: "مطابق", en: "Compliant", cls: "bg-primary/10 text-primary", dot: "bg-primary", Icon: CheckCircle2 },
  partial: {
    ar: "مطابق جزئياً",
    en: "Partial",
    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    Icon: AlertTriangle,
  },
  non_compliant: {
    ar: "غير مطابق",
    en: "Non-compliant",
    cls: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    Icon: XCircle,
  },
  not_applicable: {
    ar: "لا ينطبق",
    en: "Not applicable",
    cls: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    Icon: MinusCircle,
  },
  not_assessed: {
    ar: "لم يُقيَّم بعد",
    en: "Not assessed",
    cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
    Icon: CircleDashed,
  },
}

function statusText(status: ClauseStatus, locale: Locale) {
  const m = STATUS_META[status]
  return locale === "en" ? m.en : m.ar
}

function StatusBadge({ status, locale }: { status: ClauseStatus; locale: Locale }) {
  const m = STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${m.cls}`}>
      <m.Icon className="size-3.5" aria-hidden />
      {statusText(status, locale)}
    </span>
  )
}

// يبني تقرير تحليل الفجوات (HTML) بند ببند لتصديره PDF بالعربية RTL.
function buildGapHtml(
  result: ComplianceResult,
  locale: Locale,
  orgName: string,
  generatedAt: string,
  responsible: string,
): string {
  const rows = iso45001Clauses
    .map((c) => {
      const a = result.byClause[c.id]
      const status = a?.status ?? "not_assessed"
      const meta = STATUS_META[status]
      const title = locale === "en" ? c.en : c.ar
      const metric = a ? (locale === "en" ? a.metricEn : a.metricAr) ?? "" : ""
      const evidence = clauseEvidence(c.id)
        .map((e) => moduleNames[e.module]?.[locale] + (e.planned ? " (مخطّط)" : ""))
        .join("، ")
      const color =
        status === "compliant"
          ? "#0f766e"
          : status === "partial"
            ? "#b45309"
            : status === "non_compliant"
              ? "#b91c1c"
              : "#64748b"
      return `<tr>
        <td style="border:1px solid #cbd5e1;padding:6px;font-family:monospace;text-align:center;">${c.id}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;">${title}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;color:${color};font-weight:bold;white-space:nowrap;">${statusText(status, locale)}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;font-size:10pt;color:#475569;">${metric || "-"}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;font-size:10pt;color:#475569;">${evidence || "-"}</td>
      </tr>`
    })
    .join("")

  return `<div style="max-width:820px;margin:0 auto;color:#0f172a;">
    <div style="text-align:center;border-bottom:3px solid #0f766e;padding-bottom:10px;margin-bottom:16px;">
      <h1 style="font-size:20pt;color:#0f766e;margin:0;">تقرير جاهزية التدقيق — ISO 45001:2018</h1>
      <p style="margin:6px 0 0;font-size:12pt;">${orgName}</p>
      <p style="margin:4px 0 0;font-size:10pt;color:#64748b;">تحليل الفجوات (Gap Analysis) · ${generatedAt} · ${responsible}</p>
    </div>
    <div style="display:flex;gap:10px;justify-content:center;margin-bottom:16px;font-size:11pt;">
      <span>نسبة المطابقة الإجمالية: <b style="color:#0f766e;">${result.overall}%</b></span>
      <span>| مطابق: <b>${result.counts.compliant}</b></span>
      <span>| جزئي: <b>${result.counts.partial}</b></span>
      <span>| غير مطابق: <b>${result.counts.non_compliant}</b></span>
      <span>| لم يُقيَّم: <b>${result.counts.not_assessed}</b></span>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11pt;">
      <thead><tr style="background:#f1f5f9;">
        <th style="border:1px solid #cbd5e1;padding:6px;">البند</th>
        <th style="border:1px solid #cbd5e1;padding:6px;">العنوان</th>
        <th style="border:1px solid #cbd5e1;padding:6px;">الحالة</th>
        <th style="border:1px solid #cbd5e1;padding:6px;">الدليل الكمّي</th>
        <th style="border:1px solid #cbd5e1;padding:6px;">الأدلة المرتبطة</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`
}

export default async function CompliancePage() {
  const user = await requireModule("compliance")
  const [
    dashboard,
    employees,
    trainings,
    documents,
    company,
    contextIssues,
    policies,
    objectives,
    legalRequirements,
    consultations,
    emergencyPlans,
    contractors,
    managementReviews,
    internalAudits,
  ] = await Promise.all([
    getDashboardData(),
    getEmployees(),
    getTrainings(),
    getDocuments(),
    getCompany(),
    getContextIssues(),
    getPolicies(),
    getObjectives(),
    getLegalRequirements(),
    getConsultations(),
    getEmergencyPlans(),
    getContractors(),
    getManagementReviews(),
    getInternalAudits(),
  ])
  const { t, dir, locale } = await getServerT()

  const result = computeCompliance({
    incidents: dashboard.incidents,
    inspections: dashboard.inspections,
    permits: dashboard.permits,
    risks: dashboard.risks,
    actions: dashboard.actions,
    violations: dashboard.violations,
    documents,
    trainings,
    employeeCount: employees.length,
    contextIssues,
    policies,
    objectives,
    legalRequirements,
    consultations,
    emergencyPlans,
    contractors,
    managementReviews,
    internalAudits,
  })

  const orgName = (company as { name?: string } | null)?.name || "المنظمة"
  const responsible = t("complianceMod.responsibleDefault")
  const generatedAt = formatDate(new Date(), locale)
  const gapHtml = buildGapHtml(result, locale, orgName, generatedAt, responsible)

  // تجميع البنود حسب القسم الرئيسي للعرض.
  const bySection = clauseSections.map((s) => ({
    ...s,
    clauses: iso45001Clauses.filter((c) => c.section === s.section && c.level > 1),
  }))

  return (
    <AppShell
      title={t("complianceMod.title")}
      subtitle={t("complianceMod.subtitle")}
      user={user}
      action={
        <GapAnalysisExport
          html={gapHtml}
          fileName={`ISO45001-Gap-Analysis-${new Date().toISOString().slice(0, 10)}`}
          label={t("complianceMod.exportReport")}
        />
      }
    >
      {/* الملخص */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("complianceMod.kpiOverall")} value={`${result.overall}%`} icon={ShieldCheck} tone="primary" />
        <KpiCard label={t("complianceMod.kpiCompliant")} value={result.counts.compliant} icon={CheckCircle2} tone="primary" />
        <KpiCard label={t("complianceMod.kpiPartial")} value={result.counts.partial} icon={AlertTriangle} tone="accent" />
        <KpiCard label={t("complianceMod.kpiGaps")} value={result.counts.non_compliant} icon={XCircle} tone="destructive" />
      </div>

      {/* شريط النسبة الإجمالية */}
      <Card className="mt-4 flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{t("complianceMod.overallLabel")}</span>
          <span className="text-sm font-bold text-primary">{result.overall}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${result.overall}%` }} />
        </div>
        <p className="text-xs text-muted-foreground text-pretty">
          {t("complianceMod.assessedNote")
            .replace("{assessed}", String(result.assessedCount))
            .replace("{total}", String(result.totalCount))
            .replace("{pending}", String(result.counts.not_assessed))}
        </p>
      </Card>

      {/* جدول البنود حسب القسم */}
      <div className="mt-6 flex flex-col gap-6">
        {bySection.map((section) => (
          <section key={section.section}>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary" dir="ltr">
                {section.section}
              </span>
              <h2 className="text-lg font-semibold text-foreground">{locale === "en" ? section.en : section.ar}</h2>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="border-b border-border px-3 py-2 text-start font-semibold text-foreground">{t("complianceMod.colClause")}</th>
                    <th className="border-b border-border px-3 py-2 text-start font-semibold text-foreground">{t("complianceMod.colTitle")}</th>
                    <th className="border-b border-border px-3 py-2 text-start font-semibold text-foreground">{t("complianceMod.colStatus")}</th>
                    <th className="border-b border-border px-3 py-2 text-start font-semibold text-foreground">{t("complianceMod.colEvidence")}</th>
                    <th className="border-b border-border px-3 py-2 text-start font-semibold text-foreground">{t("complianceMod.colUpdated")}</th>
                  </tr>
                </thead>
                <tbody>
                  {section.clauses.map((c: IsoClause) => {
                    const a = result.byClause[c.id]
                    const status = a?.status ?? "not_assessed"
                    const metric = a ? (locale === "en" ? a.metricEn : a.metricAr) : undefined
                    const evidence = clauseEvidence(c.id)
                    const indent = (c.level - 2) * 16
                    return (
                      <tr key={c.id} className="border-b border-border/60 last:border-0 even:bg-muted/30">
                        <td className="px-3 py-2 align-top font-mono text-xs text-muted-foreground" dir="ltr">
                          {c.id}
                        </td>
                        <td className="px-3 py-2 align-top" style={{ paddingInlineStart: 12 + indent }}>
                          <span className="font-medium text-foreground">{locale === "en" ? c.en : c.ar}</span>
                          {metric && <span className="mt-0.5 block text-xs text-muted-foreground">{metric}</span>}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <StatusBadge status={status} locale={locale} />
                        </td>
                        <td className="px-3 py-2 align-top">
                          {evidence.length === 0 ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {evidence.map((e) =>
                                e.planned ? (
                                  <span
                                    key={e.module}
                                    className="inline-flex items-center rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground"
                                  >
                                    {moduleNames[e.module]?.[locale]} · {t("complianceMod.planned")}
                                  </span>
                                ) : (
                                  <Link
                                    key={e.module}
                                    href={e.href}
                                    className="inline-flex items-center rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"
                                  >
                                    {moduleNames[e.module]?.[locale]}
                                  </Link>
                                ),
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-muted-foreground" dir="ltr">
                          {a?.updatedAt ? formatDate(a.updatedAt, locale) : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {formatClauseRef("4")} … {formatClauseRef("10")} · {t("complianceMod.footerNote")}
      </p>
    </AppShell>
  )
}
