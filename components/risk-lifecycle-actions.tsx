"use client"

import { useState, useTransition } from "react"
import { ArrowRightLeft, ClipboardCheck, ShieldCheck, Plus, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SignaturePad } from "@/components/signature-pad"
import { toast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n/client"
import { cn } from "@/lib/utils"
import {
  referRiskControls,
  reassessRisk,
  closeRiskWithSignature,
  createFollowUpAction,
} from "@/app/actions/risk-lifecycle"
import {
  normalizeRiskStatus,
  riskScore,
  residualScore,
  hasReassessment,
  reductionPct,
  RISK_CLOSE_THRESHOLD,
  bandOf,
} from "@/lib/risk-lifecycle"

export type RiskLifecycleRow = {
  id: number
  hazard: string
  owner: string | null
  proposedControls: string | null
  likelihood: number | null
  consequence: number | null
  residualLikelihood: number | null
  residualConsequence: number | null
  status: string | null
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("read error"))
    reader.readAsDataURL(file)
  })
}

export function RiskLifecycleActions({
  risk,
  counts,
  isManager,
}: {
  risk: RiskLifecycleRow
  counts?: { total: number; completed: number }
  isManager: boolean
}) {
  const { t } = useI18n()
  const [dialog, setDialog] = useState<null | "refer" | "reassess" | "close" | "followup">(null)
  const [isPending, startTransition] = useTransition()
  const [savingSig, setSavingSig] = useState(false)

  const status = normalizeRiskStatus(risk.status)
  const before = riskScore(risk.likelihood, risk.consequence)
  const after = residualScore(risk)
  const reassessed = hasReassessment(risk)
  const canClose = reassessed && after < RISK_CLOSE_THRESHOLD

  function run(fn: () => Promise<void>, successKey: string) {
    startTransition(async () => {
      try {
        await fn()
        toast({ title: t(successKey) })
        setDialog(null)
      } catch (err) {
        toast({
          title: t("riskLifecycle.actionFailed"),
          description: err instanceof Error ? err.message : "",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <>
      {status === "open" && (
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-transparent" onClick={() => setDialog("refer")}>
          <ArrowRightLeft className="size-3.5" />
          {t("riskLifecycle.refer")}
        </Button>
      )}

      {status === "in_progress" && (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
          <ClipboardCheck className="size-3.5" />
          {t("riskLifecycle.controlsCounter")}: {counts?.completed ?? 0}/{counts?.total ?? 0}
        </span>
      )}

      {status === "verification" && (
        <div className="flex items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-transparent" onClick={() => setDialog("reassess")}>
            <ClipboardCheck className="size-3.5" />
            {t("riskLifecycle.reassess")}
          </Button>
          {reassessed && canClose && isManager && (
            <Button type="button" size="sm" className="h-8 gap-1.5" onClick={() => setDialog("close")}>
              <ShieldCheck className="size-3.5" />
              {t("riskLifecycle.close")}
            </Button>
          )}
          {reassessed && !canClose && (
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-transparent" onClick={() => setDialog("followup")}>
              <Plus className="size-3.5" />
              {t("riskLifecycle.addControl")}
            </Button>
          )}
        </div>
      )}

      {/* تحويل: إنشاء إجراء تصحيحي من الضوابط المقترحة */}
      <Dialog open={dialog === "refer"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("riskLifecycle.referTitle")}</DialogTitle>
            <DialogDescription>{t("riskLifecycle.referDesc")}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              run(
                () =>
                  referRiskControls({
                    riskId: risk.id,
                    proposedControls: String(fd.get("proposedControls") ?? ""),
                    assignedTo: String(fd.get("assignedTo") ?? ""),
                    dueDate: String(fd.get("dueDate") ?? "") || null,
                  }),
                "riskLifecycle.referred",
              )
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="proposedControls">{t("riskLifecycle.proposedControls")} <span className="text-destructive">*</span></Label>
              <Textarea id="proposedControls" name="proposedControls" rows={3} required defaultValue={risk.proposedControls ?? ""} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="assignedTo">{t("riskLifecycle.assignedTo")}</Label>
                <Input id="assignedTo" name="assignedTo" defaultValue={risk.owner ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="dueDate">{t("riskLifecycle.dueDate")}</Label>
                <Input id="dueDate" name="dueDate" type="date" dir="ltr" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>{isPending ? t("recordDialog.saving") : t("riskLifecycle.confirmRefer")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* إعادة التقييم */}
      <Dialog open={dialog === "reassess"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("riskLifecycle.reassessTitle")}</DialogTitle>
            <DialogDescription>{t("riskLifecycle.reassessDesc")}</DialogDescription>
          </DialogHeader>
          <ReassessForm
            risk={risk}
            before={before}
            isPending={isPending}
            onSubmit={(rl, rc) =>
              run(() => reassessRisk({ riskId: risk.id, residualLikelihood: rl, residualConsequence: rc }), "riskLifecycle.reassessed")
            }
          />
        </DialogContent>
      </Dialog>

      {/* الإغلاق بتوقيع مدير السلامة */}
      <Dialog open={dialog === "close"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("riskLifecycle.closeTitle")}</DialogTitle>
            <DialogDescription>{t("riskLifecycle.closeDesc")}</DialogDescription>
          </DialogHeader>
          <ScoreDelta before={before} after={after} t={t} />
          <SignaturePad
            saving={savingSig || isPending}
            onSave={async (file) => {
              setSavingSig(true)
              try {
                const dataUrl = await fileToDataUrl(file)
                await closeRiskWithSignature({ riskId: risk.id, signatureDataUrl: dataUrl })
                toast({ title: t("riskLifecycle.closed") })
                setDialog(null)
              } catch (err) {
                toast({
                  title: t("riskLifecycle.actionFailed"),
                  description: err instanceof Error ? err.message : "",
                  variant: "destructive",
                })
              } finally {
                setSavingSig(false)
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* إجراء تصحيحي إضافي */}
      <Dialog open={dialog === "followup"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("riskLifecycle.followupTitle")}</DialogTitle>
            <DialogDescription>{t("riskLifecycle.followupDesc")}</DialogDescription>
          </DialogHeader>
          <div className="mb-1 rounded-md border border-risk-high/30 bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
            <Lock className="mb-0.5 me-1 inline size-3.5" />
            {t("riskLifecycle.stillHigh")} ({after} ≥ {RISK_CLOSE_THRESHOLD})
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              run(
                () =>
                  createFollowUpAction({
                    riskId: risk.id,
                    title: String(fd.get("title") ?? ""),
                    assignedTo: String(fd.get("assignedTo") ?? ""),
                    dueDate: String(fd.get("dueDate") ?? "") || null,
                  }),
                "riskLifecycle.followupCreated",
              )
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="fuTitle">{t("riskLifecycle.newControlTitle")} <span className="text-destructive">*</span></Label>
              <Textarea id="fuTitle" name="title" rows={3} required />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="fuAssignedTo">{t("riskLifecycle.assignedTo")}</Label>
                <Input id="fuAssignedTo" name="assignedTo" defaultValue={risk.owner ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="fuDueDate">{t("riskLifecycle.dueDate")}</Label>
                <Input id="fuDueDate" name="dueDate" type="date" dir="ltr" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>{isPending ? t("recordDialog.saving") : t("riskLifecycle.confirmFollowup")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ReassessForm({
  risk,
  before,
  isPending,
  onSubmit,
}: {
  risk: RiskLifecycleRow
  before: number
  isPending: boolean
  onSubmit: (rl: number, rc: number) => void
}) {
  const { t } = useI18n()
  const [rl, setRl] = useState(String(risk.residualLikelihood ?? risk.likelihood ?? 1))
  const [rc, setRc] = useState(String(risk.residualConsequence ?? risk.consequence ?? 1))
  const after = Number(rl) * Number(rc)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(Number(rl), Number(rc))
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>{t("riskLifecycle.residualLikelihood")}</Label>
          <Select value={rl} onValueChange={setRl}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("riskLifecycle.residualConsequence")}</Label>
          <Select value={rc} onValueChange={setRc}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <ScoreDelta before={before} after={after} t={t} />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>{isPending ? t("recordDialog.saving") : t("riskLifecycle.saveReassessment")}</Button>
      </DialogFooter>
    </form>
  )
}

// عرض الدرجة قبل/بعد ونسبة الانخفاض بألوان النطاقات.
function ScoreDelta({ before, after, t }: { before: number; after: number; t: (k: string) => string }) {
  const pct = reductionPct(before, after)
  const bBand = bandOf(before)
  const aBand = bandOf(after)
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-muted-foreground">{t("riskLifecycle.before")}</span>
        <span className={cn("flex size-10 items-center justify-center rounded-md text-lg font-bold tabular-nums", bBand.cell)}>{before}</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-sm font-semibold text-primary">-{pct}%</span>
        <span className="text-xs text-muted-foreground">{t("riskLifecycle.reduction")}</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-muted-foreground">{t("riskLifecycle.after")}</span>
        <span className={cn("flex size-10 items-center justify-center rounded-md text-lg font-bold tabular-nums", aBand.cell)}>{after}</span>
      </div>
    </div>
  )
}
