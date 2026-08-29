"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import {
  Truck,
  MapPin,
  AlertTriangle,
  ChevronDown,
  Search,
  BadgeCheck,
  HelpCircle,
  Radio,
  Clock,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { severityStyles, detectionStatusStyles } from "@/lib/ai-monitoring"
import { equipmentTypeLabels } from "@/lib/labels"
import { useI18n } from "@/lib/i18n/client"
import { detectionTypeLabel, detectionStatusLabel, severityLabel } from "@/lib/i18n/labels"
import { timeFmt, isToday } from "./monitoring-dashboard"
import type { TrackedVehicle } from "@/app/actions/ai-monitoring"

const TRACKING_KEY = "/api/ai-monitoring/vehicle-tracking"
const fetcher = (url: string) => fetch(url).then((r) => r.json())

function Badge({ text, className }: { text: string; className: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      {text}
    </span>
  )
}

export function VehicleTracking({ initial }: { initial: TrackedVehicle[] }) {
  const { t, locale } = useI18n()
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data } = useSWR<{ vehicles: TrackedVehicle[] }>(TRACKING_KEY, fetcher, {
    fallbackData: { vehicles: initial },
    refreshInterval: 10_000,
    revalidateOnFocus: false,
  })
  const vehicles = data?.vehicles ?? initial

  // مؤشرات عامة.
  const kpis = useMemo(() => {
    const seenToday = vehicles.filter((v) => v.lastSeenAt && isToday(v.lastSeenAt)).length
    const openViolations = vehicles.reduce((s, v) => s + v.openViolations, 0)
    const unregistered = vehicles.filter((v) => !v.registered).length
    return { total: vehicles.length, seenToday, openViolations, unregistered }
  }, [vehicles])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return vehicles
    return vehicles.filter((v) =>
      [v.plate, v.ownerCompany, v.driverName, v.internalCode]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(q)),
    )
  }, [vehicles, query])

  const kpiCards = [
    { label: t("vehicleTracking.kpiTotal"), value: kpis.total, icon: Truck, tone: "bg-primary/10 text-primary" },
    { label: t("vehicleTracking.kpiSeenToday"), value: kpis.seenToday, icon: Radio, tone: "bg-primary/10 text-primary" },
    { label: t("vehicleTracking.kpiOpenViolations"), value: kpis.openViolations, icon: AlertTriangle, tone: "bg-destructive/10 text-destructive" },
    { label: t("vehicleTracking.kpiUnregistered"), value: kpis.unregistered, icon: HelpCircle, tone: "bg-muted text-muted-foreground" },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* مؤشرات */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <Card key={k.label} className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground text-balance">{k.label}</span>
              <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", k.tone)}>
                <k.icon className="size-5" />
              </div>
            </div>
            <span className="text-3xl font-bold text-foreground">{k.value}</span>
          </Card>
        ))}
      </div>

      {/* البحث */}
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="relative flex-1 min-w-[16rem]">
          <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("vehicleTracking.searchPlaceholder")}
            className="h-10 w-full rounded-lg border border-border bg-background px-9 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} {t("vehicleTracking.vehiclesCount")} · {t("aiMonitoring.autoRefresh")}
        </span>
      </Card>

      {/* قائمة المركبات */}
      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">{t("vehicleTracking.empty")}</Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((v) => {
            const isOpen = expanded === v.key
            return (
              <Card key={v.key} className="overflow-hidden p-0">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : v.key)}
                  className="flex w-full items-center gap-4 p-4 text-start transition-colors hover:bg-muted/50"
                  aria-expanded={isOpen}
                >
                  {/* أيقونة الحالة */}
                  <div
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-lg",
                      v.registered ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Truck className="size-5" />
                  </div>

                  {/* اللوحة والبيانات */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-foreground" dir="ltr">
                        {v.plate}
                      </span>
                      {v.registered ? (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <BadgeCheck className="size-3.5" />
                          {equipmentTypeLabels[v.equipmentType] || v.equipmentType}
                        </span>
                      ) : (
                        <Badge text={t("vehicleTracking.unregistered")} className="border-border bg-muted text-muted-foreground" />
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {v.registered
                        ? [v.ownerCompany, v.driverName, v.internalCode].filter(Boolean).join(" · ") ||
                          t("vehicleTracking.noDetails")
                        : t("vehicleTracking.notInRegistry")}
                    </div>
                  </div>

                  {/* آخر ظهور */}
                  <div className="hidden shrink-0 text-end sm:block">
                    {v.lastSeenAt ? (
                      <>
                        <div className="flex items-center justify-end gap-1 text-xs font-medium text-foreground">
                          <MapPin className="size-3.5 text-muted-foreground" />
                          {v.lastSeenLocation || "—"}
                        </div>
                        <div className="mt-0.5 flex items-center justify-end gap-1 font-mono text-xs text-muted-foreground" dir="ltr">
                          <Clock className="size-3 text-muted-foreground" />
                          {timeFmt(v.lastSeenAt, locale)}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("vehicleTracking.neverSeen")}</span>
                    )}
                  </div>

                  {/* عدّادات */}
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className="inline-flex min-w-8 items-center justify-center rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-bold text-foreground"
                      title={t("vehicleTracking.totalSightings")}
                      dir="ltr"
                    >
                      {v.totalSightings}
                    </span>
                    {v.openViolations > 0 && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive"
                        title={t("vehicleTracking.openViolations")}
                      >
                        <AlertTriangle className="size-3" />
                        {v.openViolations}
                      </span>
                    )}
                    <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </div>
                </button>

                {/* سجل الظهور */}
                {isOpen && (
                  <div className="border-t border-border bg-muted/30 p-4">
                    {v.sightings.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground">{t("vehicleTracking.noSightings")}</p>
                    ) : (
                      <ol className="flex flex-col gap-2">
                        {v.sightings.map((s) => (
                          <li
                            key={s.detectionId}
                            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card p-3 text-sm"
                          >
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              <MapPin className="size-3.5 text-muted-foreground" />
                              {s.location || "—"}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                              {timeFmt(s.at, locale)}
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-foreground">
                              {s.detectionTypes.map((dt) => detectionTypeLabel(t, dt)).join("، ")}
                            </span>
                            {s.count > 1 && (
                              <span className="font-mono text-xs font-bold text-primary" dir="ltr">
                                ×{s.count}
                              </span>
                            )}
                            <span className="flex items-center gap-1.5 ltr:ml-auto rtl:mr-auto">
                              <Badge text={severityLabel(t, s.severity)} className={severityStyles[s.severity] ?? ""} />
                              <Badge text={detectionStatusLabel(t, s.status)} className={detectionStatusStyles[s.status] ?? ""} />
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
