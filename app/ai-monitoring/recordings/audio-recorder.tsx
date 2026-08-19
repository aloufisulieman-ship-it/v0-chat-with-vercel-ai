"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, Square, Save, UploadCloud, CheckCircle2, Loader2, Trash2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { upload } from "@vercel/blob/client"

// اختيار أفضل صيغة تسجيل صوتي مدعومة في المتصفح (WebM/Opus أولاً ثم بدائل).
function pickAudioMime(): { mimeType: string; ext: string } {
  const candidates: { mimeType: string; ext: string }[] = [
    { mimeType: "audio/webm;codecs=opus", ext: "webm" },
    { mimeType: "audio/webm", ext: "webm" },
    { mimeType: "audio/ogg;codecs=opus", ext: "ogg" },
    { mimeType: "audio/mp4", ext: "mp4" },
    { mimeType: "audio/mpeg", ext: "mp3" },
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

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

// بيانات وصفية للنسخة الصوتية: تُحفظ محلياً مؤقتاً ثم تُرفق عند الرفع.
type AudioMeta = {
  recordedAt: string // ISO
  cameraName: string
  recordingId: number | null
  violationId: number | null
  durationSeconds: number
  ext: string
}

type SavedClip = {
  blob: Blob
  url: string // object URL للتشغيل المحلي المؤقت
  meta: AudioMeta
}

type Phase = "idle" | "recording" | "saved" | "uploading" | "uploaded"

export function AudioRecorder({
  cameraName,
  recordingId = null,
  violationId = null,
}: {
  cameraName: string
  recordingId?: number | null
  violationId?: number | null
}) {
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number>(0)
  const mimeRef = useRef<{ mimeType: string; ext: string }>({ mimeType: "", ext: "webm" })

  const [phase, setPhase] = useState<Phase>("idle")
  const [seconds, setSeconds] = useState(0)
  const [clip, setClip] = useState<SavedClip | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recording = phase === "recording"

  // تنظيف الموارد (البث، المؤقت، وروابط الكائن) عند إلغاء تحميل المكوّن.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (clip?.url) URL.revokeObjectURL(clip.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // بدء التسجيل: يطلب صلاحية الميكروفون ثم يبدأ MediaRecorder.
  const startRecording = useCallback(async () => {
    setError(null)
    // تجاهل نسخة سابقة إن وُجدت (يبدأ المستخدم تسجيلاً جديداً).
    if (clip?.url) URL.revokeObjectURL(clip.url)
    setClip(null)
    setUploadedUrl(null)
    setProgress(0)

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("متصفحك لا يدعم تسجيل الصوت. جرّب متصفحاً حديثاً.")
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      const name = err instanceof Error ? err.name : ""
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("تم رفض إذن الميكروفون. فعّله من إعدادات المتصفح ثم حاول مجدداً.")
      } else if (name === "NotFoundError") {
        setError("لم يتم العثور على ميكروفون في هذا الجهاز.")
      } else {
        setError("تعذّر الوصول إلى الميكروفون. حاول مرة أخرى.")
      }
      return
    }

    streamRef.current = stream
    const mime = pickAudioMime()
    mimeRef.current = mime
    chunksRef.current = []

    let recorder: MediaRecorder
    try {
      recorder = mime.mimeType ? new MediaRecorder(stream, { mimeType: mime.mimeType }) : new MediaRecorder(stream)
    } catch {
      recorder = new MediaRecorder(stream)
    }
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onerror = () => {
      setError("حدث خطأ أثناء التسجيل. حاول مرة أخرى.")
    }

    recorder.start(1000) // جمع القطع كل ثانية لضمان عدم فقدان الصوت عند الإيقاف.
    startRef.current = Date.now()
    setSeconds(0)
    setPhase("recording")
    timerRef.current = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startRef.current) / 1000))
    }, 500)
  }, [clip])

  // إيقاف التسجيل وحفظ النسخة محلياً (Blob + رابط تشغيل + بيانات وصفية).
  const saveClip = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") return

    const durationSeconds = Math.max(1, Math.round((Date.now() - startRef.current) / 1000))

    recorder.onstop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null

      const ext = mimeRef.current.ext || "webm"
      const type = mimeRef.current.mimeType || `audio/${ext}`
      const blob = new Blob(chunksRef.current, { type })
      chunksRef.current = []

      if (blob.size === 0) {
        setError("لم يُسجّل أي صوت. تحقق من الميكروفون وحاول مجدداً.")
        setPhase("idle")
        return
      }

      const url = URL.createObjectURL(blob)
      const meta: AudioMeta = {
        recordedAt: new Date().toISOString(),
        cameraName,
        recordingId,
        violationId,
        durationSeconds,
        ext,
      }
      setClip({ blob, url, meta })
      setPhase("saved")
    }

    try {
      recorder.stop()
    } catch {
      setError("تعذّر إيقاف التسجيل. حاول مرة أخرى.")
    }
  }, [cameraName, recordingId, violationId])

  // إلغاء النسخة المحفوظة والبدء من جديد.
  const discardClip = useCallback(() => {
    if (clip?.url) URL.revokeObjectURL(clip.url)
    setClip(null)
    setUploadedUrl(null)
    setProgress(0)
    setError(null)
    setPhase("idle")
  }, [clip])

  // رفع النسخة الصوتية إلى نفس تخزين Blob المستخدم للتسجيلات، مع شريط تقدم.
  const uploadClip = useCallback(async () => {
    if (!clip) return
    setError(null)
    setProgress(0)
    setPhase("uploading")

    const { blob, meta } = clip
    const safeCam = encodeURIComponent(meta.cameraName || "camera")
    const stamp = Date.now()
    const path = `recordings/${safeCam}/audio/${stamp}.${meta.ext}`
    // نمرّر النوع الأساسي فقط (بدون ";codecs=...") لأن مطابقة Vercel Blob تامة.
    const baseContentType = (blob.type || `audio/${meta.ext}`).split(";")[0].trim()

    try {
      const uploaded = await upload(path, blob, {
        access: "public",
        handleUploadUrl: "/api/ai-monitoring/upload-recording",
        contentType: baseContentType,
        clientPayload: JSON.stringify(meta),
        onUploadProgress: (e) => setProgress(Math.round(e.percentage)),
      })
      setUploadedUrl(uploaded.url)
      setProgress(100)
      setPhase("uploaded")
    } catch (err) {
      // تمييز انقطاع الاتصال عن أخطاء الخادم لرسالة أوضح.
      const offline = typeof navigator !== "undefined" && navigator.onLine === false
      if (offline) {
        setError("انقطع الاتصال بالإنترنت. تحقق من الشبكة ثم أعد الرفع.")
      } else {
        setError(err instanceof Error ? err.message : "تعذّر رفع النسخة الصوتية. حاول مجدداً.")
      }
      setPhase("saved")
    }
  }, [clip])

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Mic className="size-4 text-primary" />
          نسخة صوتية
        </h3>
        {/* مؤشر الحالة بنفس نمط مؤشر البث الحي: نقطة نابضة عند التسجيل. */}
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <span
            className={cn(
              "size-2 rounded-full",
              recording ? "animate-pulse bg-destructive" : "bg-muted-foreground/50",
            )}
            aria-hidden="true"
          />
          <span className={recording ? "text-destructive" : "text-muted-foreground"}>
            {recording ? `يسجّل • ${formatClock(seconds)}` : "غير نشط"}
          </span>
        </span>
      </div>

      <p className="text-xs text-muted-foreground text-pretty">
        سجّل ملاحظة صوتية مرتبطة بـ{" "}
        <span className="font-medium text-foreground">{cameraName}</span>
        {clip?.meta.recordingId != null && ` (تسجيل #${clip.meta.recordingId})`} لتوثيق الحادثة أو المخالفة.
      </p>

      {/* أزرار التحكم حسب المرحلة */}
      <div className="flex flex-wrap items-center gap-2">
        {!recording && phase !== "uploading" && (
          <Button onClick={startRecording} className="gap-2">
            <Mic className="size-4" />
            {clip ? "تسجيل نسخة جديدة" : "تشغيل الميكروفون"}
          </Button>
        )}

        {recording && (
          <Button onClick={saveClip} variant="destructive" className="gap-2">
            <Square className="size-4" />
            إيقاف وحفظ النسخة
          </Button>
        )}

        {clip && (phase === "saved" || phase === "uploaded") && (
          <>
            {phase !== "uploaded" && (
              <Button onClick={uploadClip} className="gap-2">
                <UploadCloud className="size-4" />
                رفع النسخة
              </Button>
            )}
            <Button onClick={discardClip} variant="outline" className="gap-2">
              <Trash2 className="size-4" />
              حذف
            </Button>
          </>
        )}

        {phase === "uploading" && (
          <Button disabled className="gap-2">
            <Loader2 className="size-4 animate-spin" />
            جارٍ الرفع…
          </Button>
        )}
      </div>

      {/* حالة "محفوظة محلياً" مع مشغّل صوت ومعلومات وصفية */}
      {clip && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Save className="size-3.5 text-primary" />
            نسخة محفوظة محلياً • {formatClock(clip.meta.durationSeconds)}
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={clip.url} controls className="w-full" />
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              التاريخ:{" "}
              {new Date(clip.meta.recordedAt).toLocaleString("ar", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Riyadh",
              })}
            </span>
            <span>الموقع/الكاميرا: {clip.meta.cameraName}</span>
            {clip.meta.recordingId != null && <span>التسجيل: #{clip.meta.recordingId}</span>}
            {clip.meta.violationId != null && <span>المخالفة: #{clip.meta.violationId}</span>}
          </div>
        </div>
      )}

      {/* شريط التقدم أثناء الرفع */}
      {phase === "uploading" && (
        <div className="flex flex-col gap-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground">جارٍ رفع النسخة الصوتية… {progress}%</span>
        </div>
      )}

      {/* تأكيد نجاح الرفع */}
      {phase === "uploaded" && uploadedUrl && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
          <CheckCircle2 className="size-4 shrink-0" />
          تم رفع النسخة الصوتية بنجاح.
        </div>
      )}

      {/* رسائل الخطأ بالعربية */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span className="text-pretty">{error}</span>
        </div>
      )}
    </div>
  )
}
