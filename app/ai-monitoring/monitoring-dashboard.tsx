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
  detectionTypeLabels,
  detectionStatusOptions,
  detectionStatusLabels,
  detectionStatusStyles,
  severityLabels,
  severityStyles,
  type DetectionType,
} from "@/lib/ai-monitoring"
import { updateDetectionStatus, deleteDetection } from "@/app/actions/ai-monitoring"
import { ConnectedCameras } from "./connected-cameras"
import { AcceptDetectionDialog, LinkedViolationLink } from "./accept-detection-dialog"
import { toast } from "@/hooks/use-toast"

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

function timeFmt(iso: string) {
  const d = new Date(iso)
  // نثبّت المنطقة الزمنية على توقيت الرياض ليتطابق تنسيق الخادم (UTC) مع العميل
  // (التوقيت المحلي) ويُمنع خطأ عدم تطابق الترطيب (hydration mismatch)، مع عرض
  // التوقيت السعودي الصحيح للمستخدم بغضّ النظر عن منطقة المتصفح.
  return d.toLocaleString("ar", {
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
          aria-label="عرض لقطة الإثبات"
        >
          <Camera className="size-3.5" />
          لقطة
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>لقطة الإثبات — {typeLabel}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            جارٍ تحميل اللقطة…
          </div>
        ) : failed || !src ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-muted text-sm text-muted-foreground">
            تعذّر تحميل لقطة الإثبات.
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src || "/placeholder.svg"}
            alt={`لقطة إثبات ${typeLabel}`}
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
  // (البند قد يضمّ أكثر من مخالفة) حتى تعكس الأرقام الواقع.
  const todayCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of detectionTypeOptions) counts[t.value] = 0
    for (const d of all) {
      if (!isToday(d.detectedAt)) continue
      for (const t of typesOf(d)) counts[t] = (counts[t] ?? 0) + 1
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
      const key = d.cameraLocation || "موقع غير محدد"
      const z = map.get(key) ?? { location: key, total: 0, open: 0, worst: 0 }
      z.total += 1
      if (d.status === "new") z.open += 1
      z.worst = Math.max(z.worst, sevRank[d.severity] ?? 0)
      map.set(key, z)
    }
    return Array.from(map.values()).sort((a, b) => b.open - a.open || b.total - a.total)
  }, [all])

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
      if (fLocation !== "all" && (d.cameraLocation || "موقع غير محدد") !== fLocation) return false
      if (fDate && d.detectedAt.slice(0, 10) !== fDate) return false
      return true
    })
  }, [all, fType, fSeverity, fStatus, fCamera, fLocation, fDate])

  const worstZoneRank = ["", "منخفض", "متوسط", "عالٍ", "حرج"]

  async function changeStatus(id: number, status: string) {
    setPending(id)
    try {
      await updateDetectionStatus(id, status)
      // إعادة جلب الجدول فوراً حتى تظهر الحالة الجديدة دون انتظار التحديث الدوري.
      await mutate(DETECTIONS_KEY)
      toast({
        title: "تم تحديث الحالة",
        description: status === "false_positive" ? "تم وضع الاكتشاف كإنذار خاطئ." : "تم وضع الاكتشاف كـ «تم الاطّلاع».",
      })
    } catch (e) {
      toast({ title: "تعذّر تحديث الحالة", description: (e as Error).message, variant: "destructive" })
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
      toast({ title: "تم الحذف", description: "تم حذف الاكتشاف نهائياً." })
    } catch (e) {
      toast({ title: "تعذّر الحذف", description: (e as Error).message, variant: "destructive" })
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
        {detectionTypeOptions.map((t) => {
          const Icon = typeIcons[t.value as DetectionType]
          return (
            <Card key={t.value} className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground text-balance">
                  {t.label}
                </span>
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    typeTone[t.value as DetectionType],
                  )}
                >
                  <Icon className="size-5" />
                </div>
              </div>
              <div className="flex items-end gap-1.5">
                <span className="text-3xl font-bold text-foreground">
                  {todayCounts[t.value] ?? 0}
                </span>
                <span className="mb-1 text-sm text-muted-foreground">اليوم</span>
              </div>
            </Card>
          )
        })}
      </div>

      {/* مناطق الرصد الحية */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Radio className="size-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">مناطق الرصد الحية</h2>
        </div>
        {zones.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            لا توجد مناطق رصد نشطة بعد. ابدأ بثاً من كاميرا الهاتف لعرض المناطق هنا.
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
                  <span className="text-muted-foreground">اكتشافات مفتوحة</span>
                  <span className="font-bold text-foreground">{z.open}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">الإجمالي</span>
                  <span className="font-medium text-foreground">{z.total}</span>
                </div>
                {z.worst > 0 && (
                  <Badge
                    text={`أعلى خطورة: ${worstZoneRank[z.worst]}`}
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
        <span className="text-sm font-medium text-muted-foreground">تصفية:</span>
        <select className={selectCls} value={fSeverity} onChange={(e) => setFSeverity(e.target.value)}>
          <option value="all">كل درجات الخطورة</option>
          {Object.entries(severityLabels).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className={selectCls} value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="all">كل الأنواع</option>
          {detectionTypeOptions.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select className={selectCls} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="all">كل الحالات</option>
          {detectionStatusOptions.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select className={selectCls} value={fCamera} onChange={(e) => setFCamera(e.target.value)}>
          <option value="all">كل المفتشين</option>
          {cameras.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select className={selectCls} value={fLocation} onChange={(e) => setFLocation(e.target.value)}>
          <option value="all">كل المواقع</option>
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
            مسح الفلاتر
          </button>
        )}
      </Card>

      {/* الكاميرات المتصلة الآن (بث شبه حي) */}
      <ConnectedCameras isAdmin={isAdmin} />

      {/* جدول البث المباشر للاكتشافات */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">البث المباشر للاكتشافات</h2>
          <span className="text-xs text-muted-foreground">
            {filtered.length} اكتشاف · تحديث تلقائي كل 10 ثوانٍ
          </span>
        </div>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {["الوقت", "المفتش/الموقع", "المخالفة", "الخطورة", "الثقة", "الإثبات", "الحالة", ""].map(
                    (h, i) => (
                      <th
                        key={i}
                        className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      لا توجد اكتشافات مطابقة.
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
                          {timeFmt(d.detectedAt)}
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
                            {typesOf(d).map((t) => (
                              <span
                                key={t}
                                className="inline-flex w-fit items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                              >
                                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                                {detectionTypeLabels[t] ?? t}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="font-medium text-foreground">
                            {detectionTypeLabels[d.detectionType] ?? d.detectionType}
                          </span>
                        )}
                        {d.notes && (
                          <div className="mt-1 text-xs text-muted-foreground line-clamp-1 max-w-[16rem]">
                            {d.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          text={severityLabels[d.severity] ?? d.severity}
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
                            typeLabel={detectionTypeLabels[d.detectionType] ?? d.detectionType}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          text={detectionStatusLabels[d.status] ?? d.status}
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
                                  title="تم الاطّلاع"
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
                                title="رفض"
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
                              title="حذف"
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
