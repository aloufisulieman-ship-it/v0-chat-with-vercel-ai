import { BarChart3, TrendingUp, ShieldCheck, Activity, ClipboardCheck } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { Card } from "@/components/ui/card"
import { KpiCard } from "@/components/kpi-card"
import { IncidentTrendChart, IncidentTypeChart, SeverityChart } from "@/components/dashboard-charts"
import { requireModule } from "@/lib/session"
import { getDashboardData } from "@/app/actions/hse"
import { incidentTypeLabels } from "@/lib/labels"

export default async function ReportsPage() {
  const user = await requireModule("reports")
  const { incidents, inspections, permits, risks, actions } = await getDashboardData()

  const openIncidents = incidents.filter((i) => i.status !== "closed").length
  const nearMisses = incidents.filter((i) => i.type === "near_miss").length
  const openActions = actions.filter((a) => a.status !== "closed").length
  const highRisks = risks.filter((r) => (r.likelihood ?? 1) * (r.consequence ?? 1) >= 9).length
  const activePermits = permits.filter((p) => p.status === "active" || p.status === "approved").length
  const avgCompliance =
    inspections.length > 0
      ? Math.round(inspections.reduce((s, i) => s + (i.compliance ?? 0), 0) / inspections.length)
      : 0

  // اتجاه الحوادث حسب الشهر (آخر 6 أشهر)
  const now = new Date()
  const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
  const trend: { month: string; incidents: number }[] = []
  for (let k = 5; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1)
    const count = incidents.filter((i) => {
      const ref = i.incidentDate ? new Date(i.incidentDate) : new Date(i.createdAt)
      return ref.getFullYear() === d.getFullYear() && ref.getMonth() === d.getMonth()
    }).length
    trend.push({ month: monthNames[d.getMonth()], incidents: count })
  }

  // الحوادث حسب النوع
  const typeCounts = new Map<string, number>()
  incidents.forEach((i) => typeCounts.set(i.type ?? "near_miss", (typeCounts.get(i.type ?? "near_miss") ?? 0) + 1))
  const typeData = Array.from(typeCounts.entries()).map(([type, count]) => ({
    type: incidentTypeLabels[type] ?? type,
    count,
  }))

  // توزيع الخطورة
  const sevFill: Record<string, string> = {
    low: "var(--color-chart-1)",
    medium: "var(--color-chart-2)",
    high: "var(--color-chart-3)",
    critical: "var(--color-destructive)",
  }
  const sevNames: Record<string, string> = { low: "منخفض", medium: "متوسط", high: "عالٍ", critical: "حرج" }
  const severityData = ["low", "medium", "high", "critical"].map((s) => ({
    name: sevNames[s],
    value: incidents.filter((i) => i.severity === s).length,
    fill: sevFill[s],
  }))

  return (
    <AppShell
      title="التقارير والتحليلات"
      subtitle="تقارير الأداء والمؤشرات الإحصائية لاتخاذ القرار"
      user={user}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="الحوادث المفتوحة" value={openIncidents} icon={Activity} tone="destructive" />
        <KpiCard label="الإجراءات المفتوحة" value={openActions} icon={TrendingUp} tone="accent" />
        <KpiCard label="متوسط التزام التفتيش" value={avgCompliance} unit="%" icon={ClipboardCheck} tone="blue" />
        <KpiCard label="التصاريح النشطة" value={activePermits} icon={ShieldCheck} tone="primary" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MiniStat label="إجمالي الحوادث" value={incidents.length} />
        <MiniStat label="ملاحظات وشيكة" value={nearMisses} />
        <MiniStat label="مخاطر عالية" value={highRisks} />
        <MiniStat label="سجل المخاطر" value={risks.length} />
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
          تُحسب جميع المؤشرات والرسوم البيانية تلقائياً من بياناتك الفعلية المسجّلة في النظام، وتتحدّث فور إضافة أي سجل جديد.
        </p>
      </Card>
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
