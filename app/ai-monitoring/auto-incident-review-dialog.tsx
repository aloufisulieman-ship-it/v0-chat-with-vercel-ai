"use client"

import { useState } from "react"
import { mutate } from "swr"
import Link from "next/link"
import { AlertOctagon, Loader2, MapPin, ShieldAlert, UserRound, ExternalLink, CircleX, TriangleAlert } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { severityStyles } from "@/lib/ai-monitoring"
import { detectionTypeLabel, severityLabel } from "@/lib/i18n/labels"
import { markDetectionFalsePositive, escalateDetection } from "@/app/actions/hse"
import { toast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n/client"

// الحقول التي تحتاجها نافذة مراجعة الحادث الآلي (شكل مصغّر من صف الكشف).
type DetectionLike = {
  id: number
  detectionId: string
  detectionType: string
  severity: string
  confidenceScore: number
  cameraLocation: string
  inspectorName: string
  cameraId: string
  hasSnapshot: boolean
  notes: string
  escalationTarget: string
  escalatedDocumentNo: string
}

const DETECTIONS_KEY = "/api/ai-monitoring/detections"

export function AutoIncidentReviewDialog({ detection: d }: { detection: DetectionLike }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<null | "incident" | "near_miss" | "false">(null)
  const [notes, setNotes] = useState("")
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [snapFailed, setSnapFailed] = useState(false)

  async function loadSnapshot() {
    if (!d.hasSnapshot || snapshot !== null) return
    try {
      const res = await fetch(`/api/ai-monitoring/detections/${d.id}/snapshot`)
      if (!res.ok) throw new Error("failed")
      const json = (await res.json()) as { snapshotUrl?: string }
      if (json.snapshotUrl) setSnapshot(json.snapshotUrl)
      else setSnapFailed(true)
    } catch {
      setSnapFailed(true)
    }
  }

  const typeLabel = detectionTypeLabel(t, d.detectionType)
  const inspector = d.inspectorName || d.cameraId || "-"
  const location = d.cameraLocation || t("aiMonitoring.cam.notSpecified")
  const busy = pending !== null

  function reset() {
    setPending(null)
    setNotes("")
  }

  async function escalate(kind: "incident" | "near_miss") {
    setPending(kind)
    try {
      const { documentNo } = await escalateDetection(d.id, { override: kind, reviewerNotes: notes })
      await mutate(DETECTIONS_KEY)
      toast({
        title: t("aiMonitoring.review.created"),
        description: t("aiMonitoring.review.createdDesc").replace("{no}", documentNo || "-"),
      })
      setOpen(false)
      reset()
    } catch (e) {
      toast({ title: t("aiMonitoring.review.failed"), description: (e as Error).message, variant: "destructive" })
      setPending(null)
    }
  }

  async function falsePositive() {
    if (!notes.trim()) {
      toast({ title: t("aiMonitoring.review.reasonRequired"), variant: "destructive" })
      return
    }
    setPending("false")
    try {
      await markDetectionFalsePositive(d.id, notes)
      await mutate(DETECTIONS_KEY)
      toast({ title: t("aiMonitoring.review.fpTitle"), description: t("aiMonitoring.review.fpDesc") })
      setOpen(false)
      reset()
    } catch (e) {
      toast({ title: t("aiMonitoring.review.failed"), description: (e as Error).message, variant: "destructive" })
      setPending(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) void loadSnapshot()
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center gap-1 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-xs font-medium text-orange-600 hover:bg-orange-500/20 dark:text-orange-400"
          title={t("aiMonitoring.review.reviewBtn")}
        >
          <AlertOctagon className="size-3.5" />
          {t("aiMonitoring.review.reviewBtn")}
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("aiMonitoring.review.title").replace("{id}", d.detectionId)}</DialogTitle>
          <DialogDescription>{t("aiMonitoring.review.desc")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* لقطة الإثبات مكبّرة */}
          {d.hasSnapshot ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("aiMonitoring.cam.evidenceAuto")}</span>
              {snapshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={snapshot || "/placeholder.svg"}
                  alt={t("aiMonitoring.cam.evidenceAlt").replace("{type}", typeLabel)}
                  className="max-h-56 w-full rounded-lg border border-border bg-muted object-contain"
                  onError={() => setSnapFailed(true)}
                />
              ) : (
                <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-muted text-xs text-muted-foreground">
                  {snapFailed ? t("aiMonitoring.cam.snapFailed") : t("aiMonitoring.cam.snapLoading")}
                </div>
              )}
            </div>
          ) : null}

          {/* تفاصيل الكشف */}
          <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <ReviewRow icon={AlertOctagon} label={t("aiMonitoring.review.type")}>
              <span className="font-medium text-foreground">{typeLabel}</span>
              {d.notes ? <p className="mt-0.5 text-xs text-muted-foreground">{d.notes}</p> : null}
            </ReviewRow>
            <ReviewRow icon={ShieldAlert} label={t("aiMonitoring.cam.reviewSeverity")}>
              <span
                className={cn(
                  "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                  severityStyles[d.severity] ?? "",
                )}
              >
                {severityLabel(t, d.severity)}
              </span>
              <span className="ms-2 font-mono text-xs text-muted-foreground" dir="ltr">
                {d.confidenceScore}%
              </span>
            </ReviewRow>
            <ReviewRow icon={MapPin} label={t("aiMonitoring.cam.location")}>
              <span className="text-foreground">{location}</span>
            </ReviewRow>
            <ReviewRow icon={UserRound} label={t("aiMonitoring.cam.reviewInspectorLocation")}>
              <span className="text-foreground">{inspector}</span>
            </ReviewRow>
          </div>

          {/* ملاحظات المدقق */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="review-notes" className="text-xs font-medium text-muted-foreground">
              {t("aiMonitoring.review.notes")}
            </label>
            <textarea
              id="review-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={busy}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
              placeholder={t("aiMonitoring.review.notesPlaceholder")}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-2">
          <button
            type="button"
            onClick={falsePositive}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {pending === "false" ? <Loader2 className="size-4 animate-spin" /> : <CircleX className="size-4" />}
            {t("aiMonitoring.review.falsePositive")}
          </button>
          <button
            type="button"
            onClick={() => escalate("near_miss")}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-400"
          >
            {pending === "near_miss" ? <Loader2 className="size-4 animate-spin" /> : <TriangleAlert className="size-4" />}
            {t("aiMonitoring.review.toNearMiss")}
          </button>
          <button
            type="button"
            onClick={() => escalate("incident")}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {pending === "incident" ? <Loader2 className="size-4 animate-spin" /> : <AlertOctagon className="size-4" />}
            {t("aiMonitoring.review.confirmIncident")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReviewRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div>{children}</div>
      </div>
    </div>
  )
}

// رابط سريع للسجل الناتج عن التصعيد (حادث INC-/إجراء تصحيحي CAPA-).
export function EscalationLink({ documentNo }: { documentNo: string }) {
  const href = documentNo.startsWith("CAPA-") ? "/actions" : "/incidents"
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 font-mono text-xs text-blue-600 hover:bg-blue-500/20 dark:text-blue-400"
      dir="ltr"
      title={documentNo}
    >
      <ExternalLink className="size-3" />
      {documentNo}
    </Link>
  )
}
