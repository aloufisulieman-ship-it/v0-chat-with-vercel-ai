"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/client"

// فترة عرض مشتركة بين رسوم لوحة التحكم (الاتجاه + الحوادث حسب النوع): تغيير واحد يحرّك الرسمَين معاً.
export type ChartPeriod = "3m" | "6m" | "12m" | "ytd"
export const CHART_PERIODS: ChartPeriod[] = ["3m", "6m", "12m", "ytd"]

type PeriodCtx = { period: ChartPeriod; setPeriod: (p: ChartPeriod) => void }
const Ctx = createContext<PeriodCtx | null>(null)

export function ChartPeriodProvider({ children, initial = "12m" }: { children: ReactNode; initial?: ChartPeriod }) {
  const [period, setPeriod] = useState<ChartPeriod>(initial)
  const value = useMemo(() => ({ period, setPeriod }), [period])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useChartPeriod(): PeriodCtx {
  const ctx = useContext(Ctx)
  // خارج المزوّد (مثل صفحة التقارير) يعمل الرسم بفترة 12 شهراً ثابتة.
  const [local, setLocal] = useState<ChartPeriod>("12m")
  return ctx ?? { period: local, setPeriod: setLocal }
}

// مفاتيح أشهر الفترة الحالية والفترة السابقة المقابلة، بصيغة "YYYY-MM"، من الأقدم إلى الأحدث.
// 3m/6m/12m = آخر N شهراً شاملةً الشهر الحالي؛ ytd = من يناير إلى الشهر الحالي، والسابقة = نفس الأشهر من السنة الماضية.
export function periodMonthKeys(period: ChartPeriod, now = new Date()): { current: string[]; previous: string[] } {
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  const monthsBack = (count: number, offset: number) => {
    const out: string[] = []
    for (let k = count - 1 + offset; k >= offset; k--) out.push(key(new Date(now.getFullYear(), now.getMonth() - k, 1)))
    return out
  }
  if (period === "ytd") {
    const n = now.getMonth() + 1
    const current = monthsBack(n, 0)
    const previous = current.map((k) => `${Number(k.slice(0, 4)) - 1}${k.slice(4)}`)
    return { current, previous }
  }
  const n = period === "3m" ? 3 : period === "6m" ? 6 : 12
  return { current: monthsBack(n, 0), previous: monthsBack(n, n) }
}

// مفتاح تبديل الفترة — نفس نمط مفتاح "الوقوع/التسجيل" في رسم الاتجاه للاتساق البصري.
export function PeriodFilter({ className }: { className?: string }) {
  const { t } = useI18n()
  const { period, setPeriod } = useChartPeriod()
  const labels: Record<ChartPeriod, string> = {
    "3m": t("dashboardCharts.period3m"),
    "6m": t("dashboardCharts.period6m"),
    "12m": t("dashboardCharts.period12m"),
    ytd: t("dashboardCharts.periodYtd"),
  }
  return (
    <div
      role="radiogroup"
      aria-label={t("dashboardCharts.periodLabel")}
      className={cn("inline-flex rounded-md border border-border bg-muted p-0.5 text-xs", className)}
    >
      {CHART_PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={period === p}
          onClick={() => setPeriod(p)}
          className={cn(
            "rounded-[5px] px-2.5 py-1 font-medium tabular-nums transition-colors",
            period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {labels[p]}
        </button>
      ))}
    </div>
  )
}
