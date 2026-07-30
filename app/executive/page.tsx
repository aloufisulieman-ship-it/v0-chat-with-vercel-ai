import type { Metadata } from "next"
import { ExecutiveHeader } from "@/components/executive/header"
import { KpiRow } from "@/components/executive/kpi-row"
import { IncidentTrendChart, ViolationDonutChart, MonthlyPerformanceChart } from "@/components/executive/charts"
import { RiskAreasList, RecentTasksList, ProjectsList } from "@/components/executive/lists"
import { palette } from "@/components/executive/mock-data"

export const metadata: Metadata = {
  title: "لوحة HSE التنفيذية | المدير",
  description: "لوحة تحكم تنفيذية لمؤشرات الصحة والسلامة والبيئة في السوق المركزي",
}

export default function ExecutiveDashboardPage() {
  return (
    <div dir="rtl" className="min-h-screen" style={{ backgroundColor: palette.bg }}>
      <ExecutiveHeader />

      <main className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-balance" style={{ color: palette.text }}>
            لوحة HSE التنفيذية
          </h1>
          <p className="mt-1 text-sm text-pretty" style={{ color: palette.muted }}>
            نظرة شاملة على أداء الصحة والسلامة والبيئة في السوق المركزي
          </p>
        </div>

        {/* صف مؤشرات الأداء */}
        <KpiRow />

        {/* صف الرسوم البيانية */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <IncidentTrendChart />
          </div>
          <ViolationDonutChart />
          <RiskAreasList />
        </div>

        {/* الصف السفلي */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <RecentTasksList />
          <ProjectsList />
          <MonthlyPerformanceChart />
        </div>
      </main>
    </div>
  )
}
