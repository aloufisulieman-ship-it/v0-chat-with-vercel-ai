import { BarChart3, TrendingUp, ShieldCheck, Activity, ClipboardCheck } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { Card } from "@/components/ui/card"
import { KpiCard } from "@/components/kpi-card"
import { IncidentTrendChart, IncidentTypeChart, SeverityChart } from "@/components/dashboard-charts"
import { requireModule } from "@/lib/session"
import { getDashboardData } from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"
import { incidentTypeLabel, severityLabel } from "@/lib/i18n/labels"
import { ReportsClient } from "./reports-client"

export default async function ReportsPage() {
  const user = await requireModule("reports")
  const { incidents, inspections, permits, risks, actions } = await getDashboardData()
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

  // اتجاه الحوادث حسب الشهر (آخر 6 أشهر) — أسماء الأشهر عبر Intl حسب اللغة.
  const now = new Date()
  const monthFmt = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar", { month: "long" })
  const trend: { month: string; incidents: number }[] = []
  for (let k = 5; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1)
    const count = incidents.filter((i) => {
      const ref = i.incidentDate ? new Date(i.incidentDate) : new Date(i.createdAt)
      return ref.getFullYear() === d.getFullYear() && ref.getMonth() === d.getMonth()
    }).length
    trend.push({ month: monthFmt.format(d), incidents: count })
  }

  // الحوادث حسب النوع
  const typeCounts = new Map<string, number>()
  incidents.forEach((i) => typeCounts.set(i.type ?? "near_miss", (typeCounts.get(i.type ?? "near_miss") ?? 0) + 1))
  const typeData = Array.from(typeCounts.entries()).map(([type, count]) => ({
    type: incidentTypeLabel(t, type),
    count,
  }))

  // توزيع الخطورة
  const sevFill: Record<string, string> = {
    low: "var(--color-chart-1)",
    medium: "var(--color-chart-2)",
    high: "var(--color-chart-3)",
    critical: "var(--color-destructive)",
  }
  const severityData = ["low", "medium", "high", "critical"].map((s) => ({
    name: severityLabel(t, s),
    value: incidents.filter((i) => i.severity === s).length,
    fill: sevFill[s],
  }))

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

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IncidentTrendChart data={trend} />
        </div>
        <SeverityChart data={severityData} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <IncidentTypeChart data={typeData} />
      </div>

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
