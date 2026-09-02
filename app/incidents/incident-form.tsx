"use client"

import { useState, useRef, useTransition } from "react"
import { AlertTriangle, PenLine, X, ChevronRight, ChevronLeft, Plus, Trash2, Users, Camera, ImageIcon, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { createIncidentFull } from "@/app/actions/hse"
import {
  INCIDENT_TYPES,
  incidentSeverityOptions,
  incidentStatusOptions,
  partyAffiliationOptions,
  partyInjuryOptions,
  partyHospitalizedOptions,
  type IncidentParty,
} from "@/lib/incident-types"
import { useI18n } from "@/lib/i18n/client"
import {
  incidentSeverityLabel,
  incidentStatusOptLabel,
  partyAffiliationLabel,
  partyInjuryLabel,
  partyHospitalizedLabel,
  incidentTypeCatalogLabel,
} from "@/lib/i18n/labels"

function SignaturePad({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }
  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    setDrawing(true)
    const ctx = canvasRef.current!.getContext("2d")!
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }
  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!drawing) return
    const ctx = canvasRef.current!.getContext("2d")!
    ctx.strokeStyle = "#1a1a2e"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }
  function end() {
    setDrawing(false)
    onChange(canvasRef.current!.toDataURL())
  }
  function clear() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    onChange("")
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <button type="button" onClick={clear} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
          <X className="size-3" /> {t("incidentForm.clear")}
        </button>
      </div>
      <div className="relative rounded-lg border-2 border-dashed border-border bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={340}
          height={120}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={end}
        />
        {!value && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <PenLine className="size-3" /> {t("incidentForm.signHere")}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

const emptyParty: IncidentParty = {
  name: "", nationality: "", affiliation: "employee", injuryType: "none", hospitalized: "no",
}

export function IncidentFormDialog({ defaultReporter = "" }: { defaultReporter?: string }) {
  const { t, dir } = useI18n()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [isPending, startTransition] = useTransition()

  const initialForm = {
    title: "", classification: "", routedTo: "", location: "", severity: "low", status: "open",
    incidentDate: "", incidentTime: "",
    description: "", directCauses: "", rootCauses: "",
    propertyDamage: "", damageCost: "", immediateActions: "",
    witnesses: "", authoritiesNotified: "no", authorityName: "",
    recommendations: "", reportedBy: defaultReporter,
  }

  const [form, setForm] = useState(initialForm)
  const [parties, setParties] = useState<IncidentParty[]>([])
  const [sitePhotos, setSitePhotos] = useState<string[]>([])
  const [reporterSignature, setReporterSignature] = useState("")
  const [safetySignature, setSafetySignature] = useState("")
  const [hrSignature, setHrSignature] = useState("")
  const [gmSignature, setGmSignature] = useState("")

  function resetForm() {
    setStep(1)
    setForm(initialForm)
    setParties([])
    setSitePhotos([])
    setReporterSignature("")
    setSafetySignature("")
    setHrSignature("")
    setGmSignature("")
  }

  function updateParty(index: number, key: keyof IncidentParty, value: string) {
    setParties((prev) => prev.map((p, i) => (i === index ? { ...p, [key]: value } : p)))
  }

  function readFileToDataUrl(file: File, onDone: (dataUrl: string) => void) {
    const reader = new FileReader()
    reader.onload = () => onDone(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handlePartyPhoto(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) readFileToDataUrl(file, (url) => updateParty(index, "injuryPhoto", url))
    e.target.value = ""
  }

  function handleSitePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach((f) => readFileToDataUrl(f, (url) => setSitePhotos((prev) => [...prev, url])))
    e.target.value = ""
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const fd = new FormData()
        Object.entries(form).forEach(([k, v]) => fd.append(k, v))
        // افصل صور الإصابات عن بيانات الأطراف لتجنّب تضخّم عمود parties
        const cleanParties = parties.map(({ injuryPhoto, ...rest }) => rest)
        const injuryPhotos = parties.map((p) => p.injuryPhoto ?? "")
        fd.append("parties", JSON.stringify(cleanParties))
        fd.append("injuryPhotos", JSON.stringify(injuryPhotos))
        fd.append("sitePhotos", JSON.stringify(sitePhotos))
        fd.append("reporterSignature", reporterSignature)
        fd.append("safetySignature", safetySignature)
        fd.append("hrSignature", hrSignature)
        fd.append("gmSignature", gmSignature)
        await createIncidentFull(fd)
        toast({ title: t("incidentForm.savedTitle"), description: t("incidentForm.savedDesc") })
        setOpen(false)
        resetForm()
      } catch (err) {
        toast({ title: t("incidentForm.saveFailedTitle"), description: err instanceof Error ? err.message : t("incidentForm.saveFailedDesc"), variant: "destructive" })
      }
    })
  }

  const steps = [t("incidentForm.stepData"), t("incidentForm.stepParties"), t("incidentForm.stepSignatures")]

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger asChild>
        <Button className="gap-2"><AlertTriangle className="size-4" /> {t("incidentForm.trigger")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl" dir={dir}>
        <DialogHeader>
          <DialogTitle>{t("incidentForm.dialogTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors
                ${step === i + 1 ? "bg-primary text-primary-foreground" : step > i + 1 ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
                {step > i + 1 ? "✓" : i + 1}
              </div>
              <span className={`text-xs ${step === i + 1 ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</span>
              {i < steps.length - 1 && <div className="flex-1 h-px bg-border" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>{t("incidentForm.classification")} <span className="text-destructive">*</span></Label>
              {/* التصنيف يحدّد جهة التحويل تلقائياً وحصرياً: داخلية → HR، خارجية → المالية. */}
              <Select
                value={form.classification}
                onValueChange={v => setForm(f => ({ ...f, classification: v, routedTo: v === "external" ? "finance" : "hr" }))}
              >
                <SelectTrigger><SelectValue placeholder={t("incidentForm.classificationPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">{t("incidentForm.classInternal")}</SelectItem>
                  <SelectItem value="external">{t("incidentForm.classExternal")}</SelectItem>
                </SelectContent>
              </Select>
              {form.classification ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ArrowLeft className="size-3.5 rtl:rotate-0 ltr:rotate-180" aria-hidden />
                  <span>
                    {t("incidentForm.routeTo")}:{" "}
                    <span className="font-medium text-foreground">
                      {form.classification === "external" ? t("incidentForm.routeFinance") : t("incidentForm.routeHr")}
                    </span>
                  </span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{t("incidentForm.routeHint")}</p>
              )}
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>{t("incidentForm.incidentType")} <span className="text-destructive">*</span></Label>
              <Select value={form.title} onValueChange={v => setForm(f => ({ ...f, title: v }))}>
                <SelectTrigger><SelectValue placeholder={t("incidentForm.incidentTypePlaceholder")} /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {INCIDENT_TYPES.map(it => <SelectItem key={it} value={it}>{incidentTypeCatalogLabel(t, it)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("incidentForm.incidentDate")}</Label>
              <Input type="date" value={form.incidentDate} onChange={e => setForm(f => ({ ...f, incidentDate: e.target.value }))} dir="ltr" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("incidentForm.incidentTime")}</Label>
              <Input value={form.incidentTime} onChange={e => setForm(f => ({ ...f, incidentTime: e.target.value }))} placeholder={t("incidentForm.incidentTimePlaceholder")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("incidentForm.location")}</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder={t("incidentForm.locationPlaceholder")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("incidentForm.severity")}</Label>
              <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {incidentSeverityOptions.map(o => <SelectItem key={o.value} value={o.value}>{incidentSeverityLabel(t, o.value)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("incidentForm.status")}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {incidentStatusOptions.map(o => <SelectItem key={o.value} value={o.value}>{incidentStatusOptLabel(t, o.value)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("incidentForm.reporter")}</Label>
              <Input value={form.reportedBy} onChange={e => setForm(f => ({ ...f, reportedBy: e.target.value }))} placeholder={t("incidentForm.reporterPlaceholder")} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>{t("incidentForm.description")}</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder={t("incidentForm.descriptionPlaceholder")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("incidentForm.directCauses")}</Label>
              <Textarea value={form.directCauses} onChange={e => setForm(f => ({ ...f, directCauses: e.target.value }))} rows={2} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("incidentForm.rootCauses")}</Label>
              <Textarea value={form.rootCauses} onChange={e => setForm(f => ({ ...f, rootCauses: e.target.value }))} rows={2} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("incidentForm.propertyDamage")}</Label>
              <Textarea value={form.propertyDamage} onChange={e => setForm(f => ({ ...f, propertyDamage: e.target.value }))} rows={2} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("incidentForm.damageCost")}</Label>
              <Input type="number" min={0} inputMode="decimal" value={form.damageCost} onChange={e => setForm(f => ({ ...f, damageCost: e.target.value }))} placeholder={t("incidentForm.damageCostPlaceholder")} dir="ltr" />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>{t("incidentForm.immediateActions")}</Label>
              <Textarea value={form.immediateActions} onChange={e => setForm(f => ({ ...f, immediateActions: e.target.value }))} rows={2} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>{t("incidentForm.witnesses")}</Label>
              <Textarea value={form.witnesses} onChange={e => setForm(f => ({ ...f, witnesses: e.target.value }))} rows={2} placeholder={t("incidentForm.witnessesPlaceholder")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("incidentForm.authoritiesNotified")}</Label>
              <Select value={form.authoritiesNotified} onValueChange={v => setForm(f => ({ ...f, authoritiesNotified: v, authorityName: v === "no" ? "" : f.authorityName }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">{t("incidentForm.no")}</SelectItem>
                  <SelectItem value="yes">{t("incidentForm.yes")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.authoritiesNotified === "yes" && (
              <div className="flex flex-col gap-1">
                <Label>{t("incidentForm.authorityName")} <span className="text-destructive">*</span></Label>
                <Input value={form.authorityName} onChange={e => setForm(f => ({ ...f, authorityName: e.target.value }))} placeholder={t("incidentForm.authorityNamePlaceholder")} />
              </div>
            )}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>{t("incidentForm.recommendations")}</Label>
              <Textarea value={form.recommendations} onChange={e => setForm(f => ({ ...f, recommendations: e.target.value }))} rows={2} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Users className="size-4 text-muted-foreground" /> {t("incidentForm.partiesTitle")}
              </span>
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setParties(p => [...p, { ...emptyParty }])}>
                <Plus className="size-4" /> {t("incidentForm.addParty")}
              </Button>
            </div>

            {parties.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">{t("incidentForm.noParties")}</p>
            ) : (
              parties.map((p, i) => (
                <div key={i} className="rounded-lg border border-border p-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{t("incidentForm.partyN")} {i + 1}</span>
                    <button type="button" onClick={() => setParties(arr => arr.filter((_, j) => j !== i))} className="text-destructive hover:opacity-80">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <Label>{t("incidentForm.name")}</Label>
                      <Input value={p.name} onChange={e => updateParty(i, "name", e.target.value)} placeholder={t("incidentForm.fullName")} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>{t("incidentForm.nationality")}</Label>
                      <Input value={p.nationality} onChange={e => updateParty(i, "nationality", e.target.value)} placeholder={t("incidentForm.nationalityPlaceholder")} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>{t("incidentForm.affiliation")}</Label>
                      <Select value={p.affiliation} onValueChange={v => updateParty(i, "affiliation", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {partyAffiliationOptions.map(o => <SelectItem key={o.value} value={o.value}>{partyAffiliationLabel(t, o.value)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>{t("incidentForm.injuryType")}</Label>
                      <Select value={p.injuryType} onValueChange={v => updateParty(i, "injuryType", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {partyInjuryOptions.map(o => <SelectItem key={o.value} value={o.value}>{partyInjuryLabel(t, o.value)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>{t("incidentForm.hospitalized")}</Label>
                      <Select value={p.hospitalized} onValueChange={v => updateParty(i, "hospitalized", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {partyHospitalizedOptions.map(o => <SelectItem key={o.value} value={o.value}>{partyHospitalizedLabel(t, o.value)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <Label>{t("incidentForm.injuryPhoto")}</Label>
                      {p.injuryPhoto ? (
                        <div className="relative w-fit">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.injuryPhoto || "/placeholder.svg"} alt={t("incidentForm.injuryPhotoAlt")} className="h-28 w-28 rounded-lg border border-border object-cover" />
                          <button
                            type="button"
                            onClick={() => updateParty(i, "injuryPhoto", "")}
                            className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex h-20 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground transition-colors hover:bg-muted/50">
                          <Camera className="size-5" /> {t("incidentForm.uploadInjuryPhoto")}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePartyPhoto(i, e)} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ImageIcon className="size-4 text-muted-foreground" /> {t("incidentForm.sitePhotos")}
              </span>
              <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground transition-colors hover:bg-muted/50">
                <Camera className="size-6" /> {t("incidentForm.uploadSitePhotos")}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleSitePhotos} />
              </label>
              {sitePhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {sitePhotos.map((img, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img || "/placeholder.svg"} alt={`${t("incidentForm.sitePhotoAlt")} ${i + 1}`} className="h-24 w-full rounded-lg border border-border object-cover" />
                      <button
                        type="button"
                        onClick={() => setSitePhotos((imgs) => imgs.filter((_, j) => j !== i))}
                        className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <SignaturePad label={t("incidentForm.sigReporter")} value={reporterSignature} onChange={setReporterSignature} />
            <SignaturePad label={t("incidentForm.sigSafety")} value={safetySignature} onChange={setSafetySignature} />
            <SignaturePad label={t("incidentForm.sigHr")} value={hrSignature} onChange={setHrSignature} />
            <SignaturePad label={t("incidentForm.sigGm")} value={gmSignature} onChange={setGmSignature} />
          </div>
        )}

        <div className="flex justify-between mt-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => step > 1 ? setStep(s => s - 1) : setOpen(false)} className="gap-1">
            <ChevronRight className="size-4 rtl:rotate-0 ltr:rotate-180" />
            {step === 1 ? t("incidentForm.cancel") : t("incidentForm.previous")}
          </Button>
          {step < 3 ? (
            <Button type="button" onClick={() => setStep(s => s + 1)} disabled={step === 1 && (!form.title || !form.classification)} className="gap-1">
              {t("incidentForm.next")} <ChevronLeft className="size-4 rtl:rotate-0 ltr:rotate-180" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSave} disabled={isPending} className="gap-1">
              {isPending ? t("incidentForm.saving") : t("incidentForm.saveIncident")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
