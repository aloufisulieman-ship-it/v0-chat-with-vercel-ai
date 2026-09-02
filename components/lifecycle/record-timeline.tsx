"use client"

import useSWR from "swr"
import { Loader2 } from "lucide-react"
import { getRecordEvents } from "@/app/actions/lifecycle"
import { deptLabel, eventLabel, lifecycleLabel, lifecycleUi, normalizeLifecycle, type LifecycleModule } from "@/lib/lifecycle"

type L = "ar" | "en"

// سجل الحركة (تدقيق) لسجل واحد — يُحمَّل عند الطلب عبر SWR داخل نافذة التفاصيل.
export function RecordTimeline({
  module,
  recordId,
  locale = "ar",
  enabled = true,
}: {
  module: LifecycleModule
  recordId: number
  locale?: L
  enabled?: boolean
}) {
  const s = lifecycleUi(locale)
  const { data, isLoading } = useSWR(enabled ? ["record-events", module, recordId] : null, () =>
    getRecordEvents(module, recordId),
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }
  if (!data?.length) return <p className="py-6 text-center text-sm text-muted-foreground">{s.noEvents}</p>

  const fmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <ol className="flex flex-col gap-3">
      {data.map((ev) => {
        let meta: Record<string, unknown> = {}
        try {
          meta = ev.meta ? JSON.parse(ev.meta) : {}
        } catch {
          meta = {}
        }
        const dept = typeof meta.dept === "string" ? deptLabel(meta.dept, locale) : ""
        return (
          <li key={ev.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="mt-1.5 size-2.5 rounded-full bg-primary" aria-hidden />
              <span className="w-px flex-1 bg-border" aria-hidden />
            </div>
            <div className="flex flex-1 flex-col gap-0.5 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{eventLabel(ev.event, locale)}</span>
                {dept && <span className="text-xs text-muted-foreground">({dept})</span>}
                {ev.toStatus && (
                  <span className="text-xs text-muted-foreground">
                    → {lifecycleLabel(normalizeLifecycle(ev.toStatus), locale)}
                  </span>
                )}
              </div>
              {ev.note && <p className="text-sm text-muted-foreground">{ev.note}</p>}
              <p className="text-xs text-muted-foreground">
                {fmt.format(new Date(ev.createdAt))}
                {ev.userName ? ` · ${s.by} ${ev.userName}` : ""}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
