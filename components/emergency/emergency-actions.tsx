"use client"

import type React from "react"
import { useRef, useState, useTransition } from "react"
import { FileDown, Signature, AlertTriangle, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n/client"
import { downloadElementPdf } from "@/lib/pdf"
import {
  approveEmergencyPlan,
  createEmergencyDrill,
  convertActivationToIncident,
} from "@/app/actions/hse"

export type PlanLite = {
  id: number
  planNo: string
  scenario: string
  planType: string
  severity: string
  location: string
  triggerCriteria: string
  responseSteps: unknown
  roles: unknown
  assemblyPoint: string
  responsibleTeam: string
  status: string
  reviewDate: string | null
  preparerSignature: string
  safetySignature: string
  managementSignature: string
  approvedBy: string
  approvedAt: string | Date | null
}

function asLines(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x))
  if (typeof v === "string" && v) {
    try {
      const p = JSON.parse(v)
      if (Array.isArray(p)) return p.map((x) => String(x))
    } catch {
      return v.split("\n").filter(Boolean)
    }
  }
  return []
}

// اعتماد الخطة بثلاثة تواقيع (معِدّ / سلامة / إدارة) — لا تصبح معتمدة إلا باكتمالها.
export function PlanApproveDialog({ plan }: { plan: PlanLite }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await approveEmergencyPlan(plan.id, fd)
        toast({ title: t("emergencyMod.approveSavedTitle"), description: t("emergencyMod.approveSavedDesc") })
        setOpen(false)
      } catch (err) {
        toast({
          title: t("recordDialog.saveFailedTitle"),
          description: err instanceof Error ? err.message : t("recordDialog.saveFailedDesc"),
          variant: "destructive",
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title={t("emergencyMod.approve")}>
          <Signature className="size-4" />
          <span className="sr-only">{t("emergencyMod.approve")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("emergencyMod.approveTitle")}</DialogTitle>
          <DialogDescription>{t("emergencyMod.approveDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="preparerSignature">{t("emergencyMod.sigPreparer")}</Label>
            <Input id="preparerSignature" name="preparerSignature" defaultValue={plan.preparerSignature} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="safetySignature">{t("emergencyMod.sigSafety")}</Label>
            <Input id="safetySignature" name="safetySignature" defaultValue={plan.safetySignature} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="managementSignature">{t("emergencyMod.sigManagement")}</Label>
            <Input id="managementSignature" name="managementSignature" defaultValue={plan.managementSignature} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? t("recordDialog.saving") : t("emergencyMod.approveConfirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// طباعة خطة الطوارئ PDF بصفحة A4 واحدة بترويسة المؤسسة ورقم الخطة.
export function PlanPdfButton({
  plan,
  orgName,
  typeLabel,
  severityLabel,
  statusLabel,
}: {
  plan: PlanLite
  orgName: string
  typeLabel: string
  severityLabel: string
  statusLabel: string
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)

  async function handlePrint() {
    if (!ref.current) return
    setBusy(true)
    try {
      await downloadElementPdf(ref.current, `emergency-plan-${plan.planNo || plan.id}`, { singlePage: true })
    } catch {
      toast({ title: t("recordDialog.saveFailedTitle"), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const steps = asLines(plan.responseSteps)
  const roles = asLines(plan.roles)

  return (
    <>
      <Button variant="ghost" size="icon" onClick={handlePrint} disabled={busy} title={t("emergencyMod.printPlan")}>
        <FileDown className="size-4" />
        <span className="sr-only">{t("emergencyMod.printPlan")}</span>
      </Button>
      {/* منطقة الطباعة خارج الشاشة — بخلفية بيضاء ونص داكن مناسب لملف PDF. */}
      <div className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
        <div ref={ref} dir="rtl" style={{ width: 760, padding: 32, background: "#ffffff", color: "#0f172a", fontFamily: "sans-serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #0f172a", paddingBottom: 12, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{orgName}</div>
            <div style={{ textAlign: "left", fontSize: 12, color: "#475569" }}>
              <div>{t("emergencyMod.pdfDocTitle")}</div>
              <div style={{ fontFamily: "monospace", direction: "ltr" }}>{plan.planNo || `#${plan.id}`}</div>
            </div>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>{plan.scenario}</h1>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
            <tbody>
              <Row label={t("emergencyMod.fType")} value={typeLabel} />
              <Row label={t("emergencyMod.fSeverity")} value={severityLabel} />
              <Row label={t("emergencyMod.fLocation")} value={plan.location || "-"} />
              <Row label={t("emergencyMod.fTeam")} value={plan.responsibleTeam || "-"} />
              <Row label={t("emergencyMod.fAssembly")} value={plan.assemblyPoint || "-"} />
              <Row label={t("emergencyMod.fTrigger")} value={plan.triggerCriteria || "-"} />
              <Row label={t("emergencyMod.fStatus")} value={statusLabel} />
              <Row label={t("emergencyMod.fReview")} value={plan.reviewDate || "-"} />
            </tbody>
          </table>
          {steps.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("emergencyMod.fSteps")}</div>
              <ol style={{ margin: 0, paddingInlineStart: 20, fontSize: 13, lineHeight: 1.7 }}>
                {steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          )}
          {roles.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("emergencyMod.fRoles")}</div>
              <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 13, lineHeight: 1.7 }}>
                {roles.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 32, fontSize: 12 }}>
            <SigCell label={t("emergencyMod.sigPreparer")} value={plan.preparerSignature} />
            <SigCell label={t("emergencyMod.sigSafety")} value={plan.safetySignature} />
            <SigCell label={t("emergencyMod.sigManagement")} value={plan.managementSignature} />
          </div>
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ padding: "6px 8px", fontWeight: 600, background: "#f1f5f9", width: "30%", border: "1px solid #e2e8f0" }}>{label}</td>
      <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>{value}</td>
    </tr>
  )
}
function SigCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ borderTop: "1px solid #94a3b8", paddingTop: 6, minHeight: 28 }}>{value || ""}</div>
      <div style={{ color: "#475569" }}>{label}</div>
    </div>
  )
}

// تحويل بلاغ طوارئ إلى حادث في وحدة الحوادث.
export function ConvertIncidentButton({ id, converted }: { id: number; converted: boolean }) {
  const { t } = useI18n()
  const [isPending, startTransition] = useTransition()
  if (converted) {
    return <span className="text-xs text-muted-foreground">{t("emergencyMod.alreadyConverted")}</span>
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      title={t("emergencyMod.convertIncident")}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await convertActivationToIncident(id)
            toast({ title: t("emergencyMod.convertedTitle"), description: t("emergencyMod.convertedDesc") })
          } catch (err) {
            toast({
              title: t("recordDialog.saveFailedTitle"),
              description: err instanceof Error ? err.message : t("recordDialog.saveFailedDesc"),
              variant: "destructive",
            })
          }
        })
      }
    >
      <AlertTriangle className="size-4" />
      <span className="sr-only">{t("emergencyMod.convertIncident")}</span>
    </Button>
  )
}

// تسجيل تمرين، مع خيار إنشاء إجراء تصحيحي عند رصد قصور.
export function DrillCreateDialog({ plans }: { plans: { id: number; scenario: string; planNo: string }[] }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [needsAction, setNeedsAction] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set("needsAction", needsAction ? "true" : "false")
    startTransition(async () => {
      try {
        await createEmergencyDrill(fd)
        toast({ title: t("recordDialog.savedTitle"), description: t("recordDialog.savedDesc") })
        setOpen(false)
        setNeedsAction(false)
      } catch (err) {
        toast({
          title: t("recordDialog.saveFailedTitle"),
          description: err instanceof Error ? err.message : t("recordDialog.saveFailedDesc"),
          variant: "destructive",
        })
      }
    })
  }

  const drillTypes = [
    { value: "evacuation", label: t("emergencyMod.drillEvacuation") },
    { value: "fire", label: t("emergencyMod.drillFire") },
    { value: "medical", label: t("emergencyMod.drillMedical") },
    { value: "spill", label: t("emergencyMod.drillSpill") },
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 self-start sm:self-auto">
          <Plus className="size-4" />
          {t("emergencyMod.addDrill")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("emergencyMod.drillDialogTitle")}</DialogTitle>
          <DialogDescription>{t("emergencyMod.drillDialogDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="drill-plan">{t("emergencyMod.fPlan")}</Label>
            <Select name="planId" defaultValue="0">
              <SelectTrigger id="drill-plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t("emergencyMod.noPlan")}</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.scenario}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="drill-date">{t("emergencyMod.fDrillDate")}</Label>
            <Input id="drill-date" name="drillDate" type="date" dir="ltr" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="drill-type">{t("emergencyMod.fDrillType")}</Label>
            <Select name="drillType" defaultValue="evacuation">
              <SelectTrigger id="drill-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {drillTypes.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="drill-participants">{t("emergencyMod.fParticipants")}</Label>
            <Input id="drill-participants" name="participants" type="number" min={0} dir="ltr" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="drill-minutes">{t("emergencyMod.fEvacMinutes")}</Label>
            <Input id="drill-minutes" name="evacuationMinutes" type="number" min={0} dir="ltr" />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="drill-outcome">{t("emergencyMod.fOutcome")}</Label>
            <Input id="drill-outcome" name="outcome" />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="drill-notes">{t("emergencyMod.fNotes")}</Label>
            <Textarea id="drill-notes" name="notes" rows={2} />
          </div>
          <label className="flex items-center gap-2 sm:col-span-2 text-sm">
            <input type="checkbox" checked={needsAction} onChange={(e) => setNeedsAction(e.target.checked)} className="size-4" />
            {t("emergencyMod.needsAction")}
          </label>
          {needsAction && (
            <div className="flex flex-col gap-2 sm:col-span-2 rounded-md border border-border bg-muted/40 p-3">
              <Label htmlFor="drill-action">{t("emergencyMod.actionDescription")}</Label>
              <Textarea id="drill-action" name="actionDescription" rows={2} />
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="drill-action-due">{t("emergencyMod.actionDueDate")}</Label>
                  <Input id="drill-action-due" name="actionDueDate" type="date" dir="ltr" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="drill-action-priority">{t("emergencyMod.actionPriority")}</Label>
                  <Select name="actionPriority" defaultValue="medium">
                    <SelectTrigger id="drill-action-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">{t("emergencyMod.priorityHigh")}</SelectItem>
                      <SelectItem value="medium">{t("emergencyMod.priorityMedium")}</SelectItem>
                      <SelectItem value="low">{t("emergencyMod.priorityLow")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? t("recordDialog.saving") : t("recordDialog.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
