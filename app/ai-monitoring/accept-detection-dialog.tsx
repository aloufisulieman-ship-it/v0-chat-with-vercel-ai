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
import { detectionTypeLabels, severityLabels, severityStyles } from "@/lib/ai-monitoring"
import { updateDetectionStatus } from "@/app/actions/ai-monitoring"
import { acceptDetectionAsViolation } from "@/app/actions/hse"
import { toast } from "@/hooks/use-toast"

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
  snapshotUrl: string
  notes: string
}

const DETECTIONS_KEY = "/api/ai-monitoring/detections"

export function AcceptDetectionDialog({ detection: d }: { detection: DetectionLike }) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<"internal" | "external" | null>(null)
  const [pending, setPending] = useState<null | "resolve" | "convert">(null)

  const typeLabel = detectionTypeLabels[d.detectionType] ?? d.detectionType
  const inspector = d.inspectorName || d.cameraId || "-"
  const location = d.cameraLocation || "غير محدد"

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
      toast({ title: "تم قبول الاكتشاف", description: `تم وضع الاكتشاف ${d.detectionId} كـ «تمت المعالجة».` })
      setOpen(false)
      reset()
    } catch (e) {
      toast({ title: "تعذّر إتمام العملية", description: (e as Error).message, variant: "destructive" })
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
        title: "تم إنشاء المخالفة",
        description: `أُنشئت المخالفة ${documentNo} وأُحيلت إلى ${category === "external" ? "المالية" : "الموارد البشرية"}.`,
      })
      setOpen(false)
      reset()
    } catch (e) {
      toast({ title: "تعذّر إنشاء المخالفة", description: (e as Error).message, variant: "destructive" })
      setPending(null)
    }
  }

  const busy = pending !== null

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <button
          className="rounded-md p-1.5 text-primary hover:bg-muted disabled:opacity-50"
          title="قبول"
          aria-label="قبول الاكتشاف"
        >
          <CircleCheck className="size-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>قبول الاكتشاف {d.detectionId}</DialogTitle>
          <DialogDescription>
            راجع بيانات الاكتشاف المعبّأة تلقائياً، ثم اقبله فقط أو حوّله إلى مخالفة رسمية.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* نوع المخالفة — إلزامي عند التحويل */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              نوع المخالفة <span className="text-destructive">*</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "internal", label: "داخلية", hint: "إحالة للموارد البشرية" },
                  { value: "external", label: "خارجية", hint: "إحالة للمالية" },
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
            <ReviewRow icon={ShieldAlert} label="نوع/وصف المخالفة">
              <span className="font-medium text-foreground">{typeLabel}</span>
              {d.notes ? <p className="mt-0.5 text-xs text-muted-foreground">{d.notes}</p> : null}
            </ReviewRow>
            <ReviewRow icon={MapPin} label="الموقع">
              <span className="text-foreground">{location}</span>
            </ReviewRow>
            <ReviewRow icon={ShieldAlert} label="درجة الخطورة">
              <span
                className={cn(
                  "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                  severityStyles[d.severity] ?? "",
                )}
              >
                {severityLabels[d.severity] ?? d.severity}
              </span>
              <span className="ms-2 font-mono text-xs text-muted-foreground" dir="ltr">
                {d.confidenceScore}%
              </span>
            </ReviewRow>
            <ReviewRow icon={UserRound} label="المفتش / الموقع">
              <span className="text-foreground">
                {inspector}
                {d.cameraLocation ? ` — ${d.cameraLocation}` : ""}
              </span>
            </ReviewRow>
          </div>

          {/* لقطة الإثبات — تُرفق تلقائياً بالمخالفة */}
          {d.snapshotUrl ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">لقطة الإثبات (تُرفق تلقائياً)</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={d.snapshotUrl || "/placeholder.svg"}
                alt={`لقطة إثبات ${typeLabel}`}
                className="max-h-48 w-full rounded-lg border border-border object-contain"
              />
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
            قبول فقط
          </button>
          <button
            type="button"
            onClick={acceptAndConvert}
            disabled={busy || !category}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            title={!category ? "اختر نوع المخالفة أولاً" : undefined}
          >
            {pending === "convert" ? <Loader2 className="size-4 animate-spin" /> : <FileWarning className="size-4" />}
            قبول وتحويل لمخالفة
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
  return (
    <Link
      href="/violations"
      className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 font-mono text-xs text-blue-600 hover:bg-blue-500/20 dark:text-blue-400"
      dir="ltr"
      title={`عرض المخالفة ${documentNo}`}
    >
      <ExternalLink className="size-3" />
      {documentNo}
    </Link>
  )
}
