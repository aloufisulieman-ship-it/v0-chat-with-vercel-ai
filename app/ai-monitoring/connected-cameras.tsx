"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { Cctv, MapPin, Clock, Video, Radio, UserRound } from "lucide-react"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ToastAction } from "@/components/ui/toast"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

// اعتبار الكاميرا "مباشرة" إذا كان آخر إطار خلال آخر 8 ثوانٍ.
const LIVE_THRESHOLD_MS = 8000

export type CameraStreamDto = {
  id: number
  cameraId: string
  inspectorName: string
  cameraLocation: string
  lastFrameUrl: string
  lastSeenAt: string
}

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())

// صياغة الوقت النسبي بالعربية: "قبل X ثانية/دقيقة/ساعة".
function relativeTime(iso: string, now: number) {
  const diff = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (diff < 5) return "الآن"
  if (diff < 60) return `قبل ${diff} ثانية`
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `قبل ${mins} دقيقة`
  const hours = Math.floor(mins / 60)
  return `قبل ${hours} ساعة`
}

function fullTime(iso: string) {
  // تثبيت المنطقة الزمنية على توقيت الرياض ليتطابق تنسيق الخادم مع العميل
  // (منع خطأ عدم تطابق الترطيب) مع عرض التوقيت السعودي الصحيح.
  return new Date(iso).toLocaleString("ar", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Riyadh",
  })
}

// كسر الكاش للإطارات المرفوعة إلى Blob (روابط http) بحيث تُحدَّث الصورة مع كل جلب.
// روابط data: (قديمة) تُترك كما هي لأن إضافة استعلام يُفسدها.
function frameSrc(url: string, version: string) {
  if (!url) return "/placeholder.svg"
  if (url.startsWith("http")) return `${url}?v=${encodeURIComponent(version)}`
  return url
}

export function ConnectedCameras({ isAdmin }: { isAdmin: boolean }) {
  const { data } = useSWR<{ cameras: CameraStreamDto[] }>(
    "/api/ai-monitoring/active-cameras",
    fetcher,
    { refreshInterval: 6000, fallbackData: { cameras: [] } },
  )
  const cameras = data?.cameras ?? []

  // مؤقت محلي كل ثانية لتحديث الوقت النسبي ومؤشر الاتصال بين عمليات الجلب.
  const [now, setNow] = useState(() => Date.now())
  const liveCount = cameras.filter((c) => now - new Date(c.lastSeenAt).getTime() < LIVE_THRESHOLD_MS).length
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // تنبيه فوري عند بدء بث جديد: نتتبّع الكاميرات الحية سابقاً، وعند ظهور كاميرا
  // حيّة لم تكن حيّة من قبل نُطلق إشعاراً. نتجاهل أول تحميل (بذر) حتى لا يُغرق
  // المدير بإشعارات عن بثوث كانت تعمل مسبقاً.
  const prevLiveRef = useRef<Set<string> | null>(null)
  useEffect(() => {
    const t = Date.now()
    const liveNow = new Set<string>()
    for (const c of cameras) {
      if (t - new Date(c.lastSeenAt).getTime() < LIVE_THRESHOLD_MS) liveNow.add(c.cameraId)
    }
    const prev = prevLiveRef.current
    // أول تشغيل: نبذر المجموعة دون إطلاق إشعارات.
    if (prev === null) {
      prevLiveRef.current = liveNow
      return
    }
    for (const c of cameras) {
      if (liveNow.has(c.cameraId) && !prev.has(c.cameraId)) {
        const label = c.inspectorName || c.cameraId
        toast({
          title: "بدأ بثٌّ حيّ جديد",
          description: `${label}${c.cameraLocation ? ` — ${c.cameraLocation}` : ""}`,
          // إشعار مهم للمدير: نُبقيه ظاهراً 15 ثانية بدل 5 الافتراضية.
          duration: 15000,
          action: (
            <ToastAction altText="فتح البث المباشر" asChild>
              <Link href={`/ai-monitoring/live/${encodeURIComponent(c.cameraId)}`}>فتح البث</Link>
            </ToastAction>
          ),
        })
      }
    }
    prevLiveRef.current = liveNow
  }, [cameras])

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="size-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">الكاميرات المتصلة الآن</h2>
        </div>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {liveCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">
              <span className="size-1.5 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
              {liveCount} بث حي الآن
            </span>
          )}
          {cameras.length} كاميرا
        </span>
      </div>

      {cameras.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <Cctv className="size-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">لا توجد كاميرات نشطة حاليًا</p>
          {isAdmin && (
            <p className="text-xs text-muted-foreground/70">
              ابدأ بثاً من صفحة كاميرا الهاتف لعرضها هنا.
            </p>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cameras.map((cam) => {
            const isLive = now - new Date(cam.lastSeenAt).getTime() < LIVE_THRESHOLD_MS
            // العنوان المعروض = اسم المفتش/الموظف (مع تراجع لمعرّف الجلسة عند غيابه).
            const title = cam.inspectorName || cam.cameraId
            return (
              <div
                key={cam.id}
                className="flex flex-col overflow-hidden rounded-xl border border-border bg-card"
              >
                <Dialog>
                <DialogTrigger asChild>
                  <button
                    className="group flex flex-col text-right transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30"
                    aria-label={`عرض بث المفتش ${title}`}
                  >
                    {/* آخر إطار */}
                    <div className="relative aspect-video w-full overflow-hidden bg-black">
                      {cam.lastFrameUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={frameSrc(cam.lastFrameUrl, cam.lastSeenAt)}
                          alt={`آخر إطار من بث المفتش ${title}`}
                          className="size-full object-cover transition-transform group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-white/40">
                          <Cctv className="size-8" />
                        </div>
                      )}
                      {/* مؤشر البث الحي المباشر — شارة حمراء نابضة بارزة عند البث الآن */}
                      <div
                        className={cn(
                          "absolute right-2 top-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          isLive ? "bg-destructive text-white" : "bg-black/65 text-white/90",
                        )}
                      >
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            isLive ? "animate-pulse bg-white" : "bg-muted-foreground/60",
                          )}
                          aria-hidden="true"
                        />
                        {isLive ? "بث حي" : "غير متصل"}
                      </div>
                    </div>
                    {/* بيانات المفتش والموقع */}
                    <div className="flex flex-col gap-1.5 p-3">
                      <div className="flex items-center gap-1.5">
                        <UserRound className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium text-foreground">{title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{cam.cameraLocation || "موقع غير محدد"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3.5 shrink-0" />
                        <span>{relativeTime(cam.lastSeenAt, now)}</span>
                      </div>
                    </div>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <UserRound className="size-5" />
                      {title}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4">
                    <div className="overflow-hidden rounded-lg border border-border bg-black">
                      {cam.lastFrameUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={frameSrc(cam.lastFrameUrl, cam.lastSeenAt)}
                          alt={`آخر إطار من بث المفتش ${title}`}
                          className="w-full object-contain"
                        />
                      ) : (
                        <div className="flex aspect-video w-full items-center justify-center text-white/40">
                          <Cctv className="size-10" />
                        </div>
                      )}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-xs text-muted-foreground">اسم المفتش/الموظف</dt>
                        <dd className="font-medium text-foreground">{title}</dd>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-xs text-muted-foreground">الموقع</dt>
                        <dd className="font-medium text-foreground">
                          {cam.cameraLocation || "موقع غير محدد"}
                        </dd>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-xs text-muted-foreground">الحالة</dt>
                        <dd className="flex items-center gap-1.5 font-medium text-foreground">
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              now - new Date(cam.lastSeenAt).getTime() < LIVE_THRESHOLD_MS
                                ? "animate-pulse bg-primary"
                                : "bg-muted-foreground/60",
                            )}
                            aria-hidden="true"
                          />
                          {now - new Date(cam.lastSeenAt).getTime() < LIVE_THRESHOLD_MS
                            ? "مباشر"
                            : "غير متصل"}
                        </dd>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-xs text-muted-foreground">آخر تحديث</dt>
                        <dd className="font-medium text-foreground" dir="ltr">
                          {fullTime(cam.lastSeenAt)}
                        </dd>
                      </div>
                    </dl>
                    <Link
                      href={`/ai-monitoring/live/${encodeURIComponent(cam.cameraId)}`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Radio className="size-4" />
                      فتح المشاهدة المباشرة
                    </Link>
                  </div>
                </DialogContent>
                </Dialog>
                {/* رابط المشاهدة المباشرة أسفل البطاقة */}
                <Link
                  href={`/ai-monitoring/live/${encodeURIComponent(cam.cameraId)}`}
                  className="flex items-center justify-center gap-1.5 border-t border-border py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
                >
                  <Radio className="size-3.5" />
                  مشاهدة مباشرة
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
