"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/client"

const tooltipStyle = {
  backgroundColor: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.5rem",
  fontSize: "12px",
  color: "var(--color-popover-foreground)",
}

function EmptyState() {
  const { t } = useI18n()
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
      {t("dashboardCharts.noData")}
    </div>
  )
}

export type TrendChartPoint = {
  monthKey: string // "YYYY-MM"
  incidentsByOccurrence: number
  incidentsByRegistration: number
  forkliftByOccurrence: number
  forkliftByRegistration: number
}

type TrendMode = "occurrence" | "registration"

// اتجاه الحوادث (12 شهراً): سلسلتان — الحوادث المسجّلة ورصد كاميرات الرافعات — مع مفتاح
// تبديل بين "شهر الوقوع" (الافتراضي) و"شهر التسجيل". الأشهر الفارغة تأتي من الخادم بقيمة 0
// حتى لا ينكسر الخط، والحالة الفارغة تظهر فقط عندما تكون كل النقاط صفراً.
export function IncidentTrendChart({ data }: { data: TrendChartPoint[] }) {
  const { t, locale } = useI18n()
  const [mode, setMode] = useState<TrendMode>("occurrence")

  const monthFmt = useMemo(
    () => new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar", { month: "short", year: "2-digit" }),
    [locale],
  )
  const rows = useMemo(
    () =>
      data.map((p) => {
        const [y, m] = p.monthKey.split("-").map(Number)
        return {
          month: monthFmt.format(new Date(y, (m || 1) - 1, 1)),
          incidents: mode === "occurrence" ? p.incidentsByOccurrence : p.incidentsByRegistration,
          forklift: mode === "occurrence" ? p.forkliftByOccurrence : p.forkliftByRegistration,
        }
      }),
    [data, mode, monthFmt],
  )
  const hasData = rows.some((r) => r.incidents > 0 || r.forklift > 0)
  const showForklift = rows.some((r) => r.forklift > 0)

  const modes: { key: TrendMode; label: string }[] = [
    { key: "occurrence", label: t("dashboardCharts.modeOccurrence") },
    { key: "registration", label: t("dashboardCharts.modeRegistration") },
  ]

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="mb-1 text-base font-semibold text-foreground">{t("dashboardCharts.trendTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {mode === "occurrence" ? t("dashboardCharts.trendSubtitleOccurrence") : t("dashboardCharts.trendSubtitleRegistration")}
          </p>
        </div>
        <div role="radiogroup" aria-label={t("dashboardCharts.modeLabel")} className="inline-flex rounded-md border border-border bg-muted p-0.5 text-xs">
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={mode === m.key}
              onClick={() => setMode(m.key)}
              className={cn(
                "rounded-[5px] px-2.5 py-1 font-medium transition-colors",
                mode === m.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="flex h-[260px] flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium text-foreground">{t("dashboardCharts.trendEmptyTitle")}</p>
          <p className="text-xs text-muted-foreground text-pretty">{t("dashboardCharts.trendEmptyHint")}</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={rows} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gFk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-chart-3)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-chart-3)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend
              verticalAlign="top"
              align={locale === "en" ? "right" : "left"}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
            />
            <Area type="monotone" dataKey="incidents" name={t("dashboardCharts.incidentsSeries")} stroke="var(--color-chart-1)" fill="url(#gInc)" strokeWidth={2} />
            {showForklift && (
              <Area type="monotone" dataKey="forklift" name={t("dashboardCharts.forkliftSeries")} stroke="var(--color-chart-3)" fill="url(#gFk)" strokeWidth={2} strokeDasharray="4 3" />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export function IncidentTypeChart({ data }: { data: { type: string; count: number }[] }) {
  const { t } = useI18n()
  return (
    <Card className="p-5">
      <h3 className="mb-1 text-base font-semibold text-foreground">{t("dashboardCharts.byTypeTitle")}</h3>
      <p className="mb-4 text-xs text-muted-foreground">{t("dashboardCharts.byTypeSubtitle")}</p>
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="type" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
            <Bar dataKey="count" name={t("dashboardCharts.countSeries")} fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export function SeverityChart({ data }: { data: { name: string; value: number; fill: string }[] }) {
  const { t } = useI18n()
  const hasData = data.some((d) => d.value > 0)
  return (
    <Card className="p-5">
      <h3 className="mb-1 text-base font-semibold text-foreground">{t("dashboardCharts.severityTitle")}</h3>
      <p className="mb-4 text-xs text-muted-foreground">{t("dashboardCharts.severitySubtitle")}</p>
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
