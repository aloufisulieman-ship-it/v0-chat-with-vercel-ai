"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Camera,
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  BatteryCharging,
  Wifi,
  WifiOff,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { detectionTypeLabels, severityLabels, severityStyles } from "@/lib/ai-monitoring"

// رفع الإطار إلى Blob بوتيرة سريعة (بث شبه حي)، والتحليل بالذكاء الاصطناعي أبطأ لتوفير التكلفة.
const UPLOAD_INTERVAL_MS = 1500
const ANALYZE_INTERVAL_MS = 8000
// تُعتبر الكاميرا "متصلة" إذا نجح آخر رفع خلال آخر 5 ثوانٍ.
const CONNECTED_THRESHOLD_MS = 5000
const MAX_WIDTH = 720
const JPEG_QUALITY = 0.6

type LastResult = {
  at: number
  count: number
  detections: { type: string; severity: string; confidence: number; description: string }[]
  error?: string
}

export function MobileCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const uploadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const analyzeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)
  const uploadingRef = useRef(false)
  const analyzingRef = useRef(false)

  const [cameraName, setCameraName] = useState("")
  const [location, setLocation] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentCount, setSentCount] = useState(0)
  const [lastUploadAt, setLastUploadAt] = useState<number | null>(null)
  const [lastUploadOkAt, setLastUploadOkAt] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [lastResult, setLastResult] = useState<LastResult | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // مؤقت محلي لتحديث مؤشر الاتصال والوقت.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // استرجاع اسم الكاميرا والموقع من التخزين المحلي.
  useEffect(() => {
    setCameraName(localStorage.getItem("aiCam.name") ?? "")
    setLocation(localStorage.getItem("aiCam.location") ?? "")
  }, [])

  useEffect(() => {
    localStorage.setItem("aiCam.name", cameraName)
  }, [cameraName])
  useEffect(() => {
    localStorage.setItem("aiCam.location", location)
  }, [location])

  // التقاط إطار من الفيديو وإرجاعه كـ data URL (JPEG)، أو null إن لم يكن جاهزاً.
  const captureJpeg = useCallback((): string | null => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.videoWidth === 0) return null
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY)
  }, [])

  // الحلقة السريعة: رفع الإطار إلى Blob للبث شبه الحي.
  const uploadFrame = useCallback(async () => {
    if (uploadingRef.current) return
    const image = captureJpeg()
    if (!image) return
    uploadingRef.current = true
    setLastUploadAt(Date.now())
    try {
      const res = await fetch("/api/ai-monitoring/upload-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image,
          cameraId: cameraName || "كاميرا الهاتف",
          cameraLocation: location,
        }),
      })
      if (res.ok) {
        setSentCount((c) => c + 1)
        setLastUploadOkAt(Date.now())
        setUploadError(null)
      } else {
        const data = await res.json().catch(() => null)
        setUploadError(data?.error || `فشل رفع الإطار (رمز ${res.status})`)
      }
    } catch {
      setUploadError("تعذّر الاتصال بالخادم أثناء رفع الإطار")
    } finally {
      uploadingRef.current = false
    }
  }, [captureJpeg, cameraName, location])

  // الحلقة البطيئة: إرسال الإطار للتحليل بالذكاء الاصطناعي (Claude Sonnet 4.6).
  const analyzeFrame = useCallback(async () => {
    if (analyzingRef.current) return
    const image = captureJpeg()
    if (!image) return
    analyzingRef.current = true
    setAnalyzing(true)
    try {
      const res = await fetch("/api/ai-monitoring/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image,
          cameraId: cameraName || "كاميرا الهاتف",
          cameraLocation: location,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLastResult({ at: Date.now(), count: 0, detections: [], error: data?.error || "خطأ في التحليل" })
      } else {
        setLastResult({ at: Date.now(), count: data.count ?? 0, detections: data.detections ?? [] })
      }
    } catch {
      setLastResult({ at: Date.now(), count: 0, detections: [], error: "تعذّر الاتصال بالخادم" })
    } finally {
      analyzingRef.current = false
      setAnalyzing(false)
    }
  }, [captureJpeg, cameraName, location])

  const stop = useCallback(() => {
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current)
      uploadIntervalRef.current = null
    }
    if (analyzeIntervalRef.current) {
      clearInterval(analyzeIntervalRef.current)
      analyzeIntervalRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
    setStreaming(false)
    setAnalyzing(false)
    setLastUploadOkAt(null)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("متصفحك لا يدعم الوصول إلى الكاميرا.")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      // محاولة إبقاء الشاشة مضاءة أثناء البث.
      try {
        const wl = (navigator as unknown as {
          wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> }
        }).wakeLock
        if (wl) wakeLockRef.current = await wl.request("screen")
      } catch {
        /* غير مدعوم — يتم التجاهل */
      }
      setStreaming(true)
      // رفع فوري + تحليل فوري، ثم كل حلقة بوتيرتها.
      uploadFrame()
      analyzeFrame()
      uploadIntervalRef.current = setInterval(uploadFrame, UPLOAD_INTERVAL_MS)
      analyzeIntervalRef.current = setInterval(analyzeFrame, ANALYZE_INTERVAL_MS)
    } catch (err) {
      const name = err instanceof Error ? err.name : ""
      if (name === "NotAllowedError") setError("تم رفض إذن الكاميرا. فعّله من إعدادات المتصفح.")
      else if (name === "NotFoundError") setError("لم يتم العثور على كاميرا في هذا الجهاز.")
      else setError("تعذّر تشغيل الكاميرا.")
    }
  }, [uploadFrame, analyzeFrame])

  useEffect(() => () => stop(), [stop])

  const connected = streaming && lastUploadOkAt != null && now - lastUploadOkAt < CONNECTED_THRESHOLD_MS

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      {/* تنبيه إبقاء الشاشة والشحن */}
      <Card className="flex items-start gap-3 border-accent/30 bg-accent/10 p-4">
        <BatteryCharging className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          أبقِ الشاشة مفتوحة والهاتف بالشحن أثناء البث لضمان استمرار رفع الإطارات وتحليلها.
        </p>
      </Card>

      {/* حقول الكاميرا */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">اسم الكاميرا</span>
          <input
            value={cameraName}
            onChange={(e) => setCameraName(e.target.value)}
            placeholder="مثال: كاميرا الب��ابة 1"
            disabled={streaming}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">الموقع</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="مثال: ساحة الرافعات الشمالية"
            disabled={streaming}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
          />
        </label>
      </div>

      {/* معاينة الكاميرا */}
      <Card className="relative overflow-hidden bg-black p-0">
        <video
          ref={videoRef}
          playsInline
          muted
          className="aspect-[3/4] w-full object-cover sm:aspect-video"
        />
        {!streaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-white/70">
            <Camera className="size-10" />
            <span className="text-sm">اضغط «بدء البث» لتشغيل الكاميرا الخلفية</span>
          </div>
        )}
        {streaming && (
          <div
            className={cn(
              "absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white",
              connected ? "bg-black/60" : "bg-destructive/80",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                connected ? "animate-pulse bg-destructive" : "bg-white/70",
              )}
            />
            {connected ? "بث مباشر" : "إعادة الاتصال…"}
          </div>
        )}
        {analyzing && (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
            <Loader2 className="size-3.5 animate-spin" />
            جارٍ التحليل
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </Card>

      {error && (
        <Card className="flex items-start gap-3 border-destructive/30 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {streaming && uploadError && (
        <Card className="flex items-start gap-3 border-destructive/30 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{uploadError}</p>
        </Card>
      )}

      {/* أزرار التحكم */}
      <div className="flex gap-3">
        {!streaming ? (
          <button
            onClick={start}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Play className="size-4" />
            بدء البث
          </button>
        ) : (
          <button
            onClick={stop}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90"
          >
            <Square className="size-4" />
            إيقاف البث
          </button>
        )}
      </div>

      {/* حالة الاتصال والعدادات */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-xs text-muted-foreground">حالة الاتصال</span>
          <span
            className={cn(
              "flex items-center gap-1.5 text-sm font-semibold",
              streaming ? (connected ? "text-primary" : "text-destructive") : "text-muted-foreground",
            )}
          >
            {streaming ? (
              connected ? (
                <>
                  <Wifi className="size-4" />
                  متصل
                </>
              ) : (
                <>
                  <WifiOff className="size-4" />
                  منقطع
                </>
              )
            ) : (
              <>
                <WifiOff className="size-4" />
                متوقف
              </>
            )}
          </span>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-xs text-muted-foreground">الإطارات المرفوعة</span>
          <span className="text-2xl font-bold text-foreground">{sentCount}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-xs text-muted-foreground">آخر رفع</span>
          <span className="text-sm font-medium text-foreground" dir="ltr">
            {lastUploadAt ? new Date(lastUploadAt).toLocaleTimeString("ar") : "—"}
          </span>
        </Card>
      </div>

      {/* آخر نتيجة تحليل */}
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">آخر نتيجة تحليل</span>
          {lastResult && !lastResult.error && lastResult.count === 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              <CheckCircle2 className="size-3.5" />
              لا مخالفات
            </span>
          )}
        </div>
        {!lastResult ? (
          <p className="text-sm text-muted-foreground">لم يتم إرسال أي إطار للتحليل بعد.</p>
        ) : lastResult.error ? (
          <p className="text-sm text-destructive">{lastResult.error}</p>
        ) : lastResult.count === 0 ? (
          <p className="text-sm text-muted-foreground">لم تُرصد أي مخالفة في آخر إطار.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lastResult.detections.map((d, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-foreground">
                    {detectionTypeLabels[d.type] ?? d.type}
                  </div>
                  {d.description && (
                    <div className="text-xs text-muted-foreground">{d.description}</div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                      severityStyles[d.severity] ?? "",
                    )}
                  >
                    {severityLabels[d.severity] ?? d.severity}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                    {d.confidence}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
