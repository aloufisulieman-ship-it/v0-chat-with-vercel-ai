"use client"

import { useState } from "react"
import { mutate } from "swr"
import Link from "next/link"
import { CircleCheck, FileWarning, Loader2, MapPin, ShieldAlert, UserRound, ExternalLink } from "lucide-react"
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
import { updateDetectionStatus } from "@/app/actions/ai-monitoring"
import { acceptDetectionAsViolation } from "@/app/actions/hse"
import { toast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n/client"

// الحقول التي تحتاجها النافذة من صف الاكتشاف (شكل مصغّر لتفادي الاعتماد الدائري).
type DetectionLike = {
  id: number
  detectionId: string
  detectionType: string
  severity: string
  confidenceScore: number
  cameraLocation: string
  inspectorName: string
  cameraId: string
  // توفّر لقطة إثبات (اللقطة نفسها تُجلب عند الطلب من مسار .../snapshot).
  hasSnapshot: boolean
  notes: string
}

const DETECTIONS_KEY = "/api/ai-monitoring/detections"

export function AcceptDetectionDialog({ detection: d }: { detection: DetectionLike }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<"internal" | "external" | null>(null)
  const [pending, setPending] = useState<null | "resolve" | "convert">(null)
  // لقطة الإثبات تُجلب عند فتح النافذة (لا تأتي مع بيانات الجدول الخفيفة).
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

  function reset() {
    setCategory(null)
    setPending(null)
  }

  // قبول فقط — يبقي السلوك الحالي: تغيير الحالة إلى "تمت المعالجة" دون إنشاء مخالفة.
  async function acceptOnly() {
    setPending("resolve")
    try {
      await updateDetectionStatus(d.id, "resolved")
      await mutate(DETECTIONS_KEY)
      toast({
        title: t("aiMonitoring.cam.acceptedTitle"),
        description: t("aiMonitoring.cam.acceptedDesc").replace("{id}", d.detectionId),
      })
      setOpen(false)
      reset()
    } catch (e) {
      toast({ title: t("aiMonitoring.cam.opFailed"), description: (e as Error).message, variant: "destructive" })
      setPending(null)
    }
  }

  // قبول وتحويل لمخالفة — يُنشئ سجل مخالفة رسمي ويوجّهه حسب التصنيف.
  async function acceptAndConvert() {
    if (!category) return
    setPending("convert")
    try {
      const { documentNo } = await acceptDetectionAsViolation(d.id, category)
      await mutate(DETECTIONS_KEY)
      toast({
        title: t("aiMonitoring.cam.violationCreated"),
        description: t("aiMonitoring.cam.violationCreatedDesc")
          .replace("{no}", documentNo)
          .replace(
            "{dest}",
            category === "external" ? t("aiMonitoring.cam.toFinance") : t("aiMonitoring.cam.toHr"),
          ),
      })
      setOpen(false)
      reset()
    } catch (e) {
      toast({ title: t("aiMonitoring.cam.violationCreateFailed"), description: (e as Error).message, variant: "destructive" })
      setPending(null)
    }
  }

  const busy = pending !== null

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
          className="rounded-md p-1.5 text-primary hover:bg-muted disabled:opacity-50"
          title={t("aiMonitoring.cam.accept")}
          aria-label={t("aiMonitoring.cam.acceptDetection")}
        >
          <CircleCheck className="size-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("aiMonitoring.cam.acceptDetectionTitle").replace("{id}", d.detectionId)}</DialogTitle>
          <DialogDescription>
            {t("aiMonitoring.cam.acceptDialogDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* نوع المخالفة — إلزامي عند التحويل */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              {t("aiMonitoring.cam.violationType")} <span className="text-destructive">*</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    value: "internal",
                    label: t("aiMonitoring.cam.internal"),
                    hint: t("aiMonitoring.cam.internalHint"),
                  },
                  {
                    value: "external",
                    label: t("aiMonitoring.cam.external"),
                    hint: t("aiMonitoring.cam.externalHint"),
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategory(opt.value)}
                  disabled={busy}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-lg border p-3 text-right transition-colors disabled:opacity-50",
                    category === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-input hover:bg-muted",
                  )}
                >
                  <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                  <span className="text-xs text-muted-foreground">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* مراجعة البيانات المعبّأة تلقائياً */}
          <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <ReviewRow icon={ShieldAlert} label={t("aiMonitoring.cam.reviewViolation")}>
              <span className="font-medium text-foreground">{typeLabel}</span>
              {d.notes ? <p className="mt-0.5 text-xs text-muted-foreground">{d.notes}</p> : null}
            </ReviewRow>
            <ReviewRow icon={MapPin} label={t("aiMonitoring.cam.location")}>
              <span className="text-foreground">{location}</span>
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
            <ReviewRow icon={UserRound} label={t("aiMonitoring.cam.reviewInspectorLocation")}>
              <span className="text-foreground">
                {inspector}
                {d.cameraLocation ? ` — ${d.cameraLocation}` : ""}
              </span>
            </ReviewRow>
          </div>

          {/* لقطة الإثبات — تُرفق تلقائياً بالمخالفة (تُجلب عند فتح النافذة) */}
          {d.hasSnapshot ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("aiMonitoring.cam.evidenceAuto")}</span>
              {snapshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={snapshot || "/placeholder.svg"}
                  alt={t("aiMonitoring.cam.evidenceAlt").replace("{type}", typeLabel)}
                  className="max-h-48 w-full rounded-lg border border-border bg-muted object-contain"
                  onError={() => setSnapFailed(true)}
                />
              ) : (
                <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-muted text-xs text-muted-foreground">
                  {snapFailed ? t("aiMonitoring.cam.snapFailed") : t("aiMonitoring.cam.snapLoading")}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={acceptOnly}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {pending === "resolve" ? <Loader2 className="size-4 animate-spin" /> : <CircleCheck className="size-4" />}
            {t("aiMonitoring.cam.acceptOnly")}
          </button>
          <button
            type="button"
            onClick={acceptAndConvert}
            disabled={busy || !category}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            title={!category ? t("aiMonitoring.cam.chooseTypeFirst") : undefined}
          >
            {pending === "convert" ? <Loader2 className="size-4 animate-spin" /> : <FileWarning className="size-4" />}
            {t("aiMonitoring.cam.acceptConvert")}
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

// رابط سريع لعرض المخالفة المرتبطة في سجل المخالفات.
export function LinkedViolationLink({ documentNo }: { documentNo: string }) {
  const { t } = useI18n()
  return (
    <Link
      href="/violations"
      className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 font-mono text-xs text-blue-600 hover:bg-blue-500/20 dark:text-blue-400"
      dir="ltr"
      title={t("aiMonitoring.cam.viewViolation").replace("{no}", documentNo)}
    >
      <ExternalLink className="size-3" />
      {documentNo}
    </Link>
  )
}
