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
  Mic,
  MicOff,
  Camera,
  Loader2,
  Video,
  CircleStop,
  Signal,
  SignalLow,
  SignalMedium,
} from "lucide-react"
import { upload } from "@vercel/blob/client"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { severityStyles } from "@/lib/ai-monitoring"
import type { CameraLiveStatus } from "@/app/actions/ai-monitoring"
import { createRecording } from "@/app/actions/recordings"
import { useWebrtcViewer } from "./use-webrtc-viewer"
import { useI18n } from "@/lib/i18n/client"
import { detectionTypeLabel, severityLabel } from "@/lib/i18n/labels"
import type { TFunction } from "@/lib/i18n/translate"

// اختيار أفضل صيغة تسجيل مدعومة في المتصفح (WebM أولاً ثم MP4).
function pickRecordingMime(): { mimeType: string; ext: string } {
  const candidates: { mimeType: string; ext: string }[] = [
    { mimeType: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mimeType: "video/webm;codecs=vp8,opus", ext: "webm" },
    { mimeType: "video/webm", ext: "webm" },
    { mimeType: "video/mp4", ext: "mp4" },
  ]
  if (typeof MediaRecorder !== "undefined") {
    for (const c of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(c.mimeType)) return c
      } catch {
        /* تجاهل */
      }
    }
  }
  return { mimeType: "", ext: "webm" }
}

// يُعتبر البث "مباشراً" إذا كان آخر إطار أحدث من 3 ثوانٍ.
const LIVE_THRESHOLD_MS = 3000
// نجلب حالة الكاميرا بنفس معدل رفع الإطارات (~400ms) لنقل شبه فوري.
const POLL_INTERVAL_MS = 400

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<CameraLiveStatus>)

function relativeTime(iso: string, now: number, t: TFunction, fmt: (n: number) => string) {
  const diff = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (diff < 2) return t("aiMonitoring.cam.now")
  if (diff < 60) return t("aiMonitoring.cam.agoSeconds").replace("{n}", fmt(diff))
  const mins = Math.floor(diff / 60)
  if (mins < 60) return t("aiMonitoring.cam.agoMinutes").replace("{n}", fmt(mins))
  const hours = Math.floor(mins / 60)
  return t("aiMonitoring.cam.agoHours").replace("{n}", fmt(hours))
}

export function LiveView({
  cameraId,
  initial,
}: {
  cameraId: string
  initial: CameraLiveStatus
}) {
  const { t, formatNumber } = useI18n()
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
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const camera = data?.camera ?? null
  const detection = data?.latestDetection ?? null
  // العنوان المعروض = اسم المفتش/الموظف (مع تراجع لمعرّف الجلسة).
  const title = camera?.inspectorName || cameraId

  // البث الحي المباشر (WebRTC): فيديو لحظي ندّاً لِند. يسقط تلقائياً إلى اللقطات
  // إن لم تكن الكاميرا تبث بثاً حياً.
  const {
    videoRef,
    status: webrtcStatus,
    error: webrtcError,
    stats,
    hasAudio,
    talkActive,
    talkError,
    toggleTalk,
  } = useWebrtcViewer({
    cameraId,
    enabled: true,
  })
  const webrtcLive = webrtcStatus === "live"

  // إظهار خطأ المايكروفون كإشعار عربي واضح عند تغيّره.
  useEffect(() => {
    if (talkError) {
      toast({ title: t("aiMonitoring.cam.micToastFailed"), description: talkError, variant: "destructive" })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talkError])

  // كتم الصوت افتراضاً (شرط التشغيل التلقائي)؛ الم��ير يفعّله بنقرة (إيماءة المستخدم).
  const [audioOn, setAudioOn] = useState(false)
  const toggleAudio = () => {
    const v = videoRef.current
    if (!v || !hasAudio) return
    const next = !audioOn
    v.muted = !next
    if (next) void v.play().catch(() => {})
    setAudioOn(next)
  }

  // عند فقدان مسار الصوت (انقطاع/إعادة تفاوض) أعد الحالة إلى مكتوم حتى لا يبقى الزر
  // يزعم أن الصوت مفعّل بلا مصدر فعلي.
  useEffect(() => {
    if (!hasAudio && audioOn) {
      const v = videoRef.current
      if (v) v.muted = true
      setAudioOn(false)
    }
  }, [hasAudio, audioOn, videoRef])

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
        setCaptureError(t("aiMonitoring.cam.captureFailedNow"))
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
      setCaptureError(e instanceof Error ? e.message : t("aiMonitoring.cam.captureFailed"))
    } finally {
      setCapturing(false)
    }
  }

  // تسجيل مقطع من البث الحي المباشر ثم رفعه وحفظه ضمن التسجيلات لربطه بمخالفة.
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordMimeRef = useRef<{ mimeType: string; ext: string }>({ mimeType: "", ext: "webm" })
  const recordStartRef = useRef<number>(0)
  // معاينة اللقطة الملتقطة عند إيقاف التسجيل (تُرفع كـ poster للتسجيل).
  const posterRef = useRef<string>("")
  const [recording, setRecording] = useState(false)
  const [savingClip, setSavingClip] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)

  // مؤقّت عدّاد مدة التسجيل (ثوانٍ) أثناء التسجيل فقط.
  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => {
      setRecSeconds(Math.max(0, Math.round((Date.now() - recordStartRef.current) / 1000)))
    }, 500)
    return () => clearInterval(id)
  }, [recording])

  // التقاط إطار معاينة (poster) من الفيديو الحي الحالي.
  const capturePosterDataUrl = (): string => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.videoWidth === 0) return ""
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return ""
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", 0.7)
  }

  const startRecording = () => {
    const video = videoRef.current
    const stream = (video?.srcObject as MediaStream | null) ?? null
    if (typeof MediaRecorder === "undefined" || !stream) {
      toast({ title: t("aiMonitoring.cam.recordStartFailed"), description: t("aiMonitoring.cam.liveUnavailable"), variant: "destructive" })
      return
    }
    const mime = pickRecordingMime()
    recordMimeRef.current = mime
    try {
      const recorder = mime.mimeType ? new MediaRecorder(stream, { mimeType: mime.mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        void finalizeClip()
      }
      recorderRef.current = recorder
      recordStartRef.current = Date.now()
      setRecSeconds(0)
      recorder.start(1000)
      setRecording(true)
    } catch {
      toast({ title: t("aiMonitoring.cam.recordStartFailed"), variant: "destructive" })
    }
  }

  const stopRecording = () => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") {
      // نلتقط المعاينة قبل توقّف الفيديو مباشرةً.
      posterRef.current = capturePosterDataUrl()
      recorder.stop()
    }
    setRecording(false)
  }

  const finalizeClip = async () => {
    const mime = recordMimeRef.current
    const blob = new Blob(chunksRef.current, { type: mime.mimeType || "video/webm" })
    chunksRef.current = []
    recorderRef.current = null
    if (blob.size === 0) {
      toast({ title: t("aiMonitoring.cam.clipEmpty"), description: t("aiMonitoring.cam.clipEmptyDesc"), variant: "destructive" })
      return
    }
    setSavingClip(true)
    try {
      const durationSeconds = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000))
      const stamp = new Date().toISOString().replace(/[:.]/g, "-")
      const path = `recordings/${encodeURIComponent(cameraId)}/${stamp}.${mime.ext}`
      const uploaded = await upload(path, blob, {
        access: "public",
        handleUploadUrl: "/api/ai-monitoring/upload-recording",
        contentType: blob.type || `video/${mime.ext}`,
      })

      // رفع معاينة (poster) إن التُقطت.
      let posterUrl = ""
      if (posterRef.current) {
        try {
          const posterBlob = await (await fetch(posterRef.current)).blob()
          const up = await upload(`recordings/${encodeURIComponent(cameraId)}/${stamp}-poster.jpg`, posterBlob, {
            access: "public",
            handleUploadUrl: "/api/ai-monitoring/upload-recording",
            contentType: "image/jpeg",
          })
          posterUrl = up.url
        } catch {
          /* المعاينة اختيارية */
        }
      }
      posterRef.current = ""

      await createRecording({
        cameraId,
        cameraName: camera?.inspectorName || cameraId,
        videoUrl: uploaded.url,
        posterUrl,
        durationSeconds,
        fileSizeBytes: blob.size,
      })

      toast({
        title: t("aiMonitoring.cam.clipSaved"),
        description: t("aiMonitoring.cam.clipSavedDesc"),
      })
      router.push("/ai-monitoring/recordings")
    } catch (e) {
      toast({
        title: t("aiMonitoring.cam.clipSaveFailed"),
        description: e instanceof Error ? e.message : t("aiMonitoring.cam.uploadError"),
        variant: "destructive",
      })
    } finally {
      setSavingClip(false)
    }
  }

  const lastSeenMs = camera ? new Date(camera.lastSeenAt).getTime() : 0
  const isLive = camera != null && now - lastSeenMs < LIVE_THRESHOLD_MS

  // تصنيف جودة الاتصال إلى: جيدة/متوسطة/ضعيفة اعتماداً على معدل التدفق و RTT.
  const quality = (() => {
    if (!webrtcLive || !stats) return null
    const { kbps, rttMs } = stats
    if (kbps >= 350 && (rttMs === 0 || rttMs < 200)) return "good" as const
    if (kbps >= 120) return "medium" as const
    return "weak" as const
  })()
  const qualityMeta = {
    good: { label: t("aiMonitoring.cam.qualExcellent"), cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", Icon: Signal },
    medium: { label: t("aiMonitoring.cam.qualMediumFull"), cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", Icon: SignalMedium },
    weak: { label: t("aiMonitoring.cam.qualWeakFull"), cls: "bg-destructive/15 text-destructive", Icon: SignalLow },
  } as const

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
          {t("aiMonitoring.cam.back")}
        </Link>
        <div className="flex items-center gap-2">
        {/* مؤشر جودة الاتصال — يظهر أثناء البث الحي المباشر فقط */}
        {quality && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              qualityMeta[quality].cls,
            )}
            title={
              stats
                ? `${t("aiMonitoring.cam.kbpsFps").replace("{kbps}", formatNumber(stats.kbps)).replace("{fps}", formatNumber(stats.fps))}${stats.rttMs ? ` · ${stats.rttMs}ms` : ""}`
                : undefined
            }
          >
            {(() => {
              const Icon = qualityMeta[quality].Icon
              return <Icon className="size-3.5" />
            })()}
            <span>{qualityMeta[quality].label}</span>
            {stats && (
              <span className="font-mono text-[10px] opacity-80" dir="ltr">
                {stats.kbps}kbps
              </span>
            )}
          </span>
        )}
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
      </div>

      {/* شريط خط�� البث المباشر: يعرض رسالة 401/403 الكامل�� بدل رمز غامض */}
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

          {/* زر تفعيل/كتم صوت البث الحي — يظهر أثناء البث الحي المباشر فقط.
              عند توفّر مسار صوت في البث يصبح الزر فعّالاً؛ وإن لم يصل صوت من المصدر
              يظهر مؤشر معطّل واضح بدل زر لا يفعل شيئاً. */}
          {webrtcLive &&
            (hasAudio ? (
              <button
                onClick={toggleAudio}
                className="absolute left-3 top-14 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/75"
                aria-pressed={audioOn}
              >
                {audioOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                {audioOn ? "الصوت مفعّل" : "تفعيل الصوت"}
              </button>
            ) : (
              <div
                className="absolute left-3 top-14 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white/60 backdrop-blur"
                aria-label="لا يوجد صوت وارد من مصدر البث"
              >
                <VolumeX className="size-4" />
                لا يوجد صوت من المصدر
              </div>
            ))}

          {/* زر التحدّث مع المفتش (talk-back) — يظهر أثناء البث الحي المباشر فقط.
              أول ضغطة تطلب صلاحية المايكروفون ثم تبدأ إرسال صوت المدير للكاميرا؛
              الضغطات التالية تكتم/تُلغي الكتم فوراً. عند التحدّث يظهر مؤشر نابض
              بنفس نمط مؤشر البث الحي. */}
          {webrtcLive && (
            <button
              onClick={() => void toggleTalk()}
              className={cn(
                "absolute left-3 top-[6.5rem] z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur transition-colors",
                talkActive
                  ? "bg-destructive text-white hover:bg-destructive/90"
                  : "bg-black/60 text-white hover:bg-black/75",
              )}
              aria-pressed={talkActive}
            >
              {talkActive ? (
                <>
                  <span className="size-2 animate-pulse rounded-full bg-white" aria-hidden="true" />
                  <Mic className="size-4" />
                  تتحدّث الآن
                </>
              ) : (
                <>
                  <MicOff className="size-4" />
                  التحدّث مع المفتش
                </>
              )}
            </button>
          )}

          {/* مؤشر التسجيل الجاري (REC) */}
          {recording && (
            <div className="absolute right-3 top-14 z-10 inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5 text-xs font-bold text-white">
              <span className="size-2 animate-pulse rounded-full bg-white" aria-hidden="true" />
              REC
              <span className="font-mono" dir="ltr">
                {String(Math.floor(recSeconds / 60)).padStart(2, "0")}:
                {String(recSeconds % 60).padStart(2, "0")}
              </span>
            </div>
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

      {/* أزرار الالتقاط والتسجيل */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={handleCapture}
            disabled={capturing || recording || (!webrtcLive && !frameSrc)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {capturing ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            {capturing ? "جارٍ التقاط اللقطة…" : "التقاط لقطة وإنشاء مخالفة"}
          </button>
          {/* تسجيل مقطع من البث الحي — متاح أثناء البث الحي المباشر فقط */}
          {recording ? (
            <button
              onClick={stopRecording}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-destructive/90"
            >
              <CircleStop className="size-4" />
              إيقاف التسجيل
              <span className="font-mono text-xs opacity-90" dir="ltr">
                {String(Math.floor(recSeconds / 60)).padStart(2, "0")}:
                {String(recSeconds % 60).padStart(2, "0")}
              </span>
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={!webrtcLive || savingClip}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              title={webrtcLive ? undefined : "التسجيل متاح أثناء البث الحي المباشر فقط"}
            >
              {savingClip ? <Loader2 className="size-4 animate-spin" /> : <Video className="size-4" />}
              {savingClip ? "جارٍ حفظ المقطع…" : "تسجيل مقطع"}
            </button>
          )}
        </div>
        {captureError && (
          <p className="text-sm text-destructive" role="alert">
            {captureError}
          </p>
        )}
        {recording && (
          <p className="text-xs text-muted-foreground">
            يجري تسجيل مقطع من البث الحي (بالصوت). أوقف التسجيل ليُحفظ في التسجيلات وتُنشئ منه مخالفة.
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
