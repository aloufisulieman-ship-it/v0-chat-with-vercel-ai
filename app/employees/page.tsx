import { getEmployees } from "@/app/actions/hse"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { requireModule } from "@/lib/session"
import { Users, UserCheck, UserRoundSearch } from "lucide-react"
import { EmployeeRegistry } from "@/app/training/employee-registry"

export default async function EmployeesPage() {
  const user = await requireModule("training")
  const employees = await getEmployees()
  const active = employees.filter((item) => item.active).length
  const incomplete = employees.filter((item) => item.profileStatus !== "complete").length

  return (
    <AppShell title="سجل الموظفين" subtitle="المصدر المركزي لبيانات الموظفين والحضور والمخالفات" user={user}>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="إجمالي الموظفين" value={employees.length} icon={Users} tone="blue" />
        <KpiCard label="الموظفون النشطون" value={active} icon={UserCheck} tone="primary" />
        <KpiCard label="ملفات غير مكتملة" value={incomplete} icon={UserRoundSearch} tone="accent" />
      </div>
      <EmployeeRegistry employees={employees} />
    </AppShell>
  )
}
