import { Suspense } from "react"
import { BarChart3, TrendingUp, ShieldCheck, Activity, ClipboardCheck } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { Card } from "@/components/ui/card"
import { KpiCard } from "@/components/kpi-card"
import {
  IncidentTrendChart,
  IncidentTypeChart,
  IncidentTypeChartSkeleton,
  SeverityChart,
  SeverityChartSkeleton,
} from "@/components/dashboard-charts"
import { ChartPeriodProvider } from "@/components/dashboard-period"
import { requireModule } from "@/lib/session"
import {
  getCriticalWithoutAction,
  getDashboardData,
  getIncidentTypeBreakdown,
  type IncidentTypeBreakdownRow,
} from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"
import { incidentTypeLabel } from "@/lib/i18n/labels"
import { ReportsClient } from "./reports-client"

export default async function ReportsPage() {
  const user = await requireModule("reports")
  const { incidents, inspections, permits, risks, actions, trend } = await getDashboardData()
  const { locale, t } = await getServerT()

  const openIncidents = incidents.filter((i) => i.status !== "closed").length
  const nearMisses = incidents.filter((i) => i.type === "near_miss").length
  const openActions = actions.filter((a) => a.status !== "closed").length
  const highRisks = risks.filter((r) => (r.likelihood ?? 1) * (r.consequence ?? 1) >= 9).length
  const activePermits = permits.filter((p) => p.status === "active" || p.status === "approved").length
  const avgCompliance =
    inspections.length > 0
      ? Math.round(inspections.reduce((s, i) => s + (i.compliance ?? 0), 0) / inspections.length)
      : 0

  // اتجاه الحوادث (12 شهراً) يأتي محسوباً من الخادم ضمن getDashboardData.

  // الحوادث حسب النوع (شهر × نوع × خطورة) — نفس مصدر لوحة التحكم، مع تسميات الأنواع من الخادم.
  const typeBreakdownPromise = getIncidentTypeBreakdown().catch(() => [])
  const typeLabels: Record<string, string> = {}
  for (const i of incidents) {
    const ty = i.type || "near_miss"
    if (!typeLabels[ty]) typeLabels[ty] = incidentTypeLabel(t, ty)
  }

  const criticalNoActionPromise = getCriticalWithoutAction().catch(() => 0)

  return (
    <AppShell
      title={t("pageHeaders.reportsTitle")}
      subtitle={t("pageHeaders.reportsSubtitle")}
      user={user}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("reports.openIncidents")} value={openIncidents} icon={Activity} tone="destructive" />
        <KpiCard label={t("reports.openActions")} value={openActions} icon={TrendingUp} tone="accent" />
        <KpiCard label={t("reports.avgCompliance")} value={avgCompliance} unit="%" icon={ClipboardCheck} tone="blue" />
        <KpiCard label={t("reports.activePermits")} value={activePermits} icon={ShieldCheck} tone="primary" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MiniStat label={t("reports.totalIncidents")} value={incidents.length} />
        <MiniStat label={t("reports.nearMisses")} value={nearMisses} />
        <MiniStat label={t("reports.highRisks")} value={highRisks} />
        <MiniStat label={t("reports.riskRegister")} value={risks.length} />
      </div>

      <ChartPeriodProvider>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <IncidentTrendChart data={trend} />
          </div>
          <Suspense fallback={<SeverityChartSkeleton />}>
            <SeverityLoader promise={typeBreakdownPromise} alertPromise={criticalNoActionPromise} />
          </Suspense>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <Suspense fallback={<IncidentTypeChartSkeleton />}>
            <TypeChartLoader promise={typeBreakdownPromise} labels={typeLabels} />
          </Suspense>
        </div>
      </ChartPeriodProvider>

      <Card className="mt-6 flex items-center gap-3 p-5">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BarChart3 className="size-5" />
        </div>
        <p className="text-sm text-muted-foreground text-pretty">
          {t("reports.autoComputeNote")}
        </p>
      </Card>

      <section className="mt-10 border-t border-border pt-8">
        <h2 className="mb-1 text-xl font-bold text-foreground">{t("reports.exportTitle")}</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          {t("reports.exportSubtitle")}
        </p>
        <ReportsClient />
      </section>
    </AppShell>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-1 p-4 text-center">
      <span className="text-2xl font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </Card>
  )
}

async function TypeChartLoader({
  promise,
  labels,
}: {
  promise: Promise<IncidentTypeBreakdownRow[]>
  labels: Record<string, string>
}) {
  const data = await promise
  return <IncidentTypeChart data={data} labels={labels} />
}

async function SeverityLoader({ promise, alertPromise }: { promise: Promise<IncidentTypeBreakdownRow[]>; alertPromise: Promise<number> }) {
  const [data, criticalWithoutAction] = await Promise.all([promise, alertPromise])
  return <SeverityChart data={data} criticalWithoutAction={criticalWithoutAction} />
}
