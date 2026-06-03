import type { LucideIcon } from "lucide-react"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

export function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  trend,
  trendDir,
  tone = "primary",
}: {
  label: string
  value: string | number
  unit?: string
  icon: LucideIcon
  trend?: string
  trendDir?: "up" | "down"
  tone?: "primary" | "accent" | "destructive" | "blue"
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-amber-700 dark:text-amber-400",
    destructive: "bg-destructive/10 text-destructive",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  }[tone]

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={cn("flex size-10 items-center justify-center rounded-lg", toneClasses)}>
          <Icon className="size-5" />
        </div>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-bold text-foreground">{value}</span>
        {unit && <span className="mb-1 text-sm text-muted-foreground">{unit}</span>}
      </div>
      {trend && (
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            trendDir === "up" ? "text-primary" : "text-destructive",
          )}
        >
          {trendDir === "up" ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          <span>{trend}</span>
        </div>
      )}
    </Card>
  )
}
