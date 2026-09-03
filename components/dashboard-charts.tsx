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
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowDown, ArrowUp, Minus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/client"
import { detectionTypeLabels, detectionTypeOptions } from "@/lib/ai-monitoring"
import { SEVERITIES, SEVERITY_FILL, type Severity } from "@/lib/severity-colors"
import { PeriodFilter, periodMonthKeys, useChartPeriod, type ChartPeriod } from "@/components/dashboard-period"

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
}

export type DetectionTrendChartPoint = {
  monthKey: string
  byType: Record<string, number>
  converted: number
}

type TrendMode = "occurrence" | "registration"

// ينسّق "YYYY-MM" إلى اسم شهر مختصر + سنة بحسب اللغة (Intl، بلا قوائم يدوية).
function useMonthFormatter(locale: string) {
  const fmt = useMemo(
    () => new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar", { month: "short", year: "2-digit" }),
    [locale],
  )
  return (monthKey: string) => {
    const [y, m] = monthKey.split("-").map(Number)
    return fmt.format(new Date(y, (m || 1) - 1, 1))
  }
}

// اتجاه الحوادث (12 شهراً): الحوادث المسجّلة فقط — لا كشوفات ذكية هنا (لها رسم مستقل أسفله).
// مفتاح تبديل بين "شهر الوقوع" (الافتراضي) و"شهر التسجيل". الأشهر الفارغة تأتي من الخادم بقيمة 0
// حتى لا ينكسر الخط، والحالة الفارغة تظهر فقط عندما تكون كل النقاط صفراً.
// سطر الملخص أسفل الرسم يعرض مجموع السلسلة للتحقق البصري من مطابقة الأعداد.
export function IncidentTrendChart({ data }: { data: TrendChartPoint[] }) {
  const { t, locale } = useI18n()
  const [mode, setMode] = useState<TrendMode>("occurrence")
  const { period } = useChartPeriod()
  const fmtMonth = useMonthFormatter(locale)

  // الفترة المشتركة تقصّ سلسلة الـ12 شهراً القادمة من الخادم إلى النافذة المختارة.
  const rows = useMemo(() => {
    const keys = new Set(periodMonthKeys(period).current)
    return data
      .filter((p) => keys.has(p.monthKey))
      .map((p) => ({
        month: fmtMonth(p.monthKey),
        incidents: mode === "occurrence" ? p.incidentsByOccurrence : p.incidentsByRegistration,
      }))
    // fmtMonth مشتق من locale فقط
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mode, period, locale])
  const total = rows.reduce((s, r) => s + r.incidents, 0)
  const hasData = total > 0

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
        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilter />
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
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="incidents" name={t("dashboardCharts.incidentsSeries")} stroke="var(--color-chart-1)" fill="url(#gInc)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      )}

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground" aria-live="polite">
        {t("dashboardCharts.trendTotalLabel")}{" "}
        <span className="font-semibold tabular-nums text-foreground">{total.toLocaleString(locale === "en" ? "en-US" : "ar-EG")}</span>
      </p>
    </Card>
  )
}

// ألوان ثابتة لأنواع الكشوفات من مجموعة الثيم (chart-1..5)، والمحوَّلة بلون رمادي مميّز.
const DETECTION_TYPE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-primary)",
]

// اتجاه كشوفات المراقبة الذكية (12 شهراً) — أعمدة مكدّسة حسب النوع، مستبعِدة الإنذارات الكاذبة.
// الكشوفات المحوَّلة إلى حادثة/مخالفة لا تُعدّ ضمن نوعها (حُسبت في سجلّها الرسمي) وتظهر
// كشريحة منفصلة بلون مختلف حتى يبقى الرسم صادقاً بلا عدّ مزدوج.
export function DetectionTrendChart({ data }: { data: DetectionTrendChartPoint[] }) {
  const { t, locale } = useI18n()
  const fmtMonth = useMonthFormatter(locale)

  const types = useMemo(() => {
    const set = new Set<string>()
    for (const p of data) for (const k of Object.keys(p.byType)) if (p.byType[k] > 0) set.add(k)
    // ترتيب ثابت وفق قائمة الأنواع المعرَّفة، ثم أي نوع غير معروف في النهاية.
    const order = detectionTypeOptions.map((o) => o.value as string)
    return [...set].sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)))
  }, [data])

  const rows = useMemo(
    () =>
      data.map((p) => {
        const row: Record<string, string | number> = { month: fmtMonth(p.monthKey), converted: p.converted }
        for (const k of types) row[k] = p.byType[k] ?? 0
        return row
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, types, locale],
  )
  const openTotal = data.reduce((s, p) => s + Object.values(p.byType).reduce((a, b) => a + b, 0), 0)
  const convertedTotal = data.reduce((s, p) => s + p.converted, 0)
  const hasData = openTotal + convertedTotal > 0
  const showConverted = convertedTotal > 0
  const numLocale = locale === "en" ? "en-US" : "ar-EG"

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-base font-semibold text-foreground">{t("dashboardCharts.detectionTrendTitle")}</h3>
      <p className="mb-4 text-xs text-muted-foreground">{t("dashboardCharts.detectionTrendSubtitle")}</p>

      {!hasData ? (
        <div className="flex h-[260px] flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium text-foreground">{t("dashboardCharts.trendEmptyTitle")}</p>
          <p className="text-xs text-muted-foreground text-pretty">{t("dashboardCharts.detectionTrendEmptyHint")}</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
            <Legend
              verticalAlign="top"
              align={locale === "en" ? "right" : "left"}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
            />
            {types.map((k, i) => (
              <Bar
                key={k}
                dataKey={k}
                stackId="det"
                name={detectionTypeLabels[k] ?? k}
                fill={DETECTION_TYPE_COLORS[i % DETECTION_TYPE_COLORS.length]}
                radius={!showConverted && i === types.length - 1 ? [6, 6, 0, 0] : 0}
              />
            ))}
            {showConverted && (
              <Bar
                dataKey="converted"
                stackId="det"
                name={t("dashboardCharts.detectionConvertedSeries")}
                fill="var(--color-muted-foreground)"
                fillOpacity={0.45}
                radius={[6, 6, 0, 0]}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      )}

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>
          {t("dashboardCharts.detectionOpenTotalLabel")}{" "}
          <span className="font-semibold tabular-nums text-foreground">{openTotal.toLocaleString(numLocale)}</span>
        </span>
        <span>
          {t("dashboardCharts.detectionConvertedTotalLabel")}{" "}
          <span className="font-semibold tabular-nums text-foreground">{convertedTotal.toLocaleString(numLocale)}</span>
        </span>
      </p>
    </Card>
  )
}

// ===== الحوادث حسب النوع — أعمدة أفقية مكدّسة بالخطورة =====

export type IncidentTypeBreakdownPoint = {
  monthKey: string
  type: string
  severity: Severity
  total: number
  open: number
}

type TypeRow = {
  type: string
  label: string
  total: number
  open: number
  bySeverity: Record<Severity, number>
  openBySeverity: Record<Severity, number>
  previous: number
}

const zeroSev = (): Record<Severity, number> => ({ low: 0, medium: 0, high: 0, critical: 0 })

// يجمع صفوف (شهر × نوع × خطورة) في صفّ واحد لكل نوع ضمن الفترة الحالية، مع مجموع الفترة السابقة للمقارنة.
function aggregateByType(
  data: IncidentTypeBreakdownPoint[],
  period: ChartPeriod,
  labelOf: (type: string) => string,
): TypeRow[] {
  const { current, previous } = periodMonthKeys(period)
  const cur = new Set(current)
  const prev = new Set(previous)
  const map = new Map<string, TypeRow>()
  const rowFor = (type: string) => {
    let r = map.get(type)
    if (!r) {
      r = { type, label: labelOf(type), total: 0, open: 0, bySeverity: zeroSev(), openBySeverity: zeroSev(), previous: 0 }
      map.set(type, r)
    }
    return r
  }
  for (const p of data) {
    if (cur.has(p.monthKey)) {
      const r = rowFor(p.type)
      r.total += p.total
      r.open += p.open
      r.bySeverity[p.severity] += p.total
      r.openBySeverity[p.severity] += p.open
    } else if (prev.has(p.monthKey)) {
      rowFor(p.type).previous += p.total
    }
  }
  // نُبقي فقط الأنواع التي لها حوادث في الفترة الحالية، مرتبة تنازلياً.
  return [...map.values()].filter((r) => r.total > 0).sort((a, b) => b.total - a.total)
}

// مؤشر المقارنة بالفترة السابقة: أحمر عند الارتفاع (أسوأ)، أخضر عند الانخفاض (أفضل).
function DeltaBadge({ current, previous, locale }: { current: number; previous: number; locale: string }) {
  const { t } = useI18n()
  const numLocale = locale === "en" ? "en-US" : "ar-EG"
  if (previous === 0 && current === 0) return null
  if (previous === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground" title={t("dashboardCharts.deltaNoBaseline")}>
        {t("dashboardCharts.deltaNew")}
      </span>
    )
  }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
        <Minus className="size-3" aria-hidden />
        0%
      </span>
    )
  }
  const up = pct > 0
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums", up ? "text-destructive" : "text-[oklch(0.55_0.17_150)]")}
      aria-label={`${up ? t("dashboardCharts.deltaUp") : t("dashboardCharts.deltaDown")} ${Math.abs(pct)}%`}
    >
      {up ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
      {Math.abs(pct).toLocaleString(numLocale)}%
    </span>
  )
}

// أدنى عرض بصري لأي شريحة غير صفرية (بالنسبة المئوية من عرض المسار) حتى لا تختفي الفئات الصغيرة.
const MIN_SEGMENT_PCT = 2.5

export function IncidentTypeChart({ data, labels }: { data: IncidentTypeBreakdownPoint[]; labels: Record<string, string> }) {
  const { t, locale } = useI18n()
  const { period } = useChartPeriod()
  const numLocale = locale === "en" ? "en-US" : "ar-EG"

  const rows = useMemo(() => aggregateByType(data, period, (type) => labels[type] ?? type), [data, period, labels])
  const grandTotal = rows.reduce((s, r) => s + r.total, 0)
  const maxTotal = rows[0]?.total ?? 0
  const sevLabel: Record<Severity, string> = {
    low: t("severity.low"),
    medium: t("severity.medium"),
    high: t("severity.high"),
    critical: t("severity.critical"),
  }

  // نسب الشرائح داخل الصفّ: نُطبّق حدّاً أدنى للشرائح غير الصفرية ثم نعيد التطبيع حتى يبقى المجموع = طول العمود.
  const segmentsFor = (r: TypeRow) => {
    const barPct = maxTotal > 0 ? Math.max((r.total / maxTotal) * 100, MIN_SEGMENT_PCT * 2) : 0
    const raw = SEVERITIES.map((s) => ({ s, v: r.bySeverity[s] })).filter((x) => x.v > 0)
    const pcts = raw.map((x) => Math.max((x.v / r.total) * barPct, MIN_SEGMENT_PCT))
    const sum = pcts.reduce((a, b) => a + b, 0)
    return raw.map((x, i) => ({ severity: x.s, value: x.v, widthPct: (pcts[i] / sum) * barPct }))
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="mb-1 text-base font-semibold text-foreground">{t("dashboardCharts.byTypeTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("dashboardCharts.byTypeSubtitleStacked")}</p>
        </div>
        <PeriodFilter />
      </div>

      {rows.length === 0 ? (
        <div className="flex h-[260px] flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium text-foreground">{t("dashboardCharts.trendEmptyTitle")}</p>
          <p className="text-xs text-muted-foreground text-pretty">{t("dashboardCharts.byTypeEmptyHint")}</p>
        </div>
      ) : (
        <TooltipProvider delayDuration={120}>
          <ol className="flex flex-col gap-3" aria-label={t("dashboardCharts.byTypeTitle")}>
            {rows.map((r) => {
              const pctOfTotal = grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0
              const segments = segmentsFor(r)
              return (
                <li key={r.type}>
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={`/incidents?type=${encodeURIComponent(r.type)}`}
                        className="group grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 rounded-md outline-none ring-ring/50 transition-colors hover:bg-muted/60 focus-visible:ring-2 -mx-2 px-2 py-1.5"
                        aria-label={`${r.label}: ${r.total} (${pctOfTotal}%)`}
                      >
                        <span className="truncate text-sm text-foreground group-hover:underline">{r.label}</span>
                        <span className="flex h-6 items-center" aria-hidden>
                          <span className="flex h-full overflow-hidden rounded-sm bg-muted/40" style={{ width: "100%" }}>
                            {segments.map((seg, i) => (
                              <span
                                key={seg.severity}
                                className={cn("h-full transition-[width] duration-300", i === 0 && "rounded-s-sm", i === segments.length - 1 && "rounded-e-sm")}
                                style={{ width: `${seg.widthPct}%`, backgroundColor: SEVERITY_FILL[seg.severity] }}
                              />
                            ))}
                          </span>
                        </span>
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <span className="text-sm font-semibold tabular-nums text-foreground">{r.total.toLocaleString(numLocale)}</span>
                          <span className="text-[11px] tabular-nums text-muted-foreground">({pctOfTotal.toLocaleString(numLocale)}%)</span>
                          <DeltaBadge current={r.total} previous={r.previous} locale={locale} />
                        </span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="start" className="max-w-xs bg-popover text-popover-foreground border border-border shadow-md">
                      <p className="mb-1.5 text-xs font-semibold">{r.label}</p>
                      <ul className="flex flex-col gap-1 text-xs">
                        {SEVERITIES.filter((s) => r.bySeverity[s] > 0).map((s) => (
                          <li key={s} className="flex items-center justify-between gap-4">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="size-2 rounded-full" style={{ backgroundColor: SEVERITY_FILL[s] }} />
                              {sevLabel[s]}
                            </span>
                            <span className="tabular-nums">
                              {r.bySeverity[s].toLocaleString(numLocale)}
                              <span className="text-muted-foreground"> · {t("dashboardCharts.openShort")} {r.openBySeverity[s].toLocaleString(numLocale)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1.5 border-t border-border pt-1.5 text-[11px] text-muted-foreground">
                        {t("dashboardCharts.openCasesLabel")} <span className="font-semibold tabular-nums text-foreground">{r.open.toLocaleString(numLocale)}</span>
                        {" · "}
                        {t("dashboardCharts.previousPeriodLabel")} <span className="tabular-nums text-foreground">{r.previous.toLocaleString(numLocale)}</span>
                      </p>
                    </TooltipContent>
                  </UiTooltip>
                </li>
              )
            })}
          </ol>
        </TooltipProvider>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>
          {t("dashboardCharts.trendTotalLabel")}{" "}
          <span className="font-semibold tabular-nums text-foreground">{grandTotal.toLocaleString(numLocale)}</span>
        </span>
        <span className="flex flex-wrap gap-3">
          {SEVERITIES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: SEVERITY_FILL[s] }} />
              {sevLabel[s]}
            </span>
          ))}
        </span>
      </div>
    </Card>
  )
}

// هيكل تحميل بنفس أبعاد الرسم حتى لا يقفز التخطيط أثناء جلب البيانات.
export function IncidentTypeChartSkeleton() {
  return (
    <Card className="p-5" aria-busy="true">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-7 w-52" />
      </div>
      <div className="flex flex-col gap-3">
        {[85, 65, 50, 20].map((w, i) => (
          <div key={i} className="grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 py-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6" style={{ width: `${w}%` }} />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-3 w-48" />
      </div>
    </Card>
  )
}

// ===== توزيع الخطورة — دونات بمركز تفاعلي وحلقة خارجية للمفتوح/المغلق =====

type SeveritySlice = {
  severity: Severity
  label: string
  total: number
  open: number
  closed: number
  previous: number
  fill: string
}

// يجمع صفوف (شهر × نوع × خطورة) في شريحة واحدة لكل مستوى خطورة بترتيب منطقي ثابت،
// مع مجموع الفترة السابقة للمقارنة. الترتيب لا يتغيّر حسب العدد أبداً.
function aggregateBySeverity(data: IncidentTypeBreakdownPoint[], period: ChartPeriod, labelOf: (s: Severity) => string): SeveritySlice[] {
  const { current, previous } = periodMonthKeys(period)
  const cur = new Set(current)
  const prev = new Set(previous)
  const acc: Record<Severity, { total: number; open: number; previous: number }> = {
    low: { total: 0, open: 0, previous: 0 },
    medium: { total: 0, open: 0, previous: 0 },
    high: { total: 0, open: 0, previous: 0 },
    critical: { total: 0, open: 0, previous: 0 },
  }
  for (const p of data) {
    if (cur.has(p.monthKey)) {
      acc[p.severity].total += p.total
      acc[p.severity].open += p.open
    } else if (prev.has(p.monthKey)) {
      acc[p.severity].previous += p.total
    }
  }
  return SEVERITIES.map((s) => ({
    severity: s,
    label: labelOf(s),
    total: acc[s].total,
    open: acc[s].open,
    closed: acc[s].total - acc[s].open,
    previous: acc[s].previous,
    fill: SEVERITY_FILL[s],
  }))
}

export function SeverityChart({ data, criticalWithoutAction = 0 }: { data: IncidentTypeBreakdownPoint[]; criticalWithoutAction?: number }) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const { period } = useChartPeriod()
  const [active, setActive] = useState<Severity | null>(null)
  const numLocale = locale === "en" ? "en-US" : "ar-EG"
  const fmt = (n: number) => n.toLocaleString(numLocale)

  const slices = useMemo(() => aggregateBySeverity(data, period, (s) => t(`severity.${s}`)), [data, period, t])
  const total = slices.reduce((s, x) => s + x.total, 0)
  const hasData = total > 0
  const visible = slices.filter((s) => s.total > 0)

  // بيانات الحلقة الخارجية: لكل مستوى خطورة شريحتان متجاورتان (مفتوح داكن، مغلق شفاف) بنفس ترتيب الدونات.
  const ring = visible.flatMap((s) => [
    { key: `${s.severity}-open`, severity: s.severity, value: s.open, fill: s.fill, opacity: 1, kind: "open" as const },
    { key: `${s.severity}-closed`, severity: s.severity, value: s.closed, fill: s.fill, opacity: 0.3, kind: "closed" as const },
  ]).filter((x) => x.value > 0)

  const activeSlice = active ? slices.find((s) => s.severity === active) : null
  const critical = slices[3]
  const criticalDelta = critical.total - critical.previous

  const goTo = (s: Severity) => router.push(`/incidents?severity=${s}`)

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{t("dashboardCharts.severityTitle")}</h3>
        {criticalWithoutAction > 0 && (
          <Link
            href="/actions"
            className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive hover:bg-destructive/15"
            title={t("dashboardCharts.criticalNoActionHint")}
          >
            <AlertCircle className="size-3" aria-hidden />
            {t("dashboardCharts.criticalNoAction").replace("{n}", fmt(criticalWithoutAction))}
          </Link>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("dashboardCharts.severitySubtitle")}</p>
      {/* مؤشر المقارنة بالفترة السابقة للحرجة: أحمر عند الارتفاع، أخضر عند الانخفاض. */}
      {(critical.total > 0 || critical.previous > 0) && (
        <p
          className={cn(
            "mt-1 inline-flex items-center gap-1 text-[11px] font-medium tabular-nums",
            criticalDelta > 0 ? "text-destructive" : criticalDelta < 0 ? "text-[oklch(0.55_0.17_150)]" : "text-muted-foreground",
          )}
        >
          {criticalDelta > 0 ? <ArrowUp className="size-3" aria-hidden /> : criticalDelta < 0 ? <ArrowDown className="size-3" aria-hidden /> : <Minus className="size-3" aria-hidden />}
          {t("dashboardCharts.criticalDelta")
            .replace("{delta}", `${criticalDelta > 0 ? "+" : criticalDelta < 0 ? "−" : ""}${fmt(Math.abs(criticalDelta))}`)}
        </p>
      )}

      {!hasData ? (
        <div className="flex h-[240px] flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium text-foreground">{t("dashboardCharts.trendEmptyTitle")}</p>
          <p className="text-xs text-muted-foreground text-pretty">{t("dashboardCharts.byTypeEmptyHint")}</p>
        </div>
      ) : (
        <>
          <div className="relative mt-3 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                {/* الحلقة الخارجية الرفيعة: مفتوح/مغلق داخل كل مستوى */}
                <Pie data={ring} dataKey="value" cx="50%" cy="50%" innerRadius={88} outerRadius={94} startAngle={90} endAngle={-270} isAnimationActive={false} stroke="none">
                  {ring.map((r) => (
                    <Cell key={r.key} fill={r.fill} fillOpacity={active && active !== r.severity ? r.opacity * 0.3 : r.opacity} />
                  ))}
                </Pie>
                {/* الدونات الرئيسية بترتيب الخطورة الثابت */}
                <Pie
                  data={visible}
                  dataKey="total"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={82}
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  onMouseEnter={(_, i) => setActive(visible[i]?.severity ?? null)}
                  onMouseLeave={() => setActive(null)}
                  onClick={(_, i) => visible[i] && goTo(visible[i].severity)}
                  className="cursor-pointer"
                >
                  {visible.map((s) => (
                    <Cell
                      key={s.severity}
                      fill={s.fill}
                      fillOpacity={active && active !== s.severity ? 0.35 : 1}
                      style={{ transition: "fill-opacity 150ms", outline: "none" }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* المركز التفاعلي: الإجمالي افتراضياً، وعند المرور عدد الشريحة ونسبتها */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" aria-live="polite">
              {activeSlice ? (
                <>
                  <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: activeSlice.fill }}>
                    {fmt(activeSlice.total)}
                  </span>
                  <span className="mt-1 text-[11px] font-medium text-foreground">{activeSlice.label}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{fmt(Math.round((activeSlice.total / total) * 100))}%</span>
                </>
              ) : (
                <>
                  <span className="text-3xl font-bold tabular-nums leading-none text-foreground">{fmt(total)}</span>
                  <span className="mt-1 text-xs text-muted-foreground">{t("dashboardCharts.incidentUnit")}</span>
                </>
              )}
            </div>
          </div>

          {/* Legend: كل بند قابل للنقر ويبرز شريحته، مع العدد والنسبة */}
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            {slices.map((s) => {
              const pct = total > 0 ? Math.round((s.total / total) * 100) : 0
              return (
                <li key={s.severity}>
                  <button
                    type="button"
                    onClick={() => goTo(s.severity)}
                    onMouseEnter={() => setActive(s.severity)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(s.severity)}
                    onBlur={() => setActive(null)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      active === s.severity && "bg-muted/60",
                      s.total === 0 && "text-muted-foreground/60",
                    )}
                    aria-label={`${s.label}: ${s.total} (${pct}%)`}
                  >
                    <span className="inline-flex items-center gap-1.5 text-foreground">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: s.fill, opacity: s.total === 0 ? 0.4 : 1 }} />
                      {s.label}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">{fmt(s.total)}</span> ({fmt(pct)}%)
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {/* مفتاح الحلقة الخارجية + تفصيل مفتوح/مغلق */}
          <div className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
            <div className="mb-1.5 flex items-center gap-3">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-foreground/70" /> {t("dashboardCharts.openShort")}</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-foreground/25" /> {t("dashboardCharts.closedShort")}</span>
            </div>
            <ul className="flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums">
              {visible.map((s) => (
                <li key={s.severity} className="inline-flex items-center gap-1">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: s.fill }} />
                  {s.label}: <span className="text-foreground">{fmt(s.open)}</span> / {fmt(s.closed)}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Card>
  )
}

export function SeverityChartSkeleton() {
  return (
    <Card className="p-5" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-44" />
      </div>
      <div className="mt-3 flex h-[220px] items-center justify-center">
        <Skeleton className="size-44 rounded-full" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-5" />
        ))}
      </div>
    </Card>
  )
}
