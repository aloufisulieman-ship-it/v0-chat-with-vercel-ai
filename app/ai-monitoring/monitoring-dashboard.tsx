"use client"

import { useMemo, useState } from "react"
import useSWR, { mutate } from "swr"
import {
  HardHat,
  TrafficCone,
  Boxes,
  Gauge,
  ShieldAlert,
  PersonStanding,
  MapPin,
  Radio,
  Camera,
  Check,
  CircleX,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  detectionTypeOptions,
  detectionStatusOptions,
  detectionStatusStyles,
  severityStyles,
  type DetectionType,
} from "@/lib/ai-monitoring"
import { updateDetectionStatus, deleteDetection } from "@/app/actions/ai-monitoring"
import { ConnectedCameras } from "./connected-cameras"
import { AcceptDetectionDialog, LinkedViolationLink } from "./accept-detection-dialog"
import { toast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n/client"
import {
  detectionTypeLabel,
  detectionStatusLabel,
  severityLabel,
} from "@/lib/i18n/labels"

// مفتاح SWR لجدول الاكتشافات — نستخدمه لإعادة الجلب فور تغيير حالة أي صف
// حتى يتحدّث الجدول مباشرةً بدل الانتظار لدورة التحديث التلقائي (10 ثوانٍ).
const DETECTIONS_KEY = "/api/ai-monitoring/detections"

export type DetectionDto = {
  id: number
  detectionId: string
  cameraId: string
  inspectorName: string
  cameraLocation: string
  detectionType: string
  // كل أنواع المخالفات المرصودة في نفس اللقطة (النوع الأساسي أولاً). تُعرض كقائمة.
  detectionTypes: string[]
  severity: string
  confidenceScore: number
  // توفّر لقطة إثبات لهذا الاكتشاف (اللقطة نفسها تُجلب عند فتح النافذة).
  hasSnapshot: boolean
  detectedAt: string
  // عدد مرات رصد نفس المخالفة المستمرة (دمج التكرار)، وآخر وقت رُصدت فيه.
  detectionCount: number
  lastDetectedAt: string
  status: string
  acknowledgedBy: string
  resolvedBy: string
  notes: string
  linkedViolationNo: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// كل أنواع المخالفات المرصودة في لقطة الصف الواحد، مع تعويض السجلات/الحمولات
// القديمة التي لا تحمل مصفوفة detectionTypes بالنوع الأساسي المفرد.
function typesOf(d: DetectionDto): string[] {
  return d.detectionTypes && d.detectionTypes.length > 0 ? d.detectionTypes : [d.detectionType]
}

const typeIcons: Record<DetectionType, LucideIcon> = {
  no_ppe: HardHat,
  traffic_congestion: TrafficCone,
  unsafe_stacking: Boxes,
  overspeed: Gauge,
  restricted_area: ShieldAlert,
  pedestrian_near_forklift: PersonStanding,
}

const typeTone: Record<DetectionType, string> = {
  no_ppe: "bg-accent/15 text-amber-700 dark:text-amber-400",
  traffic_congestion: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  unsafe_stacking: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  overspeed: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  restricted_area: "bg-destructive/10 text-destructive",
  pedestrian_near_forklift: "bg-destructive/10 text-destructive",
}

function isToday(iso: string) {
  // نقارن التاريخ بتوقيت الرياض (وليس توقيت الخادم/المتصفح) لضمان ثبات عدّاد
  // "اليوم" بين الخادم والعميل وصحّته بالنسبة للمستخدم السعودي.
  const fmt = (date: Date) =>
    date.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }) // YYYY-MM-DD
  return fmt(new Date(iso)) === fmt(new Date())
}

function timeFmt(iso: string, locale: string) {
  const d = new Date(iso)
  // نثبّت المنطقة الزمنية على توقيت الرياض ليتطابق تنسيق الخادم (UTC) مع العميل
  // (التوقيت المحلي) ويُمنع خطأ عدم تطابق الترطيب (hydration mismatch)، مع عرض
  // التوقيت السعودي الصحيح للمستخدم بغضّ النظر عن منطقة المتصفح. اللغة تحدّد
  // شكل الأرقام (عربية-هندية للعربية، لاتينية للإنجليزية).
  return d.toLocaleString(locale === "en" ? "en-US" : "ar", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Riyadh",
  })
}

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

// نافذة عرض لقطة الإثبات — تجلب صورة base64 عند الطلب (فتح النافذة) بدل تحميلها
// مع كل دورة تحديث للجدول، مع حالات تحميل/خطأ واضحة.
function SnapshotDialog({
  detectionDbId,
  typeLabel,
}: {
  detectionDbId: number
  typeLabel: string
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  async function load() {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetch(`/api/ai-monitoring/detections/${detectionDbId}/snapshot`)
      if (!res.ok) throw new Error("failed")
      const json = (await res.json()) as { snapshotUrl?: string }
      if (json.snapshotUrl) setSrc(json.snapshotUrl)
      else setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        // نجلب اللقطة أول مرة تُفتح فيها النافذة فقط.
        if (o && src === null && !loading) void load()
      }}
    >
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
          aria-label={t("aiMonitoring.evidenceSnapshot")}
        >
          <Camera className="size-3.5" />
          {t("aiMonitoring.snapshot")}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("aiMonitoring.evidenceSnapshot")} — {typeLabel}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            {t("aiMonitoring.loadingSnapshot")}
          </div>
        ) : failed || !src ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-muted text-sm text-muted-foreground">
            {t("aiMonitoring.snapshotFailed")}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src || "/placeholder.svg"}
            alt={`${t("aiMonitoring.evidenceSnapshot")} ${typeLabel}`}
            className="max-h-[70vh] w-full rounded-lg border border-border bg-muted object-contain"
            onError={() => setFailed(true)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

export function MonitoringDashboard({
  initial,
  isAdmin,
}: {
  initial: DetectionDto[]
  isAdmin: boolean
}) {
  const { t, locale } = useI18n()
  const { data } = useSWR<{ detections: DetectionDto[] }>(
    DETECTIONS_KEY,
    fetcher,
    { refreshInterval: 10000, fallbackData: { detections: initial } },
  )
  const all = data?.detections ?? initial

  const [fType, setFType] = useState("all")
  const [fSeverity, setFSeverity] = useState("all")
  const [fStatus, setFStatus] = useState("all")
  const [fCamera, setFCamera] = useState("all")
  const [fLocation, setFLocation] = useState("all")
  const [fDate, setFDate] = useState("")
  const [pending, setPending] = useState<number | null>(null)

  // عدّادات اليوم لكل نوع من الأنواع الستة — نحتسب كل نوع مرصود داخل اللقطة الواحدة
  // (البند قد يضمّ أكثر من ��خالفة) حتى تعكس الأرقام الواقع.
  const todayCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const opt of detectionTypeOptions) counts[opt.value] = 0
    for (const d of all) {
      if (!isToday(d.detectedAt)) continue
      for (const ty of typesOf(d)) counts[ty] = (counts[ty] ?? 0) + 1
    }
    return counts
  }, [all])

  // مناطق الرصد الحية: تجميع حسب موقع الكاميرا.
  const zones = useMemo(() => {
    const map = new Map<
      string,
      { location: string; total: number; open: number; worst: number }
    >()
    const sevRank: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }
    for (const d of all) {
      const key = d.cameraLocation || t("aiMonitoring.undefinedLocation")
      const z = map.get(key) ?? { location: key, total: 0, open: 0, worst: 0 }
      z.total += 1
      if (d.status === "new") z.open += 1
      z.worst = Math.max(z.worst, sevRank[d.severity] ?? 0)
      map.set(key, z)
    }
    return Array.from(map.values()).sort((a, b) => b.open - a.open || b.total - a.total)
  }, [all, t])

  // التصفية باسم المفتش/الموظف بدل معرّف الجلسة المبهم.
  const cameras = useMemo(() => {
    const set = new Set<string>()
    for (const d of all) {
      const label = d.inspectorName || d.cameraId
      if (label) set.add(label)
    }
    return Array.from(set)
  }, [all])

  // قائمة المواقع الفعلية المتاحة للتصفية.
  const locations = useMemo(() => {
    const set = new Set<string>()
    for (const d of all) if (d.cameraLocation) set.add(d.cameraLocation)
    return Array.from(set)
  }, [all])

  const filtered = useMemo(() => {
    return all.filter((d) => {
      if (fType !== "all" && !typesOf(d).includes(fType)) return false
      if (fSeverity !== "all" && d.severity !== fSeverity) return false
      if (fStatus !== "all" && d.status !== fStatus) return false
      if (fCamera !== "all" && (d.inspectorName || d.cameraId) !== fCamera) return false
      if (fLocation !== "all" && (d.cameraLocation || t("aiMonitoring.undefinedLocation")) !== fLocation) return false
      if (fDate && d.detectedAt.slice(0, 10) !== fDate) return false
      return true
    })
  }, [all, fType, fSeverity, fStatus, fCamera, fLocation, fDate, t])

  // ترتيب الخطورة الأسوأ في المنطقة — نستخدم ترجمة severity حسب اللغة.
  const worstZoneRank = ["", severityLabel(t, "low"), severityLabel(t, "medium"), severityLabel(t, "high"), severityLabel(t, "critical")]

  async function changeStatus(id: number, status: string) {
    setPending(id)
    try {
      await updateDetectionStatus(id, status)
      // إعادة جلب الجدول فوراً حتى تظهر الحالة الجديدة دون انتظار التحديث الدوري.
      await mutate(DETECTIONS_KEY)
      toast({
        title: t("aiMonitoring.statusUpdatedTitle"),
        description: status === "false_positive" ? t("aiMonitoring.fpDesc") : t("aiMonitoring.ackDesc"),
      })
    } catch (e) {
      toast({ title: t("aiMonitoring.statusUpdateFailed"), description: (e as Error).message, variant: "destructive" })
    } finally {
      setPending(null)
    }
  }

  async function remove(id: number) {
    setPending(id)
    try {
      await deleteDetection(id)
      // إعادة جلب الجدول فوراً حتى يختفي الصف المحذوف مباشرةً.
      await mutate(DETECTIONS_KEY)
      toast({ title: t("aiMonitoring.deletedTitle"), description: t("aiMonitoring.deletedDesc") })
    } catch (e) {
      toast({ title: t("aiMonitoring.deleteFailed"), description: (e as Error).message, variant: "destructive" })
    } finally {
      setPending(null)
    }
  }

  const selectCls =
    "rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"

  return (
    <div className="flex flex-col gap-6">
      {/* بطاقات KPI للأنواع الستة */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {detectionTypeOptions.map((opt) => {
          const Icon = typeIcons[opt.value as DetectionType]
          return (
            <Card key={opt.value} className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground text-balance">
                  {detectionTypeLabel(t, opt.value)}
                </span>
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    typeTone[opt.value as DetectionType],
                  )}
                >
                  <Icon className="size-5" />
                </div>
              </div>
              <div className="flex items-end gap-1.5">
                <span className="text-3xl font-bold text-foreground">
                  {todayCounts[opt.value] ?? 0}
                </span>
                <span className="mb-1 text-sm text-muted-foreground">{t("common.today")}</span>
              </div>
            </Card>
          )
        })}
      </div>

      {/* مناطق الرصد الحية */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Radio className="size-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t("aiMonitoring.liveZones")}</h2>
        </div>
        {zones.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            {t("aiMonitoring.noActiveZones")}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {zones.map((z) => (
              <Card key={z.location} className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium text-foreground">{z.location}</span>
                  </div>
                  <span
                    className={cn(
                      "flex size-2.5 shrink-0 rounded-full",
                      z.open > 0 ? "bg-destructive animate-pulse" : "bg-primary",
                    )}
                    aria-hidden="true"
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("aiMonitoring.openDetections")}</span>
                  <span className="font-bold text-foreground">{z.open}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("common.total")}</span>
                  <span className="font-medium text-foreground">{z.total}</span>
                </div>
                {z.worst > 0 && (
                  <Badge
                    text={`${t("aiMonitoring.highestSeverity")}: ${worstZoneRank[z.worst]}`}
                    className={
                      severityStyles[["", "low", "medium", "high", "critical"][z.worst]] ?? ""
                    }
                  />
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* الفلاتر */}
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <span className="text-sm font-medium text-muted-foreground">{t("aiMonitoring.filterLabel")}:</span>
        <select className={selectCls} value={fSeverity} onChange={(e) => setFSeverity(e.target.value)}>
          <option value="all">{t("aiMonitoring.allSeverities")}</option>
          {["low", "medium", "high", "critical"].map((v) => (
            <option key={v} value={v}>{severityLabel(t, v)}</option>
          ))}
        </select>
        <select className={selectCls} value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="all">{t("aiMonitoring.allTypes")}</option>
          {detectionTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{detectionTypeLabel(t, opt.value)}</option>
          ))}
        </select>
        <select className={selectCls} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="all">{t("aiMonitoring.allStatuses")}</option>
          {detectionStatusOptions.map((s) => (
            <option key={s.value} value={s.value}>{detectionStatusLabel(t, s.value)}</option>
          ))}
        </select>
        <select className={selectCls} value={fCamera} onChange={(e) => setFCamera(e.target.value)}>
          <option value="all">{t("aiMonitoring.allInspectors")}</option>
          {cameras.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select className={selectCls} value={fLocation} onChange={(e) => setFLocation(e.target.value)}>
          <option value="all">{t("aiMonitoring.allLocations")}</option>
          {locations.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <input
          type="date"
          className={selectCls}
          value={fDate}
          onChange={(e) => setFDate(e.target.value)}
          dir="ltr"
        />
        {(fType !== "all" ||
          fSeverity !== "all" ||
          fStatus !== "all" ||
          fCamera !== "all" ||
          fLocation !== "all" ||
          fDate) && (
          <button
            onClick={() => {
              setFType("all")
              setFSeverity("all")
              setFStatus("all")
              setFCamera("all")
              setFLocation("all")
              setFDate("")
            }}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("aiMonitoring.clearFilters")}
          </button>
        )}
      </Card>

      {/* الكاميرات المتصلة الآن (بث شبه حي) */}
      <ConnectedCameras isAdmin={isAdmin} />

      {/* جدول البث المباشر للاكتشافات */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("aiMonitoring.liveDetections")}</h2>
          <span className="text-xs text-muted-foreground">
            {filtered.length} {t("aiMonitoring.detectionsCount")} · {t("aiMonitoring.autoRefresh")}
          </span>
        </div>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {[
                    t("aiMonitoring.colTime"),
                    t("aiMonitoring.colInspectorLocation"),
                    t("aiMonitoring.colViolation"),
                    t("aiMonitoring.colDetectionCount"),
                    t("aiMonitoring.colSeverity"),
                    t("aiMonitoring.colConfidence"),
                    t("aiMonitoring.colEvidence"),
                    t("aiMonitoring.colStatus"),
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      {t("aiMonitoring.noMatching")}
                    </td>
                  </tr>
                ) : (
                  filtered.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="font-mono text-xs text-muted-foreground" dir="ltr">
                          {timeFmt(d.detectedAt, locale)}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground/70" dir="ltr">
                          {d.detectionId}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{d.inspectorName || d.cameraId || "-"}</div>
                        <div className="text-xs text-muted-foreground">{d.cameraLocation || "-"}</div>
                      </td>
                      <td className="px-4 py-3">
                        {/* كل أنواع المخالفات المرصودة في نفس اللقطة كقائمة داخل البند الواحد */}
                        {typesOf(d).length > 1 ? (
                          <div className="flex flex-col gap-1">
                            {typesOf(d).map((ty) => (
                              <span
                                key={ty}
                                className="inline-flex w-fit items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                              >
                                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                                {detectionTypeLabel(t, ty)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="font-medium text-foreground">
                            {detectionTypeLabel(t, d.detectionType)}
                          </span>
                        )}
                        {d.notes && (
                          <div className="mt-1 text-xs text-muted-foreground line-clamp-1 max-w-[16rem]">
                            {d.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {/* عدد مرات الرصد المتكرر لنفس المخالفة المستمرة (بدل صفوف مكررة) */}
                        <span
                          className={
                            d.detectionCount > 1
                              ? "inline-flex min-w-8 items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary"
                              : "inline-flex min-w-8 items-center justify-center font-mono text-xs text-muted-foreground"
                          }
                          title={
                            d.detectionCount > 1
                              ? `${t("aiMonitoring.lastSeen")}: ${timeFmt(d.lastDetectedAt, locale)}`
                              : undefined
                          }
                          dir="ltr"
                        >
                          {d.detectionCount > 1 ? `×${d.detectionCount}` : "1"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          text={severityLabel(t, d.severity)}
                          className={severityStyles[d.severity] ?? ""}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold" dir="ltr">
                          {d.confidenceScore}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {d.hasSnapshot ? (
                          <SnapshotDialog
                            detectionDbId={d.id}
                            typeLabel={detectionTypeLabel(t, d.detectionType)}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          text={detectionStatusLabel(t, d.status)}
                          className={detectionStatusStyles[d.status] ?? ""}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {d.status === "converted" && d.linkedViolationNo ? (
                            <LinkedViolationLink documentNo={d.linkedViolationNo} />
                          ) : null}
                          {(d.status === "new" || d.status === "acknowledged") && (
                            <>
                              {d.status === "new" && (
                                <button
                                  onClick={() => changeStatus(d.id, "acknowledged")}
                                  disabled={pending === d.id}
                                  className="rounded-md p-1.5 text-amber-600 hover:bg-muted disabled:opacity-50"
                                  title={t("aiMonitoring.markAcknowledged")}
                                >
                                  <Check className="size-4" />
                                </button>
                              )}
                              {/* قبول: يفتح نافذة القبول أو التحويل إلى مخالفة */}
                              <AcceptDetectionDialog detection={d} />
                              {/* رفض: إنذار خاطئ — بدون نافذة */}
                              <button
                                onClick={() => changeStatus(d.id, "false_positive")}
                                disabled={pending === d.id}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
                                title={t("aiMonitoring.markFalsePositive")}
                              >
                                <CircleX className="size-4" />
                              </button>
                            </>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => remove(d.id)}
                              disabled={pending === d.id}
                              className="rounded-md p-1.5 text-destructive hover:bg-muted disabled:opacity-50"
                              title={t("aiMonitoring.deleteDetection")}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
