"use client"

import type React from "react"
import { useMemo, useState, useTransition } from "react"
import { Plus, ChevronLeft, ChevronRight, Paperclip, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/client"
import { InlineSignatureField } from "@/components/inline-signature-field"
import {
  PERMIT_TYPES,
  getPermitType,
  checklistForType,
  GAS_FIELDS,
  permitTypeLabel,
} from "@/lib/permit-workflow"

type Attachment = { url: string; name: string; kind: string }

export function PermitIssueWizard({
  action,
}: {
  action: (formData: FormData) => Promise<{ documentNo: string }>
}) {
  const { t, locale } = useI18n()
  const loc = locale === "en" ? "en" : "ar"
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [isPending, startTransition] = useTransition()

  // الحالة المشتركة عبر الخطوات.
  const [type, setType] = useState<string>(PERMIT_TYPES[0].id)
  const [title, setTitle] = useState("")
  const [location, setLocation] = useState("")
  const [requestedBy, setRequestedBy] = useState("")
  const [contractorName, setContractorName] = useState("")
  const [supervisorName, setSupervisorName] = useState("")
  const [workersCount, setWorkersCount] = useState("")
  const [workDescription, setWorkDescription] = useState("")
  const [startAt, setStartAt] = useState("")
  const [endAt, setEndAt] = useState("")
  const [riskLevel, setRiskLevel] = useState("high")
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [gas, setGas] = useState<Record<string, string>>({})
  const [loto, setLoto] = useState<Record<string, string>>({ points: "", locks: "", tags: "" })
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [requesterSignature, setRequesterSignature] = useState("")

  const typeCfg = useMemo(() => getPermitType(type), [type])
  const items = useMemo(() => checklistForType(type), [type])

  function reset() {
    setStep(1)
    setType(PERMIT_TYPES[0].id)
    setTitle("")
    setLocation("")
    setRequestedBy("")
    setContractorName("")
    setSupervisorName("")
    setWorkersCount("")
    setWorkDescription("")
    setStartAt("")
    setEndAt("")
    setRiskLevel("high")
    setChecklist({})
    setGas({})
    setLoto({ points: "", locks: "", tags: "" })
    setAttachments([])
    setRequesterSignature("")
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    for (const file of files) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.readAsDataURL(file)
      })
      setAttachments((prev) => [...prev, { url: dataUrl, name: file.name, kind: file.type }])
    }
    e.target.value = ""
  }

  // تحقق كل خطوة قبل الانتقال.
  const step1Valid = title.trim() !== "" && location.trim() !== "" && startAt !== "" && endAt !== ""
  const requiredChecklistOk = items.every((i) => checklist[i.id])
  const gasOk = !typeCfg.requiresGasTest || GAS_FIELDS.every((g) => (gas[g.id] ?? "").trim() !== "")
  const step2Valid = requiredChecklistOk && gasOk
  const step3Valid = requesterSignature.startsWith("data:image")

  function submit() {
    if (!step3Valid) {
      toast({ title: t("permitWizard.signRequired"), variant: "destructive" })
      return
    }
    const fd = new FormData()
    fd.set("type", type)
    fd.set("title", title)
    fd.set("location", location)
    fd.set("requestedBy", requestedBy)
    fd.set("contractorName", contractorName)
    fd.set("supervisorName", supervisorName)
    fd.set("workersCount", workersCount)
    fd.set("workDescription", workDescription)
    fd.set("startAt", startAt)
    fd.set("endAt", endAt)
    fd.set("riskLevel", riskLevel)
    fd.set("checklistAnswers", JSON.stringify(checklist))
    fd.set("gasTestReadings", JSON.stringify(gas))
    fd.set("isolationLOTO", JSON.stringify(loto))
    fd.set("attachmentsJson", JSON.stringify(attachments))
    fd.set("requesterSignature", requesterSignature)
    startTransition(async () => {
      try {
        const res = await action(fd)
        toast({ title: t("permitWizard.created"), description: res.documentNo })
        setOpen(false)
        reset()
      } catch (err) {
        toast({
          title: t("permitWizard.createFailed"),
          description: err instanceof Error ? err.message : "",
          variant: "destructive",
        })
      }
    })
  }

  const steps = [t("permitWizard.step1"), t("permitWizard.step2"), t("permitWizard.step3")]

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2 self-start sm:self-auto">
          <Plus className="size-4" />
          {t("permitWizard.issue")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("permitWizard.title")}</DialogTitle>
          <DialogDescription>{t("permitWizard.subtitle")}</DialogDescription>
        </DialogHeader>

        {/* مؤشر الخطوات */}
        <ol className="flex items-center gap-2">
          {steps.map((label, i) => {
            const num = i + 1
            const done = step > num
            const current = step === num
            return (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    current
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-success text-success-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {num}
                </span>
                <span className={cn("text-xs", current ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</span>
                {num < steps.length && <span className="hidden h-px flex-1 bg-border sm:block" />}
              </li>
            )
          })}
        </ol>

        {/* الخطوة 1: البيانات الأساسية */}
        {step === 1 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>{t("permitWizard.type")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERMIT_TYPES.map((tp) => (
                    <SelectItem key={tp.id} value={tp.id}>
                      {permitTypeLabel(tp.id, loc)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="pt-title">
                {t("permitWizard.workTitle")}
                <span className="text-destructive"> *</span>
              </Label>
              <Input id="pt-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pt-loc">
                {t("permitWizard.location")}
                <span className="text-destructive"> *</span>
              </Label>
              <Input id="pt-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pt-req">{t("permitWizard.requestedBy")}</Label>
              <Input id="pt-req" value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pt-contractor">{t("permitWizard.contractor")}</Label>
              <Input id="pt-contractor" value={contractorName} onChange={(e) => setContractorName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pt-sup">{t("permitWizard.supervisor")}</Label>
              <Input id="pt-sup" value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pt-workers">{t("permitWizard.workers")}</Label>
              <Input id="pt-workers" type="number" min={1} value={workersCount} onChange={(e) => setWorkersCount(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("permitWizard.riskLevel")}</Label>
              <Select value={riskLevel} onValueChange={setRiskLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("permitWizard.riskLow")}</SelectItem>
                  <SelectItem value="medium">{t("permitWizard.riskMedium")}</SelectItem>
                  <SelectItem value="high">{t("permitWizard.riskHigh")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pt-start">
                {t("permitWizard.startAt")}
                <span className="text-destructive"> *</span>
              </Label>
              <Input id="pt-start" type="datetime-local" dir="ltr" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pt-end">
                {t("permitWizard.endAt")}
                <span className="text-destructive"> *</span>
              </Label>
              <Input id="pt-end" type="datetime-local" dir="ltr" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="pt-desc">{t("permitWizard.workDescription")}</Label>
              <Textarea id="pt-desc" rows={3} value={workDescription} onChange={(e) => setWorkDescription(e.target.value)} />
            </div>
          </div>
        )}

        {/* الخطوة 2: قائمة الفحص + الغاز/العزل + المرفقات */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3">
              <h4 className="text-sm font-semibold text-foreground">{t("permitWizard.checklist")}</h4>
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <Checkbox
                      id={`chk-${item.id}`}
                      checked={!!checklist[item.id]}
                      onCheckedChange={(v) => setChecklist((prev) => ({ ...prev, [item.id]: v === true }))}
                    />
                    <Label htmlFor={`chk-${item.id}`} className="cursor-pointer text-sm font-normal leading-relaxed">
                      {loc === "ar" ? item.ar : item.en}
                    </Label>
                  </li>
                ))}
              </ul>
            </section>

            {typeCfg.requiresGasTest && (
              <section className="flex flex-col gap-3">
                <h4 className="text-sm font-semibold text-foreground">{t("permitWizard.gasTest")}</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {GAS_FIELDS.map((g) => (
                    <div key={g.id} className="flex flex-col gap-1.5">
                      <Label htmlFor={`gas-${g.id}`} className="text-xs">
                        {loc === "ar" ? g.ar : g.en} <span className="text-muted-foreground">({g.unit} — {g.safe})</span>
                        <span className="text-destructive"> *</span>
                      </Label>
                      <Input
                        id={`gas-${g.id}`}
                        dir="ltr"
                        value={gas[g.id] ?? ""}
                        onChange={(e) => setGas((prev) => ({ ...prev, [g.id]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {typeCfg.requiresLOTO && (
              <section className="flex flex-col gap-3">
                <h4 className="text-sm font-semibold text-foreground">{t("permitWizard.loto")}</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="loto-points" className="text-xs">{t("permitWizard.lotoPoints")}</Label>
                    <Input id="loto-points" value={loto.points} onChange={(e) => setLoto((p) => ({ ...p, points: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="loto-locks" className="text-xs">{t("permitWizard.lotoLocks")}</Label>
                    <Input id="loto-locks" type="number" min={0} value={loto.locks} onChange={(e) => setLoto((p) => ({ ...p, locks: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="loto-tags" className="text-xs">{t("permitWizard.lotoTags")}</Label>
                    <Input id="loto-tags" type="number" min={0} value={loto.tags} onChange={(e) => setLoto((p) => ({ ...p, tags: e.target.value }))} />
                  </div>
                </div>
              </section>
            )}

            <section className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-foreground">{t("permitWizard.attachments")}</h4>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground hover:bg-muted/40">
                <Paperclip className="size-4" />
                {t("permitWizard.addAttachment")}
                <input type="file" multiple accept="image/*,application/pdf" className="sr-only" onChange={onFiles} />
              </label>
              {attachments.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {attachments.map((a, i) => (
                    <li key={i} className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-1.5 text-sm">
                      <span className="truncate text-foreground">{a.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={t("permitWizard.remove")}
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {/* الخطوة 3: توقيع الطالب والمراجعة */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
              <div className="grid grid-cols-2 gap-y-1.5">
                <span className="text-muted-foreground">{t("permitWizard.type")}</span>
                <span className="font-medium text-foreground">{permitTypeLabel(type, loc)}</span>
                <span className="text-muted-foreground">{t("permitWizard.workTitle")}</span>
                <span className="font-medium text-foreground">{title || "—"}</span>
                <span className="text-muted-foreground">{t("permitWizard.location")}</span>
                <span className="font-medium text-foreground">{location || "—"}</span>
                <span className="text-muted-foreground">{t("permitWizard.window")}</span>
                <span className="font-medium text-foreground" dir="ltr">
                  {startAt.replace("T", " ")} ← {endAt.replace("T", " ")}
                </span>
              </div>
            </div>
            <InlineSignatureField label={t("permitWizard.requesterSignature")} required onChange={setRequesterSignature} />
          </div>
        )}

        {/* أزرار التنقل */}
        <div className="mt-2 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            className="gap-1.5 bg-transparent"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            <ChevronRight className="size-4" />
            {t("permitWizard.back")}
          </Button>
          {step < 3 ? (
            <Button
              type="button"
              className="gap-1.5"
              onClick={() => {
                if (step === 1 && !step1Valid) {
                  toast({ title: t("permitWizard.step1Invalid"), variant: "destructive" })
                  return
                }
                if (step === 2 && !step2Valid) {
                  toast({ title: t("permitWizard.step2Invalid"), variant: "destructive" })
                  return
                }
                setStep((s) => s + 1)
              }}
            >
              {t("permitWizard.next")}
              <ChevronLeft className="size-4" />
            </Button>
          ) : (
            <Button type="button" className="gap-1.5" onClick={submit} disabled={isPending || !step3Valid}>
              {isPending ? t("permitWizard.submitting") : t("permitWizard.submit")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
