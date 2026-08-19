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
import { useI18n } from "@/lib/i18n/client"
import type { TFunction } from "@/lib/i18n/translate"

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

// صياغة الوقت النسبي المترجم: "الآن / قبل X ثانية/دقيقة/ساعة".
function relativeTime(iso: string, now: number, t: TFunction, fmt: (n: number) => string) {
  const diff = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (diff < 5) return t("aiMonitoring.cam.now")
  if (diff < 60) return t("aiMonitoring.cam.agoSeconds").replace("{n}", fmt(diff))
  const mins = Math.floor(diff / 60)
  if (mins < 60) return t("aiMonitoring.cam.agoMinutes").replace("{n}", fmt(mins))
  const hours = Math.floor(mins / 60)
  return t("aiMonitoring.cam.agoHours").replace("{n}", fmt(hours))
}

function fullTime(iso: string, locale: string) {
  // تثبيت المنطقة الزمنية على توقيت الرياض ليتطابق تنسيق الخادم مع العميل
  // (منع خطأ عدم تطابق الترطيب) مع عرض التوقيت السعودي الصحيح.
  return new Date(iso).toLocaleString(locale === "ar" ? "ar-SA" : "en-GB", {
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
  const { t, locale, formatNumber } = useI18n()
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
    const nowMs = Date.now()
    const liveNow = new Set<string>()
    for (const c of cameras) {
      if (nowMs - new Date(c.lastSeenAt).getTime() < LIVE_THRESHOLD_MS) liveNow.add(c.cameraId)
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
          title: t("aiMonitoring.cam.newStreamTitle"),
          description: `${label}${c.cameraLocation ? ` — ${c.cameraLocation}` : ""}`,
          // إشعار مهم للمدير: نُبقيه ظاهراً 15 ثانية بدل 5 الافتراضية.
          duration: 15000,
          action: (
            <ToastAction altText={t("aiMonitoring.cam.openStreamAlt")} asChild>
              <Link href={`/ai-monitoring/live/${encodeURIComponent(c.cameraId)}`}>
                {t("aiMonitoring.cam.openStream")}
              </Link>
            </ToastAction>
          ),
        })
      }
    }
    prevLiveRef.current = liveNow
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameras])

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="size-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t("aiMonitoring.cam.camsHeading")}</h2>
        </div>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {liveCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">
              <span className="size-1.5 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
              {t("aiMonitoring.cam.liveNowCount").replace("{n}", formatNumber(liveCount))}
            </span>
          )}
          {t("aiMonitoring.cam.camerasCount").replace("{n}", formatNumber(cameras.length))}
        </span>
      </div>

      {cameras.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <Cctv className="size-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">{t("aiMonitoring.cam.camsEmpty")}</p>
          {isAdmin && (
            <p className="text-xs text-muted-foreground/70">
              {t("aiMonitoring.cam.camsEmptyHint")}
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
                    aria-label={t("aiMonitoring.cam.viewInspectorStream").replace("{title}", title)}
                  >
                    {/* آخر إطار */}
                    <div className="relative aspect-video w-full overflow-hidden bg-black">
                      {cam.lastFrameUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={frameSrc(cam.lastFrameUrl, cam.lastSeenAt)}
                          alt={t("aiMonitoring.cam.inspectorLastFrame").replace("{title}", title)}
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
                        {isLive ? t("aiMonitoring.cam.live") : t("aiMonitoring.cam.offline")}
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
                        <span className="truncate">{cam.cameraLocation || t("aiMonitoring.cam.noLocation")}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3.5 shrink-0" />
                        <span>{relativeTime(cam.lastSeenAt, now, t, formatNumber)}</span>
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
                          alt={t("aiMonitoring.cam.inspectorLastFrame").replace("{title}", title)}
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
                        <dt className="text-xs text-muted-foreground">{t("aiMonitoring.cam.inspectorName")}</dt>
                        <dd className="font-medium text-foreground">{title}</dd>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-xs text-muted-foreground">{t("aiMonitoring.cam.location")}</dt>
                        <dd className="font-medium text-foreground">
                          {cam.cameraLocation || t("aiMonitoring.cam.noLocation")}
                        </dd>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-xs text-muted-foreground">{t("aiMonitoring.cam.status")}</dt>
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
                            ? t("aiMonitoring.cam.liveShort")
                            : t("aiMonitoring.cam.offline")}
                        </dd>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-xs text-muted-foreground">{t("aiMonitoring.cam.lastUpdate")}</dt>
                        <dd className="font-medium text-foreground" dir="ltr">
                          {fullTime(cam.lastSeenAt, locale)}
                        </dd>
                      </div>
                    </dl>
                    <Link
                      href={`/ai-monitoring/live/${encodeURIComponent(cam.cameraId)}`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Radio className="size-4" />
                      {t("aiMonitoring.cam.openWatchLive")}
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
                  {t("aiMonitoring.cam.watchLive")}
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
