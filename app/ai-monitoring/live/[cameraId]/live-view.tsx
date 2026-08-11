"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Cctv,
  MapPin,
  Clock,
  AlertTriangle,
  ShieldCheck,
  UserRound,
  Volume2,
  VolumeX,
  Camera,
  Loader2,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { detectionTypeLabels, severityLabels, severityStyles } from "@/lib/ai-monitoring"
import type { CameraLiveStatus } from "@/app/actions/ai-monitoring"
import { useWebrtcViewer } from "./use-webrtc-viewer"

// يُعتبر البث "مباشراً" إذا كان آخر إطار أحدث من 3 ثوانٍ.
const LIVE_THRESHOLD_MS = 3000
// نجلب حالة الكاميرا بنفس معدل رفع الإطارات (~400ms) لنقل شبه فوري.
const POLL_INTERVAL_MS = 400

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<CameraLiveStatus>)

function relativeTime(iso: string, now: number) {
  const diff = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (diff < 2) return "الآن"
  if (diff < 60) return `قبل ${diff} ثانية`
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `قبل ${mins} دقيقة`
  const hours = Math.floor(mins / 60)
  return `قبل ${hours} ساعة`
}

export function LiveView({
  cameraId,
  initial,
}: {
  cameraId: string
  initial: CameraLiveStatus
}) {
  const { data } = useSWR<CameraLiveStatus>(
    `/api/ai-monitoring/live-status?cameraId=${encodeURIComponent(cameraId)}`,
    fetcher,
    {
      refreshInterval: POLL_INTERVAL_MS,
      // خفض نافذة إلغاء التكرار الافتراضية (2s) حتى لا تخنق الاستطلاع السريع.
      dedupingInterval: POLL_INTERVAL_MS,
      fallbackData: initial,
    },
  )

  // مؤقت محلي كل ثانية لتحديث الوقت النسبي ومؤشر الاتصال بين عمليات الجلب.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const camera = data?.camera ?? null
  const detection = data?.latestDetection ?? null
  // العنوان المعروض = اسم المفتش/الموظف (مع تراجع لمعرّف الجلسة).
  const title = camera?.inspectorName || cameraId

  // البث الحي المباشر (WebRTC): فيديو لحظي ندّاً لِند. يسقط تلقائياً إلى اللقطات
  // إن لم تكن الكاميرا تبث بثاً حياً.
  const { videoRef, status: webrtcStatus, error: webrtcError } = useWebrtcViewer({ cameraId, enabled: true })
  const webrtcLive = webrtcStatus === "live"

  // كتم الصوت افتراضاً (شرط التشغيل التلقائي)؛ المدير يفعّله بنقرة (إيماءة المستخدم).
  const [audioOn, setAudioOn] = useState(false)
  const toggleAudio = () => {
    const v = videoRef.current
    if (!v) return
    const next = !audioOn
    v.muted = !next
    if (next) void v.play().catch(() => {})
    setAudioOn(next)
  }

  // التقاط لقطة من البث الحي (أو آخر إطار) ورفعها كدليل دائم ثم فتح نموذج مخالفة.
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [capturing, setCapturing] = useState(false)
  const [captureError, setCaptureError] = useState<string | null>(null)

  const captureDataUrl = async (): Promise<string | null> => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const video = videoRef.current
    // 1) من الفيديو الحي مباشرةً (بكسل اللحظة الحالية).
    if (webrtcLive && video && video.videoWidth > 0) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) return null
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL("image/jpeg", 0.7)
    }
    // 2) احتياطي: حمّل آخر إطار (Blob) وحوّله إلى data URL.
    if (frameSrc) {
      const res = await fetch(frameSrc, { cache: "no-store" })
      const blob = await res.blob()
      return await new Promise<string | null>((resolve) => {
        const fr = new FileReader()
        fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : null)
        fr.onerror = () => resolve(null)
        fr.readAsDataURL(blob)
      })
    }
    return null
  }

  const handleCapture = async () => {
    setCaptureError(null)
    setCapturing(true)
    try {
      const dataUrl = await captureDataUrl()
      if (!dataUrl) {
        setCaptureError("تعذّر التقاط لقطة الآن. حاول مرة أخرى.")
        return
      }
      const res = await fetch("/api/ai-monitoring/live-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, cameraId }),
      })
      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try {
          const d = (await res.json()) as { error?: string }
          if (d?.error) msg = d.error
        } catch {
          /* الجسم ليس JSON */
        }
        setCaptureError(msg)
        return
      }
      const { url } = (await res.json()) as { url: string }
      const params = new URLSearchParams({ from: "recording", evidence: url })
      const detectedBy = camera?.inspectorName || ""
      if (detectedBy) params.set("detectedBy", detectedBy)
      router.push(`/violations?${params.toString()}`)
    } catch (e) {
      setCaptureError(e instanceof Error ? e.message : "تعذّر التقاط اللقطة")
    } finally {
      setCapturing(false)
    }
  }

  const lastSeenMs = camera ? new Date(camera.lastSeenAt).getTime() : 0
  const isLive = camera != null && now - lastSeenMs < LIVE_THRESHOLD_MS

  // كسر الكاش: يتغيّر مع كل إطار جديد (lastSeenAt) لإجبار تحديث الصورة.
  // يُطبَّق فقط على روابط Blob (http)، أما روابط data: القديمة فتُترك كما هي.
  const rawUrl = camera?.lastFrameUrl ?? ""
  const frameSrc = rawUrl.startsWith("http")
    ? `${rawUrl}?v=${encodeURIComponent(camera!.lastSeenAt)}`
    : rawUrl

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      {/* شريط علوي: رجوع + مؤشر مباشر */}
      <div className="flex items-center justify-between">
        <Link
          href="/ai-monitoring"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight className="size-4" />
          العودة للوحة المراقبة
        </Link>
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
            webrtcLive || isLive
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "size-2.5 rounded-full",
              webrtcLive || isLive ? "animate-pulse bg-destructive" : "bg-muted-foreground/60",
            )}
            aria-hidden="true"
          />
          {webrtcLive ? "بث حي مباشر" : isLive ? "لقطات حية" : "غير متصل"}
        </span>
      </div>

      {/* شريط خطأ البث المباشر: يعرض رسالة 401/403 الكاملة بدل رمز غامض */}
      {webrtcError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
        >
          تعذّر الاتصال بالبث الحي المباشر: {webrtcError}
        </div>
      )}

      {/* شاشة البث */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-black shadow-lg">
        <div className="relative aspect-video w-full">
          {/* فيديو البث الحي المباشر (WebRTC) — يظهر فوق اللقطات عند نجاح الاتصال */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "absolute inset-0 size-full bg-black object-contain transition-opacity duration-300",
              webrtcLive ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          />

          {/* طبقة اللقطات (احتياطية): تظهر ما لم يكن البث الحي المباشر متصلاً */}
          {!webrtcLive &&
            (frameSrc ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={frameSrc || "/placeholder.svg"}
                alt={`آخر إطار من بث المفتش ${title}`}
                className="size-full object-contain"
              />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-2 text-white/40">
                <Cctv className="size-12" />
                <span className="text-sm">
                  {isLive ? "جارٍ الاتصال بالبث الحي المباشر…" : "بانتظار أول إطار من الكاميرا…"}
                </span>
              </div>
            ))}

          {/* زر تفعيل/كتم صوت البث الحي — يظهر أثناء البث الحي المباشر فقط */}
          {webrtcLive && (
            <button
              onClick={toggleAudio}
              className="absolute left-3 top-14 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/75"
              aria-pressed={audioOn}
            >
              {audioOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              {audioOn ? "الصوت مفعّل" : "تفعيل الصوت"}
            </button>
          )}

          {/* طبقة معلومات علوية */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
            <div className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1 text-xs font-medium text-white">
              <UserRound className="size-3.5" />
              {title}
            </div>
            {camera && (
              <div className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1 text-xs text-white/90">
                <Clock className="size-3.5" />
                <span dir="ltr">{relativeTime(camera.lastSeenAt, now)}</span>
              </div>
            )}
          </div>

          {/* طبقة نتيجة التحليل السفلية (overlay) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            {detection ? (
              <div className="flex items-end justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                    <AlertTriangle className="size-4 text-amber-400" />
                    {detectionTypeLabels[detection.detectionType] ?? detection.detectionType}
                  </span>
                  {detection.notes && (
                    <span className="truncate text-xs text-white/70">{detection.notes}</span>
                  )}
                  <span className="text-[11px] text-white/60" dir="ltr">
                    {relativeTime(detection.detectedAt, now)} · {detection.confidenceScore}%
                  </span>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",
                    severityStyles[detection.severity] ?? "",
                  )}
                >
                  {severityLabels[detection.severity] ?? detection.severity}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-sm font-medium text-white/80">
                <ShieldCheck className="size-4 text-emerald-400" />
                لا توجد مخالفات مرصودة حتى الآن
              </div>
            )}
          </div>
        </div>
      </div>

      {/* التقاط لقطة وإنشاء مخالفة منها */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleCapture}
          disabled={capturing || (!webrtcLive && !frameSrc)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {capturing ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          {capturing ? "جارٍ التقاط اللقطة…" : "التقاط لقطة وإنشاء مخالفة"}
        </button>
        {captureError && (
          <p className="text-sm text-destructive" role="alert">
            {captureError}
          </p>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {/* تفاصيل الكاميرا */}
      <Card className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 sm:grid-cols-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">اسم المفتش/الموظف</span>
          <span className="truncate font-medium text-foreground">{title}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">الموقع</span>
          <span className="flex items-center gap-1 truncate font-medium text-foreground">
            <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
            {camera?.cameraLocation || "غير محدد"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">الحالة</span>
          <span
            className={cn(
              "flex items-center gap-1.5 font-medium",
              isLive ? "text-destructive" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                isLive ? "animate-pulse bg-destructive" : "bg-muted-foreground/60",
              )}
              aria-hidden="true"
            />
            {isLive ? "يبث الآن" : "متوقف"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">نوع البث</span>
          <span className="font-medium text-foreground">
            {webrtcLive ? "فيديو حي مباشر (WebRTC)" : "لقطات شبه فورية (~0.4 ث)"}
          </span>
        </div>
      </Card>
    </div>
  )
}
