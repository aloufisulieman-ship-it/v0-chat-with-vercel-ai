"use client"

import { Card } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/client"
import { getRiskBand, RISK_BANDS, type RiskBandId } from "@/lib/labels"

// خريطة الإجراء المطلوب لكل نطاق إلى مفتاح الترجمة.
const ACTION_KEY: Record<RiskBandId, string> = {
  low: "riskMatrix.actionLow",
  medium: "riskMatrix.actionMedium",
  high: "riskMatrix.actionHigh",
  critical: "riskMatrix.actionCritical",
}
const LEGEND_KEY: Record<RiskBandId, string> = {
  low: "riskMatrix.legendLow",
  medium: "riskMatrix.legendMedium",
  high: "riskMatrix.legendHigh",
  critical: "riskMatrix.legendCritical",
}

export type MatrixCell = { likelihood: number; consequence: number }

export function RiskMatrix({
  risks,
  selected,
  onSelect,
}: {
  risks: { likelihood: number | null; consequence: number | null }[]
  selected?: MatrixCell | null
  onSelect?: (cell: MatrixCell | null) => void
}) {
  const { t } = useI18n()

  // الشدة صفوف من الأعلى (5=كارثي) للأسفل (1=طفيف)؛ الاحتمالية أعمدة RTL من اليمين (1=نادر) لليسار (5=شبه مؤكد).
  const severities = [5, 4, 3, 2, 1]
  const likelihoods = [1, 2, 3, 4, 5]

  const likelihoodLabels = [1, 2, 3, 4, 5].map((n) => t(`riskMatrix.likelihood${n}`))
  const consequenceLabels = [1, 2, 3, 4, 5].map((n) => t(`riskMatrix.consequence${n}`))

  // عدد المخاطر الفعلي في كل خلية من قاعدة البيانات.
  const counts: Record<string, number> = {}
  for (const r of risks) {
    const key = `${r.likelihood ?? 1}-${r.consequence ?? 1}`
    counts[key] = (counts[key] ?? 0) + 1
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t("riskMatrix.title")}</h3>
          <p className="mt-1 text-xs text-muted-foreground text-pretty">{t("riskMatrix.subtitle")}</p>
        </div>
        {selected && onSelect && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {t("riskMatrix.clearFilter")}
          </button>
        )}
      </div>

      {/* التمرير الأفقي على الجوال بدل انضغاط الخلايا. */}
      <div className="overflow-x-auto">
        <div className="flex min-w-[22rem] items-stretch gap-2">
          {/* محور الشدة الرأسي */}
          <div className="flex items-center">
            <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground [writing-mode:vertical-rl] rotate-180">
              {t("riskMatrix.severityAxis")}
            </span>
          </div>

          <div className="flex-1">
            {/* شبكة 6×6: عمود رأس (تسميات الشدة) + 5 أعمدة احتمالية، وصف رأس أسفلها. */}
            <div className="grid grid-cols-[5.5rem_repeat(5,minmax(3rem,1fr))] gap-1">
              {severities.map((cons) => (
                <div key={cons} className="contents">
                  <div className="flex items-center justify-end pe-1.5 text-[11px] leading-tight text-muted-foreground">
                    {consequenceLabels[cons - 1]}
                  </div>
                  {likelihoods.map((like) => {
                    const value = like * cons
                    const band = getRiskBand(value)
                    const count = counts[`${like}-${cons}`] ?? 0
                    const hasRecords = count > 0
                    const isSelected = selected?.likelihood === like && selected?.consequence === cons
                    const clickable = hasRecords && Boolean(onSelect)

                    const cellInner = (
                      <div
                        className={cn(
                          "relative flex aspect-square flex-col items-center justify-center rounded-md transition-all",
                          band.cell,
                          clickable && "cursor-pointer hover:ring-2 hover:ring-ring hover:ring-offset-1 hover:ring-offset-card",
                          isSelected && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
                          !hasRecords && "opacity-80",
                        )}
                      >
                        <span className="text-base font-bold leading-none">{value}</span>
                        <span className="mt-0.5 text-[10px] font-medium leading-none opacity-90">
                          {count}
                        </span>
                        {hasRecords && (
                          <span className="absolute end-1 top-1 size-1.5 rounded-full bg-current opacity-90" />
                        )}
                      </div>
                    )

                    const tip = (
                      <TooltipContent className="text-start">
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {t("riskMatrix.tipLevel")}: {t(LEGEND_KEY[band.id])}
                          </span>
                          <span>
                            {t("riskMatrix.tipValue")}: {value}
                          </span>
                          <span>
                            {t("riskMatrix.tipCount")}: {count}
                          </span>
                          <span>
                            {t("riskMatrix.tipAction")}: {t(ACTION_KEY[band.id])}
                          </span>
                        </div>
                      </TooltipContent>
                    )

                    return (
                      <Tooltip key={like}>
                        <TooltipTrigger asChild>
                          {clickable ? (
                            <button
                              type="button"
                              onClick={() => onSelect?.(isSelected ? null : { likelihood: like, consequence: cons })}
                              aria-pressed={isSelected}
                              className="block w-full"
                            >
                              {cellInner}
                            </button>
                          ) : (
                            <div className="w-full">{cellInner}</div>
                          )}
                        </TooltipTrigger>
                        {tip}
                      </Tooltip>
                    )
                  })}
                </div>
              ))}

              {/* صف تسميات الاحتمالية */}
              <div className="flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                {t("riskMatrix.likelihoodAxis")}
              </div>
              {likelihoodLabels.map((l, i) => (
                <div key={i} className="text-center text-[11px] leading-tight text-muted-foreground">
                  {l}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* المفتاح: أربع شارات مع مدى القيم لكل نطاق */}
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {RISK_BANDS.map((band) => (
          <span key={band.id} className="flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("size-3 rounded", band.swatch)} />
            <span className="font-medium text-foreground">{t(LEGEND_KEY[band.id])}</span>
            <span className="font-mono text-[11px] tabular-nums" dir="ltr">
              {band.min}–{band.max}
            </span>
          </span>
        ))}
      </div>
    </Card>
  )
}
