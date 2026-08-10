'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Camera, CameraOff, CheckCircle2, Loader2, Radio, ScanLine, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const detectionLabels: Record<string, string> = {
  pedestrian_near_forklift: 'اقتراب مشاة من مسار رافعة', restricted_area_entry: 'دخول منطقة محظورة',
  overspeed: 'سرعة زائدة', unsafe_stacking: 'تكديس غير آمن', traffic_congestion: 'ازدحام مروري', missing_ppe: 'عدم ارتداء معدات الوقاية',
}
const severityLabels: Record<string, string> = { low: 'منخفض', medium: 'متوسط', high: 'عالٍ', critical: 'حرج' }
type Analysis = { detected: boolean; detection?: { detectionId: string; detectionType: string; severity: string; confidenceScore: string; detectedAt: string } }

export function MobileCameraClient() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const busyRef = useRef(false)
  const [cameraId, setCameraId] = useState('')
  const [cameraLocation, setCameraLocation] = useState('')
  const [intervalSeconds, setIntervalSeconds] = useState(8)
  const [streaming, setStreaming] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [lastAnalysis, setLastAnalysis] = useState<Analysis | null>(null)
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(0)

  const stopCamera = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStreaming(false)
    setCountdown(0)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const analyzeFrame = useCallback(async () => {
    const video = videoRef.current
    if (!video || !streamRef.current || busyRef.current || video.readyState < 2) return
    busyRef.current = true
    setAnalyzing(true)
    try {
      const canvas = document.createElement('canvas')
      const maxWidth = 1280
      const scale = Math.min(1, maxWidth / video.videoWidth)
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
      const image = canvas.toDataURL('image/jpeg', 0.78)
      const response = await fetch('/api/ai-monitoring/analyze', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image, cameraId: cameraId.trim(), cameraLocation: cameraLocation.trim() }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'تعذر تحليل الإطار')
      setLastAnalysis(result)
      setLastSentAt(new Date())
      setCountdown(intervalSeconds)
      if (result.detected) {
        const severity = result.detection?.severity
        const message = `رُصدت ${detectionLabels[result.detection?.detectionType] ?? 'مخالفة سلامة'}`
        if (severity === 'high' || severity === 'critical') toast.error(message)
        else toast.warning(message)
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'حدث خطأ غير متوقع'
      setError(message)
      toast.error(message)
    } finally {
      busyRef.current = false
      setAnalyzing(false)
    }
  }, [cameraId, cameraLocation, intervalSeconds])

  async function startCamera() {
    if (!cameraId.trim() || !cameraLocation.trim()) {
      setError('أدخل اسم الكاميرا والموقع قبل بدء البث')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('هذا المتصفح لا يدعم الوصول إلى الكاميرا أو أن الصفحة ليست عبر اتصال آمن HTTPS')
      return
    }
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStreaming(true)
      setCountdown(intervalSeconds)
      await analyzeFrame()
      timerRef.current = setInterval(analyzeFrame, intervalSeconds * 1000)
    } catch (cause) {
      setError(cause instanceof DOMException && cause.name === 'NotAllowedError' ? 'تم رفض إذن الكاميرا. اسمح بالوصول من إعدادات المتصفح ثم حاول مجدداً.' : 'تعذر تشغيل الكاميرا الخلفية. تحقق من عدم استخدامها في تطبيق آخر.')
      stopCamera()
    }
  }

  useEffect(() => {
    if (!streaming) return
    const countdownTimer = setInterval(() => setCountdown(current => current > 0 ? current - 1 : intervalSeconds), 1000)
    return () => clearInterval(countdownTimer)
  }, [streaming, intervalSeconds])

  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-medium text-primary">AI Smart Monitoring</p><h1 className="text-balance text-2xl font-bold sm:text-3xl">بث كاميرا الهاتف - مراقبة حية</h1><p className="mt-1 text-pretty text-sm leading-6 text-muted-foreground">ثبّت الهاتف في موضع آمن، ثم أرسل إطارات دورية للتحليل دون تسجيل فيديو أو صوت.</p></div>
      <Badge variant={streaming ? 'default' : 'secondary'} className="w-fit"><Radio />{streaming ? 'البث نشط' : 'البث متوقف'}</Badge>
    </div>

    {error && <Alert variant="destructive"><AlertCircle /><AlertTitle>تعذر إكمال العملية</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

    <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
      <Card className="overflow-hidden">
        <CardHeader><CardTitle className="flex items-center gap-2"><Camera />معاينة الكاميرا الخلفية</CardTitle><CardDescription>لا تغادر الصفحة أثناء البث، وأبقِ الشاشة والجهاز متصلين بالطاقة.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="relative aspect-[3/4] overflow-hidden rounded-xl border bg-muted sm:aspect-video">
            <video ref={videoRef} muted playsInline className="size-full object-cover" aria-label="معاينة كاميرا الهاتف" />
            {!streaming && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/95 text-center"><CameraOff className="size-10 text-muted-foreground" /><p className="max-w-64 text-sm leading-6 text-muted-foreground">أدخل بيانات المصدر ثم اضغط بدء البث للسماح بالكاميرا الخلفية.</p></div>}
            {analyzing && <div className="absolute inset-x-3 top-3 flex items-center justify-center gap-2 rounded-lg bg-background/90 p-2 text-sm font-medium"><Loader2 className="animate-spin" />جارٍ تحليل الإطار</div>}
            {streaming && <div className="absolute bottom-3 right-3 rounded-md bg-background/90 px-3 py-1.5 font-mono text-xs">الإرسال التالي: {countdown} ث</div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" onClick={streaming ? stopCamera : startCamera} variant={streaming ? 'destructive' : 'default'}>{streaming ? <CameraOff data-icon="inline-start" /> : <Camera data-icon="inline-start" />}{streaming ? 'إيقاف البث' : 'بدء البث'}</Button>
            <Button size="lg" variant="outline" disabled={!streaming || analyzing} onClick={analyzeFrame}><ScanLine data-icon="inline-start" />تحليل الآن</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card><CardHeader><CardTitle>إعداد مصدر الكاميرا</CardTitle><CardDescription>تُسجّل هذه البيانات مع كل اكتشاف.</CardDescription></CardHeader><CardContent><FieldGroup>
          <Field data-disabled={streaming}><FieldLabel htmlFor="camera-id">اسم الكاميرا</FieldLabel><Input id="camera-id" value={cameraId} disabled={streaming} onChange={event => setCameraId(event.target.value)} placeholder="مثال: هاتف الرافعة 03" autoComplete="off" /></Field>
          <Field data-disabled={streaming}><FieldLabel htmlFor="camera-location">الموقع</FieldLabel><Input id="camera-location" value={cameraLocation} disabled={streaming} onChange={event => setCameraLocation(event.target.value)} placeholder="مثال: ساحة الشحن أ" autoComplete="off" /></Field>
          <Field data-disabled={streaming}><FieldLabel>فترة التحليل</FieldLabel><Select disabled={streaming} value={String(intervalSeconds)} onValueChange={value => setIntervalSeconds(Number(value))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{[5,8,10,15].map(value => <SelectItem key={value} value={String(value)}>كل {value} ثوانٍ</SelectItem>)}</SelectGroup></SelectContent></Select><FieldDescription>الفترة الأقصر تستهلك بيانات وتحليلات أكثر.</FieldDescription></Field>
        </FieldGroup></CardContent></Card>

        <Card><CardHeader><CardTitle>آخر نتيجة</CardTitle><CardDescription>{lastSentAt ? `آخر إرسال ${lastSentAt.toLocaleTimeString('ar-SA')}` : 'لم يُرسل أي إطار بعد'}</CardDescription></CardHeader><CardContent>{!lastAnalysis ? <p className="text-sm leading-6 text-muted-foreground">ستظهر نتيجة آخر إطار هنا فور اكتمال التحليل.</p> : lastAnalysis.detected && lastAnalysis.detection ? <Alert variant={['high','critical'].includes(lastAnalysis.detection.severity) ? 'destructive' : 'default'}><ShieldAlert /><AlertTitle>{detectionLabels[lastAnalysis.detection.detectionType]}</AlertTitle><AlertDescription><p>الخطورة: {severityLabels[lastAnalysis.detection.severity]} — الثقة: {Number(lastAnalysis.detection.confidenceScore).toFixed(0)}%</p><p className="font-mono" dir="ltr">{lastAnalysis.detection.detectionId}</p></AlertDescription></Alert> : <Alert><CheckCircle2 /><AlertTitle>الإطار آمن</AlertTitle><AlertDescription>لم يرصد النموذج واحدة من مخالفات السلامة الست.</AlertDescription></Alert>}</CardContent></Card>
      </div>
    </div>
  </div>
}
