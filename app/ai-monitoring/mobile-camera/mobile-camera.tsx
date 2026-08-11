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
  Video,
  CircleStop,
  UploadCloud,
  Eye,
  Mic,
  MicOff,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { detectionTypeLabels, severityLabels, severityStyles } from "@/lib/ai-monitoring"
import { upload } from "@vercel/blob/client"
import { createRecording } from "@/app/actions/recordings"
import { useWebrtcBroadcaster } from "./use-webrtc-broadcaster"

// رفع الإطار إلى Blob بوتيرة سريعة (بث شبه حي، ~2.5 إطار/ثانية)،
// والتحليل بالذكاء الاصطناعي أبطأ بكثير (كل 8 ثوانٍ) لإبقاء تكلفة AI ثابتة.
const UPLOAD_INTERVAL_MS = 400
const ANALYZE_INTERVAL_MS = 8000
// تُعتبر الكاميرا "متصلة" إذا نجح آخر رفع خلال آخر 3 ثوانٍ.
const CONNECTED_THRESHOLD_MS = 3000
// دقة ومستوى ضغط أقل لتسريع الرفع وتقليل استهلاك البيانات (~640×480).
const MAX_WIDTH = 640
const JPEG_QUALITY = 0.45

type LastResult = {
  at: number
  count: number
  detections: { type: string; severity: string; confidence: number; description: string }[]
  error?: string
}

// اختيار أفضل صيغة تسجيل مدعومة في المتصفح (WebM أولاً ثم MP4).
function pickRecordingMime(): { mimeType: string; ext: string } {
  const candidates: { mimeType: string; ext: string }[] = [
    { mimeType: "video/webm;codecs=vp9", ext: "webm" },
    { mimeType: "video/webm;codecs=vp8", ext: "webm" },
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

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
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

  // مراجع التسجيل بالفيديو (MediaRecorder).
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordStartRef = useRef<number>(0)
  const recordMimeRef = useRef<{ mimeType: string; ext: string }>({ mimeType: "", ext: "webm" })

  // حالة الميكروفون: مفعّل افتراضياً حتى يُبثّ الصوت مع الفيديو للمدير.
  const [micEnabled, setMicEnabled] = useState(true)
  const micEnabledRef = useRef(true)

  const [inspectorName, setInspectorName] = useState("")
  const [location, setLocation] = useState("")
  // الجلسة تبدأ فقط بعد تعبئة اسم المفتش والموقع؛ لا يُفعَّل البث/التسجيل قبلها.
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentCount, setSentCount] = useState(0)
  const [lastUploadAt, setLastUploadAt] = useState<number | null>(null)
  const [lastUploadOkAt, setLastUploadOkAt] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [lastResult, setLastResult] = useState<LastResult | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // حالة التسجيل.
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [savingRecording, setSavingRecording] = useState(false)
  const [recordMsg, setRecordMsg] = useState<string | null>(null)
  const [recordError, setRecordError] = useState<string | null>(null)

  // مؤقت محلي لتحديث مؤشر الاتصال والوقت.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // استرجاع اسم المفتش والموقع من التخزين المحلي (تسهيلاً على المفتش نفسه لاحقاً).
  useEffect(() => {
    setInspectorName(localStorage.getItem("aiCam.inspector") ?? "")
    setLocation(localStorage.getItem("aiCam.location") ?? "")
  }, [])

  useEffect(() => {
    localStorage.setItem("aiCam.inspector", inspectorName)
  }, [inspectorName])
  useEffect(() => {
    localStorage.setItem("aiCam.location", location)
  }, [location])

  // بدء الجلسة: يتطلب تعبئة الحقلين الإلزاميين قبل تفعيل أزرار البث/التسجيل.
  const bothFilled = inspectorName.trim().length > 0 && location.trim().length > 0
  const startSession = useCallback(() => {
    if (!bothFilled) {
      setSessionError("يرجى تعبئة اسم المفتش/الموظف والموقع قبل بدء الجلسة.")
      return
    }
    setSessionError(null)
    setSessionStarted(true)
  }, [bothFilled])

  // ضمان وجود بث كاميرا نشط (يُستخدم للبث والتسجيل معاً). يعيد الـ stream أو يرمي خطأً.
  const ensureStream = useCallback(async (): Promise<MediaStream> => {
    if (streamRef.current) return streamRef.current
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("متصفحك لا يدعم الوصول إلى الكاميرا.")
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    })
    // إضافة مسار الميكروفون (اختياري) لبثّ الصوت مع الفيديو للمدير. الفشل غير قاتل:
    // إن رُفض الإذن أو لم يتوفر ميكروفون، يستمر البث بالفيديو فقط.
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      const audioTrack = mic.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = micEnabledRef.current
        stream.addTrack(audioTrack)
      }
    } catch {
      /* الميكروفون غير متاح — بثّ فيديو فقط */
    }
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play().catch(() => {})
    }
    // محاولة إبقاء الشاشة مضاءة أثناء البث/التسجيل.
    try {
      const wl = (navigator as unknown as {
        wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> }
      }).wakeLock
      if (wl && !wakeLockRef.current) wakeLockRef.current = await wl.request("screen")
    } catch {
      /* غير مدعوم — يتم التجاهل */
    }
    return stream
  }, [])

  // إيقاف الكاميرا فعلياً فقط عندما لا يوجد بث ولا تسجيل نشط.
  const releaseStreamIfIdle = useCallback((stillStreaming: boolean, stillRecording: boolean) => {
    if (stillStreaming || stillRecording) return
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }, [])

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

  // الحلقة ا��سريعة: رفع الإطار إلى Blob للبث شبه الحي.
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
          inspectorName: inspectorName || "كاميرا الهاتف",
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
  }, [captureJpeg, inspectorName, location])

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
          inspectorName: inspectorName || "كاميرا الهاتف",
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
  }, [captureJpeg, inspectorName, location])

  // بدء البث الحي (رفع الإطارات + التحليل).
  const startStreaming = useCallback(async () => {
    setError(null)
    try {
      await ensureStream()
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
      else setError(err instanceof Error ? err.message : "تعذّر تشغيل الكاميرا.")
    }
  }, [ensureStream, uploadFrame, analyzeFrame])

  const stopStreaming = useCallback(() => {
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current)
      uploadIntervalRef.current = null
    }
    if (analyzeIntervalRef.current) {
      clearInterval(analyzeIntervalRef.current)
      analyzeIntervalRef.current = null
    }
    setStreaming(false)
    setAnalyzing(false)
    setLastUploadOkAt(null)
    releaseStreamIfIdle(false, recorderRef.current !== null)
  }, [releaseStreamIfIdle])

  // التقاط إطار مصغّر (poster) من الفيديو الحي لعرضه كمعاينة للتسجيل.
  const capturePosterDataUrl = useCallback((): string | null => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    try {
      const canvas = document.createElement("canvas")
      const w = 640
      const scale = w / video.videoWidth
      canvas.width = w
      canvas.height = Math.round(video.videoHeight * scale) || 480
      const ctx = canvas.getContext("2d")
      if (!ctx) return null
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL("image/jpeg", 0.6)
    } catch {
      return null
    }
  }, [])

  // رفع الفيديو المُسجّل (والمعاينة) إلى Blob مباشرةً من المتصفح ثم إنشاء سجل في القاعدة.
  const uploadRecording = useCallback(
    async (blob: Blob, durationSeconds: number, posterDataUrl: string | null) => {
      const camId = inspectorName || "كاميرا الهاتف"
      const ext = recordMimeRef.current.ext || "webm"
      const stamp = Date.now()
      const path = `recordings/${encodeURIComponent(camId)}/${stamp}.${ext}`
      setSavingRecording(true)
      setRecordError(null)
      setRecordMsg(null)
      try {
        const uploaded = await upload(path, blob, {
          access: "public",
          handleUploadUrl: "/api/ai-monitoring/upload-recording",
          contentType: blob.type || `video/${ext}`,
        })

        // رفع المعاينة (اختياري — نتجاهل فشلها حتى لا يتعطّل حفظ الفيديو).
        let posterUrl = ""
        if (posterDataUrl) {
          try {
            const posterBlob = await (await fetch(posterDataUrl)).blob()
            const posterPath = `recordings/${encodeURIComponent(camId)}/${stamp}-poster.jpg`
            const up = await upload(posterPath, posterBlob, {
              access: "public",
              handleUploadUrl: "/api/ai-monitoring/upload-recording",
              contentType: "image/jpeg",
            })
            posterUrl = up.url
          } catch {
            /* تجاهل فشل المعاينة */
          }
        }

        await createRecording({
          cameraId: camId,
          cameraName: camId,
          videoUrl: uploaded.url,
          posterUrl,
          durationSeconds,
          fileSizeBytes: blob.size,
        })
        setRecordMsg(`تم حفظ التسجيل (${formatDuration(durationSeconds)}) بنجاح.`)
      } catch (err) {
        console.log("[v0] recording upload failed:", err instanceof Error ? err.message : err)
        setRecordError(err instanceof Error ? err.message : "تعذّر رفع التسجيل. حاول مجدداً.")
      } finally {
        setSavingRecording(false)
      }
    },
    [inspectorName],
  )

  // بدء تسجيل الفيديو من نفس بث الكاميرا (يعمل مع البث أو بمفرده).
  const startRecording = useCallback(async () => {
    setError(null)
    setRecordError(null)
    setRecordMsg(null)
    if (typeof MediaRecorder === "undefined") {
      setRecordError("متصفحك لا يدعم تسجيل الفيديو (MediaRecorder).")
      return
    }
    try {
      const stream = await ensureStream()
      const mime = pickRecordingMime()
      recordMimeRef.current = mime
      const recorder = mime.mimeType ? new MediaRecorder(stream, { mimeType: mime.mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const durationSeconds = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000))
        const blob = new Blob(chunksRef.current, { type: mime.mimeType || "video/webm" })
        chunksRef.current = []
        recorderRef.current = null
        // التقط المعاينة من الفيديو الحي قبل تحرير الكاميرا.
        const poster = capturePosterDataUrl()
        if (blob.size > 0) void uploadRecording(blob, durationSeconds, poster)
        else setRecordError("التسجيل فارغ — لم تُلتقط أي بيانات فيديو.")
        // حرّر الكاميرا إن لم يكن البث الحي شغّالاً.
        releaseStreamIfIdle(uploadIntervalRef.current !== null, false)
      }
      recorder.start(1000) // تجميع البيانات كل ثانية
      recorderRef.current = recorder
      recordStartRef.current = Date.now()
      setRecordSeconds(0)
      setRecording(true)
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds(Math.floor((Date.now() - recordStartRef.current) / 1000))
      }, 500)
    } catch (err) {
      const name = err instanceof Error ? err.name : ""
      if (name === "NotAllowedError") setError("تم رفض إذن الكاميرا. فعّله من إعدادات المتصفح.")
      else if (name === "NotFoundError") setError("لم يتم العثور على كاميرا في هذا الجهاز.")
      else setError(err instanceof Error ? err.message : "تعذّر بدء التسجيل.")
    }
  }, [ensureStream, uploadRecording, releaseStreamIfIdle, capturePosterDataUrl])

  const stopRecording = useCallback(() => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
    setRecording(false)
    try {
      recorderRef.current?.stop() // يشغّل onstop الذي يرفع الفيديو
    } catch {
      recorderRef.current = null
    }
  }, [])

  // تنظيف عند مغادرة الصفحة.
  useEffect(
    () => () => {
      if (uploadIntervalRef.current) clearInterval(uploadIntervalRef.current)
      if (analyzeIntervalRef.current) clearInterval(analyzeIntervalRef.current)
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
      try {
        recorderRef.current?.stop()
      } catch {
        /* تجاهل */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
    },
    [],
  )

  const connected = streaming && lastUploadOkAt != null && now - lastUploadOkAt < CONNECTED_THRESHOLD_MS
  const cameraOn = streaming || recording

  // كتم/تفعيل الصوت المبثوث: يبدّل enabled على مسار الميكروفون دون إعادة تفاوض.
  const toggleMic = useCallback(() => {
    setMicEnabled((prev) => {
      const next = !prev
      micEnabledRef.current = next
      streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next))
      return next
    })
  }, [])

  // البث الحي المباشر (WebRTC): يعيد استخدام نفس بث الكاميرا وينقله للمدير لحظياً
  // كلما كانت الكاميرا تصوّر (بث أو تسجيل). مستقل عن رفع الإطارات/التحليل ويعمل ندّاً لِند.
  const getStream = useCallback(() => streamRef.current, [])
  const { viewerCount, error: broadcastError } = useWebrtcBroadcaster({ active: cameraOn, inspectorName, getStream })

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      {/* تنبيه إبقاء الشاشة والشحن */}
      <Card className="flex items-start gap-3 border-accent/30 bg-accent/10 p-4">
        <BatteryCharging className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          أبقِ الشاشة مفتوحة والهاتف بالشحن أثناء البث أو التسجيل لضمان استمرار العمل.
        </p>
      </Card>

      {/* نموذج بدء الجلسة: اسم المفتش والموقع إلزاميان قبل تفعيل البث/التسجيل */}
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">بيانات الجلسة</span>
          {sessionStarted && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              <CheckCircle2 className="size-3.5" />
              الجلسة جاهزة
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              اسم المفتش/الموظف <span className="text-destructive">*</span>
            </span>
            <input
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              placeholder="مثال: خالد العتيبي"
              disabled={sessionStarted}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              الموقع <span className="text-destructive">*</span>
            </span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="مثال: بوابة رقم 3 أو منطقة التحميل"
              disabled={sessionStarted}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
            />
          </label>
        </div>
        {sessionError && <p className="text-sm text-destructive">{sessionError}</p>}
        {!sessionStarted ? (
          <button
            onClick={startSession}
            disabled={!bothFilled}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 className="size-4" />
            بدء الجلسة
          </button>
        ) : (
          <button
            onClick={() => setSessionStarted(false)}
            disabled={cameraOn}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            تعديل بيانات الجلسة
          </button>
        )}
        {sessionStarted && cameraOn && (
          <p className="text-xs text-muted-foreground">
            لا يمكن تعديل بيانات الجلسة أثناء البث أو التسجيل — أوقفهما أولاً.
          </p>
        )}
      </Card>

      {/* معاينة الكاميرا */}
      <Card className="relative overflow-hidden bg-black p-0">
        <video
          ref={videoRef}
          playsInline
          muted
          className="aspect-[3/4] w-full object-cover sm:aspect-video"
        />
        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-white/70">
            <Camera className="size-10" />
            <span className="text-sm">اضغط «بدء البث» أو «بدء التسجيل» لتشغيل الكاميرا الخلفية</span>
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
        {recording && (
          <div className="absolute left-3 bottom-3 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-xs font-semibold text-white">
            <span className="size-2 animate-pulse rounded-full bg-white" />
            تسجيل {formatDuration(recordSeconds)}
          </div>
        )}
        {cameraOn && viewerCount > 0 && (
          <div className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-primary/90 px-2.5 py-1 text-xs font-semibold text-primary-foreground">
            <Eye className="size-3.5" />
            المدير يشاهد مباشرة
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

      {cameraOn && broadcastError && (
        <Card className="flex items-start gap-3 border-destructive/30 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">تعذّر بثّ الفيديو الحي المباشر للمدير: {broadcastError}</p>
        </Card>
      )}

      {/* حالة رفع التسجيل */}
      {savingRecording && (
        <Card className="flex items-center gap-3 border-primary/30 bg-primary/10 p-4">
          <UploadCloud className="size-5 shrink-0 animate-pulse text-primary" />
          <p className="text-sm font-medium text-primary">جارٍ رفع التسجيل إلى الخادم… لا تغلق الصفحة.</p>
        </Card>
      )}
      {recordMsg && !savingRecording && (
        <Card className="flex items-center gap-3 border-primary/30 bg-primary/10 p-4">
          <CheckCircle2 className="size-5 shrink-0 text-primary" />
          <p className="text-sm font-medium text-primary">{recordMsg}</p>
        </Card>
      )}
      {recordError && (
        <Card className="flex items-start gap-3 border-destructive/30 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{recordError}</p>
        </Card>
      )}

      {/* أزرار التحكم: البث والتسجيل مستقلان — مقفلة حتى بدء الجلسة */}
      {!sessionStarted && (
        <p className="text-sm text-muted-foreground">
          ابدأ الجلسة أعلاه (اسم المفتش + الموقع) لتفعيل زر البث والتسجيل.
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        {!streaming ? (
          <button
            onClick={startStreaming}
            disabled={!sessionStarted}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="size-4" />
            بدء البث
          </button>
        ) : (
          <button
            onClick={stopStreaming}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90"
          >
            <Square className="size-4" />
            إيقاف البث
          </button>
        )}

        {!recording ? (
          <button
            onClick={startRecording}
            disabled={savingRecording || !sessionStarted}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-600 bg-red-600/10 px-4 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-600/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400"
          >
            <Video className="size-4" />
            بدء التسجيل
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            <CircleStop className="size-4" />
            إيقاف التسجيل · {formatDuration(recordSeconds)}
          </button>
        )}
      </div>

      {/* كتم/تفعيل الصوت المبثوث للمدير — يظهر أثناء البث أو التسجيل فقط */}
      {cameraOn && (
        <button
          onClick={toggleMic}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors",
            micEnabled
              ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
              : "border-border bg-muted text-muted-foreground hover:bg-muted/70",
          )}
          aria-pressed={micEnabled}
        >
          {micEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
          {micEnabled ? "الصوت مفعّل — يُبثّ للمدير" : "الصوت مكتوم"}
        </button>
      )}

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
          <span className="text-xs text-muted-foreground">مدة التسجيل</span>
          <span className="text-2xl font-bold text-foreground" dir="ltr">
            {formatDuration(recordSeconds)}
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
