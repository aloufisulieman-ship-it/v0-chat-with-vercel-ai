import { getEmployees } from "@/app/actions/hse"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { requireModule } from "@/lib/session"
import { Users, UserCheck, UserRoundSearch } from "lucide-react"
import { EmployeeRegistry } from "@/app/training/employee-registry"
import { getServerT } from "@/lib/i18n/server"

export default async function EmployeesPage() {
  const user = await requireModule("training")
  const employees = await getEmployees()
  const active = employees.filter((item) => item.active).length
  const incomplete = employees.filter((item) => item.profileStatus !== "complete").length
  const { t } = await getServerT()

  return (
    <AppShell title={t("pageHeaders.employeesTitle")} subtitle={t("pageHeaders.employeesSubtitle")} user={user}>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label={t("employees.totalEmployees")} value={employees.length} icon={Users} tone="blue" />
        <KpiCard label={t("employees.activeEmployees")} value={active} icon={UserCheck} tone="primary" />
        <KpiCard label={t("employees.incompleteProfiles")} value={incomplete} icon={UserRoundSearch} tone="accent" />
      </div>
      <EmployeeRegistry employees={employees} />
    </AppShell>
  )
}
