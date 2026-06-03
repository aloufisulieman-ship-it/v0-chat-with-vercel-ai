"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { Card } from "@/components/ui/card"

const tooltipStyle = {
  backgroundColor: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.5rem",
  fontSize: "12px",
  color: "var(--color-popover-foreground)",
}

function EmptyState() {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
      لا توجد بيانات كافية لعرض الرسم البياني بعد
    </div>
  )
}

export function IncidentTrendChart({ data }: { data: { month: string; incidents: number }[] }) {
  return (
    <Card className="p-5">
      <h3 className="mb-1 text-base font-semibold text-foreground">اتجاه الحوادث</h3>
      <p className="mb-4 text-xs text-muted-foreground">حسب شهر التسجيل</p>
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="incidents" name="حوادث" stroke="var(--color-chart-1)" fill="url(#gInc)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export function IncidentTypeChart({ data }: { data: { type: string; count: number }[] }) {
  return (
    <Card className="p-5">
      <h3 className="mb-1 text-base font-semibold text-foreground">الحوادث حسب النوع</h3>
      <p className="mb-4 text-xs text-muted-foreground">التصنيف العام</p>
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="type" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
            <Bar dataKey="count" name="العدد" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export function SeverityChart({ data }: { data: { name: string; value: number; fill: string }[] }) {
  const hasData = data.some((d) => d.value > 0)
  return (
    <Card className="p-5">
      <h3 className="mb-1 text-base font-semibold text-foreground">توزيع الخطورة</h3>
      <p className="mb-4 text-xs text-muted-foreground">حسب مستوى الحادثة</p>
      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {data.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                {s.name} ({s.value})
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
