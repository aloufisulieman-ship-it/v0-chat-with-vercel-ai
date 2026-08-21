"use client"

import { useMemo, useRef, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import Image from "next/image"
import {
  Video,
  Camera,
  Trash2,
  Clock,
  HardDrive,
  User,
  Film,
  FileWarning,
  Loader2,
  X,
  ChevronRight,
  ChevronLeft,
  Filter,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import {
  getRecordingsPage,
  getRecordingScreenshots,
  saveScreenshot,
  deleteRecording,
  deleteScreenshot,
  linkScreenshotToViolation,
  type VideoRecordingDto,
  type VideoScreenshotDto,
  type RecordingsPage,
} from "@/app/actions/recordings"
import { AudioRecorder } from "./audio-recorder"
import { useI18n } from "@/lib/i18n/client"
import type { TFunction } from "@/lib/i18n/translate"

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function fmtBytes(bytes: number, t: TFunction, fmt: (n: number) => string) {
  if (bytes <= 0) return t("aiMonitoring.cam.recBytesEmpty")
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return t("aiMonitoring.cam.recMB").replace("{n}", fmt(Number(mb.toFixed(1))))
  return t("aiMonitoring.cam.recKB").replace("{n}", fmt(Math.round(bytes / 1024)))
}

function fmtDate(iso: string, locale: string) {
  // تثبيت المنطقة الزمنية على توقيت الرياض لمنع عدم تطابق الترطيب وعرض التوقيت السعودي.
  return new Date(iso).toLocaleString(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Riyadh",
  })
}

export function RecordingsReview({ initialPage }: { initialPage: RecordingsPage }) {
  const { t, locale, formatNumber } = useI18n()
  const [camera, setCamera] = useState<string>("all")
  const [from, setFrom] = useState<string>("")
  const [to, setTo] = useState<string>("")
  const [page, setPage] = useState<number>(1)

  const key = ["recordings", camera, from, to, page] as const
  const { data = initialPage, mutate: mutateRecordings } = useSWR(
    key,
    () => getRecordingsPage({ camera, from, to, page, pageSize: initialPage.pageSize }),
    { fallbackData: initialPage, keepPreviousData: true },
  )

  const [selected, setSelected] = useState<VideoRecordingDto | null>(null)

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const hasFilters = camera !== "all" || from !== "" || to !== ""

  function resetFilters() {
    setCamera("all")
    setFrom("")
    setTo("")
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* شريط التصفية */}
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Filter className="size-4" />
          {t("common.filter")}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("aiMonitoring.cam.recCamera")}</span>
          <select
            value={camera}
            onChange={(e) => {
              setCamera(e.target.value)
              setPage(1)
            }}
            className="min-w-40 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="all">{t("aiMonitoring.cam.recAllCameras")}</option>
            {data.cameras.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("aiMonitoring.cam.recFromDate")}</span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("aiMonitoring.cam.recToDate")}</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </label>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1">
            <X className="size-3.5" />
            {t("aiMonitoring.cam.recClear")}
          </Button>
        )}
        <span className="ms-auto self-center text-xs text-muted-foreground">
          {t("aiMonitoring.cam.recCount").replace("{n}", formatNumber(data.total))}
        </span>
      </Card>

      {data.items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Film className="size-6" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {hasFilters ? t("aiMonitoring.cam.recNoMatch") : t("aiMonitoring.cam.recNoneYet")}
          </p>
          <p className="max-w-sm text-xs text-muted-foreground text-pretty">
            {hasFilters ? t("aiMonitoring.cam.recNoMatchHint") : t("aiMonitoring.cam.recNoneHint")}
          </p>
          {!hasFilters && (
            <Link
              href="/ai-monitoring/mobile-camera"
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {t("aiMonitoring.cam.recOpenPhone")}
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((rec) => (
            <RecordingCard
              key={rec.id}
              rec={rec}
              onOpen={() => setSelected(rec)}
              onDeleted={() => mutateRecordings()}
            />
          ))}
        </div>
      )}

      {/* ترقيم الصفحات */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="gap-1"
          >
            <ChevronRight className="size-4" />
            {t("aiMonitoring.cam.recPrev")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("aiMonitoring.cam.recPageOf").replace("{page}", formatNumber(page)).replace("{total}", formatNumber(totalPages))}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="gap-1"
          >
            {t("aiMonitoring.cam.recNext")}
            <ChevronLeft className="size-4" />
          </Button>
        </div>
      )}

      <ReviewDialog
        recording={selected}
        onClose={() => setSelected(null)}
        onScreenshotChange={() => mutateRecordings()}
      />
    </div>
  )
}

function RecordingCard({
  rec,
  onOpen,
  onDeleted,
}: {
  rec: VideoRecordingDto
  onOpen: () => void
  onDeleted: () => void
}) {
  const { t, locale, formatNumber } = useI18n()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(t("aiMonitoring.cam.recDeleteConfirm"))) return
    setDeleting(true)
    try {
      await deleteRecording(rec.id)
      toast({ title: t("aiMonitoring.cam.recDeleted") })
      onDeleted()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t("aiMonitoring.cam.recDeleteFailed"), variant: "destructive" })
      setDeleting(false)
    }
  }

  return (
    <Card
      className="group flex cursor-pointer flex-col overflow-hidden p-0 transition-colors hover:border-ring"
      onClick={onOpen}
    >
      <div className="relative flex aspect-video items-center justify-center bg-muted">
        {rec.posterUrl ? (
          <Image
            src={rec.posterUrl || "/placeholder.svg"}
            alt={t("aiMonitoring.cam.recPreviewAlt").replace("{name}", rec.cameraName)}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <video
            src={rec.videoUrl}
            className="size-full object-cover"
            preload="metadata"
            muted
            playsInline
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Video className="size-5" />
          </div>
        </div>
        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
          {fmtDuration(rec.durationSeconds)}
        </span>
        {rec.screenshotCount > 0 && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded bg-primary/90 px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
            <Camera className="size-3" />
            {rec.screenshotCount}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{rec.cameraName}</span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            aria-label={t("aiMonitoring.cam.recDeleteAria")}
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </button>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="size-3" />
            {rec.recordedBy}
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="size-3" />
            {fmtBytes(rec.fileSizeBytes, t, formatNumber)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {fmtDate(rec.recordedAt, locale)}
          </span>
        </div>
      </div>
    </Card>
  )
}

function ReviewDialog({
  recording,
  onClose,
  onScreenshotChange,
}: {
  recording: VideoRecordingDto | null
  onClose: () => void
  onScreenshotChange: () => void
}) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [capturing, setCapturing] = useState(false)

  const { data: screenshots = [], mutate } = useSWR(
    recording ? ["screenshots", recording.id] : null,
    () => getRecordingScreenshots(recording!.id),
    { revalidateOnFocus: false },
  )

  const open = !!recording

  async function captureFrame() {
    const video = videoRef.current
    if (!video || !recording) return
    if (video.readyState < 2) {
      toast({ title: t("aiMonitoring.cam.recWaitVideo"), variant: "destructive" })
      return
    }
    setCapturing(true)
    try {
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("canvas")
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8)
      await saveScreenshot({
        recordingId: recording.id,
        dataUrl,
        atSeconds: Math.round(video.currentTime),
      })
      await mutate()
      onScreenshotChange()
      toast({ title: t("aiMonitoring.cam.recSnapTaken") })
    } catch (err) {
      toast({
        title: err instanceof Error && err.message !== "canvas" ? err.message : t("aiMonitoring.cam.recSnapFailed"),
        variant: "destructive",
      })
    } finally {
      setCapturing(false)
    }
  }

  async function handleDeleteShot(id: number) {
    try {
      await deleteScreenshot(id)
      await mutate()
      onScreenshotChange()
    } catch {
      toast({ title: t("aiMonitoring.cam.recSnapDeleteFailed"), variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        {recording && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="size-5 text-primary" />
                {recording.cameraName}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="overflow-hidden rounded-xl border border-border bg-black">
                <video
                  ref={videoRef}
                  src={recording.videoUrl}
                  controls
                  playsInline
                  crossOrigin="anonymous"
                  className="max-h-[46vh] w-full bg-black"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground text-pretty">
                  {t("aiMonitoring.cam.recCapturePrompt")}
                </p>
                <Button onClick={captureFrame} disabled={capturing} className="gap-2">
                  {capturing ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                  {t("aiMonitoring.cam.recCaptureFromMoment")}
                </Button>
              </div>

              {/* نسخة صوتية مرتبطة بهذا التسجيل (اسم الكاميرا/الموقع ومعرّف التسجيل كبيانات وصفية) */}
              <AudioRecorder cameraName={recording.cameraName} recordingId={recording.id} />

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Camera className="size-4" />
                  {t("aiMonitoring.cam.recExtractedShots")}
                  <span className="text-xs font-normal text-muted-foreground">({screenshots.length})</span>
                </h3>
                {screenshots.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                    {t("aiMonitoring.cam.recNoShotsYet")}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {screenshots.map((shot) => (
                      <ScreenshotCard
                        key={shot.id}
                        shot={shot}
                        detectedBy={recording.cameraName}
                        onDelete={() => handleDeleteShot(shot.id)}
                        onLink={async () => {
                          try {
                            await linkScreenshotToViolation(shot.id)
                            await mutate()
                            onScreenshotChange()
                          } catch {
                            /* الملاحة تكمل حتى لو فشلت علامة الربط */
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ScreenshotCard({
  shot,
  detectedBy,
  onDelete,
  onLink,
}: {
  shot: VideoScreenshotDto
  detectedBy: string
  onDelete: () => void
  onLink: () => void
}) {
  const { t } = useI18n()
  const violationHref = useMemo(() => {
    const params = new URLSearchParams({ from: "recording", evidence: shot.imageUrl })
    if (detectedBy) params.set("detectedBy", detectedBy)
    return `/violations?${params.toString()}`
  }, [shot.imageUrl, detectedBy])

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative aspect-video bg-muted">
        <Image
          src={shot.imageUrl || "/placeholder.svg"}
          alt={t("aiMonitoring.cam.recSnapAtAlt").replace("{time}", fmtDuration(shot.atSeconds))}
          fill
          sizes="200px"
          className="object-cover"
          unoptimized
        />
        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium text-white">
          {fmtDuration(shot.atSeconds)}
        </span>
        <button
          onClick={onDelete}
          className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100"
          aria-label={t("aiMonitoring.cam.recSnapDeleteAria")}
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="p-2">
        {shot.linkedViolationId != null ? (
          <span className="flex items-center justify-center gap-1 rounded-md bg-primary/10 py-1.5 text-xs font-medium text-primary">
            <FileWarning className="size-3.5" />
            {t("aiMonitoring.cam.recViolationCreatedShort")}
          </span>
        ) : (
          <Link
            href={violationHref}
            onClick={onLink}
            className="flex items-center justify-center gap-1 rounded-md border border-border py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <FileWarning className="size-3.5" />
            {t("aiMonitoring.cam.recCreateFromShot")}
          </Link>
        )}
      </div>
    </div>
  )
}
