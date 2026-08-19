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
import { IncidentTrendChart, IncidentTypeChart, SeverityChart } from "@/components/dashboard-charts"
import { StatusBadge, SeverityBadge } from "@/components/status-badge"
import { requireUser } from "@/lib/session"
import { getDashboardData } from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"
import { incidentTypeLabel, severityLabel } from "@/lib/i18n/labels"
import { categoryLabel } from "@/lib/i18n/violation-category-label"
import { effectiveViolationStatus, isViolationClosed } from "@/lib/violation-status"

export default async function DashboardPage() {
  const user = await requireUser()
  const { locale, t } = await getServerT()
  const { incidents, inspections, permits, risks, actions, observations, violations } = await getDashboardData()

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

  const priorityActions = [...actions]
    .filter((a) => a.status !== "closed")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 5)

  return (
    <AppShell title="لوحة التحكم" subtitle="نظرة عامة على أداء الصحة والسلامة والبيئة" user={user}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="إجمالي الحوادث المسجلة" value={incidents.length} icon={AlertTriangle} tone="destructive" />
        <KpiCard label="الحوادث المفتوحة" value={openIncidents} icon={ShieldAlert} tone="accent" />
        <KpiCard label="متوسط التزام التفتيش" value={avgCompliance} unit="%" icon={ClipboardCheck} tone="blue" />
        <KpiCard label="التصاريح النشطة" value={activePermits} icon={ShieldCheck} tone="primary" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-8">
        <MiniStat label="إجمالي المخالفات" value={violations.length} />
        <MiniStat label="ملاحظات وشيكة" value={nearMisses} />
        <MiniStat label="ملاحظات إيجابية" value={positiveObservations} tone="positive" />
        <MiniStat label="الإجراءات المفتوحة" value={openActions} />
        <MiniStat label="مخاطر عالية" value={highRisks} />
        <MiniStat label="عمليات التفتيش" value={inspections.length} />
        <MiniStat label="سجل المخاطر" value={risks.length} />
        <MiniStat label="إجمالي التصاريح" value={permits.length} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IncidentTrendChart data={trend} />
        </div>
        <SeverityChart data={severityData} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <IncidentTypeChart data={typeData} />
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">الإجراءات التصحيحية ذات الأولوية</h3>
            <CheckSquare className="size-5 text-muted-foreground" />
          </div>
          {priorityActions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">لا توجد إجراءات مفتوحة حالياً</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {priorityActions.map((a) => (
                <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-foreground">{a.title}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{a.assignedTo || "غير مُسند"}</span>
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

      <Card className="mt-4 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileWarning className="size-5 text-destructive" />
            <h3 className="text-base font-semibold text-foreground">تقرير المخالفات</h3>
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              {openViolations} مفتوحة
            </span>
          </div>
          <Link
            href="/violations"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            عرض الكل
            <ArrowLeft className="size-4" />
          </Link>
        </div>
        {recentViolations.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">لا توجد مخالفات مسجلة حالياً</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 pl-3 font-medium">رقم المخالفة</th>
                  <th className="py-2 pl-3 font-medium">المخالف</th>
                  <th className="py-2 pl-3 font-medium">النوع</th>
                  <th className="py-2 pl-3 font-medium">التصنيف</th>
                  <th className="py-2 pl-3 font-medium">التاريخ</th>
                  <th className="py-2 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentViolations.map((v) => (
                  <tr key={v.id} className="text-foreground">
                    <td className="py-3 pl-3 font-mono text-xs" dir="ltr">
                      {v.documentNo || "-"}
                    </td>
                    <td className="py-3 pl-3">{v.employeeName || "-"}</td>
                    <td className="py-3 pl-3 text-muted-foreground">{v.violationType || "-"}</td>
                    <td className="py-3 pl-3 text-muted-foreground">
                      {categoryLabels[v.category ?? "internal"] ?? "-"}
                    </td>
                    <td className="py-3 pl-3 text-muted-foreground" dir="ltr">
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
            <p className="text-sm font-medium text-foreground">مرحباً {user.name}</p>
            <p className="text-xs text-muted-foreground">
              جميع بياناتك تُحفظ تلقائياً في قاعدة بيانات آمنة وخاصة بحسابك.
            </p>
          </div>
        </div>
      </Card>
    </AppShell>
  )
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
