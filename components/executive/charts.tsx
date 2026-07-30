"use client"

import { useState } from "react"
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
  Legend,
} from "recharts"
import { incidentTrend, violationsByType, monthlyPerformance, palette } from "./mock-data"

const tooltipStyle = {
  backgroundColor: palette.card,
  border: `1px solid ${palette.divider}`,
  borderRadius: "0.5rem",
  fontSize: "12px",
  color: palette.text,
}

const axisTick = { fontSize: 11, fill: palette.muted }

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl border p-5 transition-shadow hover:shadow-lg hover:shadow-black/30"
      style={{ backgroundColor: palette.card, borderColor: palette.divider }}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold" style={{ color: palette.text }}>
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs" style={{ color: palette.muted }}>
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export function IncidentTrendChart() {
  const [period, setPeriod] = useState("6m")
  return (
    <Panel
      title="اتجاه الحوادث"
      subtitle="آخر 6 أشهر"
      action={
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border px-2 py-1.5 text-xs outline-none"
          style={{ backgroundColor: palette.bg, borderColor: palette.divider, color: palette.text }}
          aria-label="اختيار الفترة"
        >
          <option value="3m">آخر 3 أشهر</option>
          <option value="6m">آخر 6 أشهر</option>
          <option value="12m">آخر 12 شهر</option>
        </select>
      }
    >
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={incidentTrend} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="gTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={palette.accent} stopOpacity={0.5} />
              <stop offset="95%" stopColor={palette.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.divider} vertical={false} />
          <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area
            type="monotone"
            dataKey="incidents"
            name="الحوادث"
            stroke={palette.accent}
            fill="url(#gTrend)"
            strokeWidth={2.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Panel>
  )
}

export function ViolationDonutChart() {
  const total = violationsByType.reduce((s, d) => s + d.value, 0)
  return (
    <Panel title="توزيع المخالفات" subtitle="حسب النوع">
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={violationsByType}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={3}
              stroke="none"
            >
              {violationsByType.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color: palette.text }}>
            {total}
          </span>
          <span className="text-xs" style={{ color: palette.muted }}>
            إجمالي المخالفات
          </span>
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {violationsByType.map((d) => (
          <li key={d.name} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2" style={{ color: palette.muted }}>
              <span className="size-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
              {d.name}
            </span>
            <span className="font-semibold" style={{ color: palette.text }}>
              {d.value}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function MonthlyPerformanceChart() {
  return (
    <Panel title="ملخص الأداء الشهري" subtitle="الحوادث مقابل الإجراءات التصحيحية">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={monthlyPerformance} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.divider} vertical={false} />
          <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
          <Legend wrapperStyle={{ fontSize: 12, color: palette.muted }} />
          <Bar dataKey="incidents" name="الحوادث" fill={palette.red} radius={[5, 5, 0, 0]} />
          <Bar dataKey="actions" name="الإجراءات التصحيحية" fill={palette.accent} radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  )
}
