import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { Building2, Inbox, Clock, CheckCircle2 } from "lucide-react"
import { requireModule } from "@/lib/session"
import { getDepartmentsOverview } from "@/app/actions/referrals"
import { DepartmentsOverview } from "@/components/departments/departments-overview"

// مركز الأقسام: نظرة عامة على الإحالات الواردة لكل قسم داخل المؤسسة. مصدر واحد للحقيقة
// للإحالات بين الأقسام (يحل محل مسارَي HR/المالية المنفصلين مستقبلاً).
export default async function DepartmentsPage() {
  const user = await requireModule("departments")
  const departments = await getDepartmentsOverview()

  const totals = departments.reduce(
    (acc, d) => {
      acc.open += d.stats.open
      acc.overdue += d.stats.overdue
      acc.closed += d.stats.closed
      return acc
    },
    { open: 0, overdue: 0, closed: 0 },
  )

  return (
    <AppShell title="مركز الأقسام" subtitle="إدارة الإحالات بين الأقسام ومتابعة معالجتها" user={user}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="الأقسام" value={departments.length} icon={Building2} tone="blue" />
        <KpiCard label="إحالات مفتوحة" value={totals.open} icon={Inbox} tone="primary" />
        <KpiCard label="إحالات متأخرة" value={totals.overdue} icon={Clock} tone="destructive" />
        <KpiCard label="إحالات مغلقة" value={totals.closed} icon={CheckCircle2} tone="accent" />
      </div>

      <div className="mt-6">
        <DepartmentsOverview departments={departments} />
      </div>
    </AppShell>
  )
}
