import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const likelihoodLabels = ["نادر", "غير محتمل", "ممكن", "محتمل", "شبه مؤكد"]
const consequenceLabels = ["طفيف", "بسيط", "متوسط", "كبير", "كارثي"]

function cellColor(score: number) {
  if (score >= 15) return "bg-destructive/80 text-white"
  if (score >= 10) return "bg-orange-500/80 text-white"
  if (score >= 5) return "bg-accent/80 text-amber-950"
  return "bg-primary/70 text-white"
}

export function RiskMatrix({ risks }: { risks: { likelihood: number | null; consequence: number | null }[] }) {
  // عدد المخاطر في كل خلية
  const counts: Record<string, number> = {}
  for (const r of risks) {
    const key = `${r.likelihood ?? 1}-${r.consequence ?? 1}`
    counts[key] = (counts[key] ?? 0) + 1
  }

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-base font-semibold text-foreground">مصفوفة تقييم المخاطر 5×5</h3>
      <p className="mb-4 text-xs text-muted-foreground">الاحتمالية (أفقي) × الشدة (رأسي)</p>
      <div className="overflow-x-auto">
        <div className="flex items-stretch gap-1">
          <div className="flex items-center">
            <span className="rotate-180 whitespace-nowrap text-xs font-medium text-muted-foreground [writing-mode:vertical-rl]">
              الشدة ←
            </span>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-[auto_repeat(5,1fr)] gap-1">
              {[5, 4, 3, 2, 1].map((cons) => (
                <div key={cons} className="contents">
                  <div className="flex w-16 items-center justify-end pl-1 text-[10px] text-muted-foreground">
                    {consequenceLabels[cons - 1]}
                  </div>
                  {[1, 2, 3, 4, 5].map((like) => {
                    const score = cons * like
                    const count = counts[`${like}-${cons}`] ?? 0
                    return (
                      <div
                        key={like}
                        className={cn(
                          "flex aspect-square min-w-10 items-center justify-center rounded-md text-sm font-bold",
                          cellColor(score),
                        )}
                      >
                        {count > 0 ? count : <span className="opacity-40">{score}</span>}
                      </div>
                    )
                  })}
                </div>
              ))}
              <div className="flex w-16 items-center justify-end" />
              {likelihoodLabels.map((l, i) => (
                <div key={i} className="text-center text-[10px] text-muted-foreground">
                  {l}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <Legend className="bg-primary/70" label="منخفض" />
        <Legend className="bg-accent/80" label="متوسط" />
        <Legend className="bg-orange-500/80" label="عالٍ" />
        <Legend className="bg-destructive/80" label="حرج" />
      </div>
    </Card>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded", className)} />
      {label}
    </span>
  )
}
