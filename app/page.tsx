import { Suspense } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ShieldCheck,
  ClipboardCheck,
  CheckSquare,
  ShieldAlert,
  CalendarDays,
  FileSignature,
  FileWarning,
  ArrowLeft,
} from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { Card } from "@/components/ui/card"
import {
  DetectionTrendChart,
  IncidentTrendChart,
  IncidentTypeChart,
  IncidentTypeChartSkeleton,
  SeverityChart,
  SeverityChartSkeleton,
} from "@/components/dashboard-charts"
import { ChartPeriodProvider } from "@/components/dashboard-period"
import { StatusBadge, SeverityBadge } from "@/components/status-badge"
import { requireOrgUser } from "@/lib/session"
import {
  getCriticalWithoutAction,
  getDashboardData,
  getIncidentTypeBreakdown,
  type IncidentTypeBreakdownRow,
} from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"
import { incidentTypeLabel, categoryLabel } from "@/lib/i18n/labels"
import { effectiveViolationStatus, isViolationClosed } from "@/lib/violation-status"

export default async function DashboardPage() {
  const user = await requireOrgUser()
  const { locale, t } = await getServerT()
  const { incidents, inspections, permits, risks, actions, observations, violations, trend, detectionTrend } =
    await getDashboardData()

  // مفتوحة = غير مغلقة وفق الحالة الفعلية (مسار الإحالة) لا الحالة المخزّنة.
  const openViolations = violations.filter((v) => !isViolationClosed(v)).length
  const recentViolations = violations.slice(0, 5)

  const openIncidents = incidents.filter((i) => i.status !== "closed").length
  // الملاحظات الوشيكة = أشباه الحوادث + ملاحظات الجولة الميدانية.
  const patrolObservations = observations.filter((o) => o.kind === "observation").length
  const positiveObservations = observations.filter((o) => o.kind === "positive").length
  const nearMisses = incidents.filter((i) => i.type === "near_miss").length + patrolObservations
  const openActions = actions.filter((a) => a.status !== "closed").length
  const highRisks = risks.filter((r) => (r.likelihood ?? 1) * (r.consequence ?? 1) >= 9).length
  const activePermits = permits.filter((p) => p.status === "active" || p.status === "approved").length
  const avgCompliance =
    inspections.length > 0
      ? Math.round(inspections.reduce((s, i) => s + (i.compliance ?? 0), 0) / inspections.length)
      : 0

  // اتجاه الحوادث (12 شهراً، وقوع/تسجيل، مع سلسلة الرافعات) يُحسب في الخادم داخل
  // getDashboardData عبر generate_series؛ الواجهة تنسّق أسماء الأشهر حسب اللغة.

  // الحوادث حسب النوع: التجميع (شهر × نوع × خطورة) يُجلَب في الخادم بشكل مستقل ويُبَثّ عبر
  // Suspense حتى يظهر هيكل تحميل بدل تأخير الصفحة كلها. تسميات الأنواع تُحَلّ هنا (خادم) وتُمرَّر كخريطة.
  const typeBreakdownPromise = getIncidentTypeBreakdown().catch((err) => {
    console.error("[dashboard] type breakdown failed:", err instanceof Error ? err.message : err)
    return []
  })
  const typeLabels: Record<string, string> = {}
  for (const i of incidents) {
    const ty = i.type || "near_miss"
    if (!typeLabels[ty]) typeLabels[ty] = incidentTypeLabel(t, ty)
  }

  // توزيع الخطورة يستهلك نفس التجميع (شهر × خطورة × مفتوح) فيتبع فلتر الفترة المشترك،
  // مع عدّاد مستقل للحرجة المفتوحة بلا إجراء تصحيحي لشارة التنبيه.
  const criticalNoActionPromise = getCriticalWithoutAction().catch(() => 0)

  const priorityActions = [...actions]
    .filter((a) => a.status !== "closed")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 5)

  return (
    <AppShell title={t("pageHeaders.dashboardTitle")} subtitle={t("pageHeaders.dashboardSubtitle")} user={user}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("dashboard.totalIncidents")} value={incidents.length} icon={AlertTriangle} tone="destructive" />
        <KpiCard label={t("dashboard.recentIncidents")} value={openIncidents} icon={ShieldAlert} tone="accent" />
        <KpiCard label={t("dashboard.avgInspectionCompliance")} value={avgCompliance} unit="%" icon={ClipboardCheck} tone="blue" />
        <KpiCard label={t("dashboard.activePermits")} value={activePermits} icon={ShieldCheck} tone="primary" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-8">
        <MiniStat label={t("dashboard.totalViolations")} value={violations.length} />
        <MiniStat label={t("dashboard.nearMissesLabel")} value={nearMisses} />
        <MiniStat label={t("dashboard.positiveObservations")} value={positiveObservations} tone="positive" />
        <MiniStat label={t("dashboard.openActionsLabel")} value={openActions} />
        <MiniStat label={t("dashboard.highRisksLabel")} value={highRisks} />
        <MiniStat label={t("dashboard.inspectionsCount")} value={inspections.length} />
        <MiniStat label={t("dashboard.riskRegister")} value={risks.length} />
        <MiniStat label={t("dashboard.totalPermits")} value={permits.length} />
      </div>

      {/* مزوّد فترة مشترك: تغيير الفترة في أي رسم يحرّك رسم الاتجاه ورسم النوع معاً. */}
      <ChartPeriodProvider>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IncidentTrendChart data={trend} />
        </div>
        <Suspense fallback={<SeverityChartSkeleton />}>
          <SeverityChartLoader promise={typeBreakdownPromise} alertPromise={criticalNoActionPromise} />
        </Suspense>
      </div>

      {/* رسم مستقل للكشوفات الذكية أسفل اتجاه الحوادث — لا يُخلَط بالحوادث المسجّلة. */}
      <div className="mt-4">
        <DetectionTrendChart data={detectionTrend} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Suspense fallback={<IncidentTypeChartSkeleton />}>
          <IncidentTypeChartLoader promise={typeBreakdownPromise} labels={typeLabels} />
        </Suspense>
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{t("dashboard.priorityActions")}</h3>
            <CheckSquare className="size-5 text-muted-foreground" />
          </div>
          {priorityActions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("dashboard.noOpenActions")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {priorityActions.map((a) => (
                <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-foreground">{a.title}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{a.assignedTo || t("dashboard.unassigned")}</span>
                      {a.dueDate && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="size-3" />
                          <span dir="ltr">{a.dueDate}</span>
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={a.priority ?? "medium"} />
                    <StatusBadge status={a.status ?? "open"} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      </ChartPeriodProvider>

      <Card className="mt-4 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileWarning className="size-5 text-destructive" />
            <h3 className="text-base font-semibold text-foreground">{t("dashboard.violationsReport")}</h3>
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              {openViolations} {t("dashboard.openCount")}
            </span>
          </div>
          <Link
            href="/violations"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {t("dashboard.viewAll")}
            <ArrowLeft className="size-4 rtl:rotate-0 ltr:rotate-180" />
          </Link>
        </div>
        {recentViolations.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("dashboard.noViolationsYet")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 pe-3 font-medium">{t("dashboard.colViolationNo")}</th>
                  <th className="py-2 pe-3 font-medium">{t("dashboard.colOffender")}</th>
                  <th className="py-2 pe-3 font-medium">{t("dashboard.colType")}</th>
                  <th className="py-2 pe-3 font-medium">{t("dashboard.colCategory")}</th>
                  <th className="py-2 pe-3 font-medium">{t("dashboard.colDate")}</th>
                  <th className="py-2 font-medium">{t("dashboard.colStatus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentViolations.map((v) => (
                  <tr key={v.id} className="text-foreground">
                    <td className="py-3 pe-3 font-mono text-xs" dir="ltr">
                      {v.documentNo || "-"}
                    </td>
                    <td className="py-3 pe-3">{v.employeeName || "-"}</td>
                    <td className="py-3 pe-3 text-muted-foreground">{v.violationType || "-"}</td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {v.category ? categoryLabel(t, v.category) : "-"}
                    </td>
                    <td className="py-3 pe-3 text-muted-foreground" dir="ltr">
                      {v.violationDate ?? "-"}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={effectiveViolationStatus(v)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-6 flex flex-col items-start gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileSignature className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{t("dashboard.welcome")} {user.name}</p>
            <p className="text-xs text-muted-foreground">
              {t("dashboard.autoSaveNote")}
            </p>
          </div>
        </div>
      </Card>
    </AppShell>
  )
}

// مكوّن خادمي غير متزامن يُنتظَر داخل Suspense فيظهر الهيكل حتى وصول بيانات التجميع.
async function IncidentTypeChartLoader({
  promise,
  labels,
}: {
  promise: Promise<IncidentTypeBreakdownRow[]>
  labels: Record<string, string>
}) {
  const data = await promise
  return <IncidentTypeChart data={data} labels={labels} />
}

async function SeverityChartLoader({ promise, alertPromise }: { promise: Promise<IncidentTypeBreakdownRow[]>; alertPromise: Promise<number> }) {
  const [data, criticalWithoutAction] = await Promise.all([promise, alertPromise])
  return <SeverityChart data={data} criticalWithoutAction={criticalWithoutAction} />
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: "positive" }) {
  return (
    <Card
      className={
        tone === "positive"
          ? "flex flex-col items-center justify-center gap-1 border-primary/30 bg-primary/5 p-4 text-center"
          : "flex flex-col items-center justify-center gap-1 p-4 text-center"
      }
    >
      <span className={tone === "positive" ? "text-2xl font-bold text-primary" : "text-2xl font-bold text-foreground"}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </Card>
  )
}
