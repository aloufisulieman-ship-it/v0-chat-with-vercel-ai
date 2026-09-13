import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { Building2, Inbox, Clock, CheckCircle2 } from "lucide-react"
import { requireModule, isOrgManager } from "@/lib/session"
import { getDepartmentsOverview } from "@/app/actions/referrals"
import { DepartmentsOverview } from "@/components/departments/departments-overview"

// نظرة عامة شاملة على كل الأقسام — مقصورة على مدير السلامة والمدير العام ومسؤول المنصّة.
export default async function DepartmentsOverviewPage() {
  const user = await requireModule("departments")
  const canSee = user.isPlatformAdmin || isOrgManager({ role: user.role, department: user.department })
  if (!canSee) redirect("/departments")

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
    <AppShell title="نظرة عامة على الأقسام" subtitle="ملخّص الإحالات الواردة لكل قسم داخل المؤسسة" user={user}>
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
