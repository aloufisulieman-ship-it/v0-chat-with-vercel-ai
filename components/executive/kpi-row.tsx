import { AlertTriangle, ShieldCheck, Zap, GraduationCap, TrendingUp, TrendingDown } from "lucide-react"
import { kpis, palette, type Kpi } from "./mock-data"

const iconMap: Record<Kpi["icon"], typeof AlertTriangle> = {
  alert: AlertTriangle,
  shield: ShieldCheck,
  near: Zap,
  training: GraduationCap,
}

export function KpiRow() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = iconMap[kpi.icon]
        const isPositive = kpi.goodWhenUp ? kpi.delta >= 0 : kpi.delta < 0
        const Arrow = kpi.delta >= 0 ? TrendingUp : TrendingDown
        return (
          <div
            key={kpi.id}
            className="group rounded-xl border p-5 transition-shadow hover:shadow-lg hover:shadow-black/30"
            style={{ backgroundColor: palette.card, borderColor: palette.divider }}
          >
            <div className="flex items-start justify-between">
              <div
                className="flex size-11 items-center justify-center rounded-lg"
                style={{ backgroundColor: palette.accentSoft, color: palette.accent }}
              >
                <Icon className="size-5" />
              </div>
              <div
                className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold"
                style={{
                  color: isPositive ? palette.green : palette.red,
                  backgroundColor: isPositive ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                }}
              >
                <Arrow className="size-3.5" />
                <span dir="ltr">{`${kpi.delta > 0 ? "+" : ""}${kpi.delta}%`}</span>
              </div>
            </div>
            <p className="mt-4 text-3xl font-bold" style={{ color: palette.text }}>
              {kpi.value}
            </p>
            <p className="mt-1 text-sm" style={{ color: palette.muted }}>
              {kpi.label}
            </p>
          </div>
        )
      })}
    </div>
  )
}
