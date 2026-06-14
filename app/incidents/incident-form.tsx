"use client"

import { useState, useRef, useTransition } from "react"
import { AlertTriangle, PenLine, X, ChevronRight, ChevronLeft, Plus, Trash2, Users } from "lucide-react"
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

function SignaturePad({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
          <X className="size-3" /> مسح
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
              <PenLine className="size-3" /> وقّع هنا
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
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [isPending, startTransition] = useTransition()

  const initialForm = {
    title: "", location: "", severity: "low", status: "open",
    incidentDate: "", incidentTime: "",
    description: "", directCauses: "", rootCauses: "",
    propertyDamage: "", damageCost: "", immediateActions: "",
    witnesses: "", authoritiesNotified: "no", authorityName: "",
    recommendations: "", reportedBy: defaultReporter,
  }

  const [form, setForm] = useState(initialForm)
  const [parties, setParties] = useState<IncidentParty[]>([])
  const [reporterSignature, setReporterSignature] = useState("")
  const [managerSignature, setManagerSignature] = useState("")

  function resetForm() {
    setStep(1)
    setForm(initialForm)
    setParties([])
    setReporterSignature("")
    setManagerSignature("")
  }

  function updateParty(index: number, key: keyof IncidentParty, value: string) {
    setParties((prev) => prev.map((p, i) => (i === index ? { ...p, [key]: value } : p)))
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const fd = new FormData()
        Object.entries(form).forEach(([k, v]) => fd.append(k, v))
        fd.append("parties", JSON.stringify(parties))
        fd.append("reporterSignature", reporterSignature)
        fd.append("managerSignature", managerSignature)
        await createIncidentFull(fd)
        toast({ title: "تم الحفظ بنجاح", description: "تم تسجيل الحادثة في قاعدة البيانات." })
        setOpen(false)
        resetForm()
      } catch (err) {
        toast({ title: "تعذّر الحفظ", description: err instanceof Error ? err.message : "حدث خطأ.", variant: "destructive" })
      }
    })
  }

  const steps = ["بيانات الحادثة", "الأطراف المتضررة", "التواقيع"]

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger asChild>
        <Button className="gap-2"><AlertTriangle className="size-4" /> الإبلاغ عن حادثة</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>الإبلاغ عن حادثة</DialogTitle>
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
              <Label>نوع الحادثة <span className="text-destructive">*</span></Label>
              <Select value={form.title} onValueChange={v => setForm(f => ({ ...f, title: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر نوع الحادثة..." /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {INCIDENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>تاريخ الحادثة</Label>
              <Input type="date" value={form.incidentDate} onChange={e => setForm(f => ({ ...f, incidentDate: e.target.value }))} dir="ltr" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>وقت الحادثة</Label>
              <Input value={form.incidentTime} onChange={e => setForm(f => ({ ...f, incidentTime: e.target.value }))} placeholder="مثال: 10:30 صباحاً" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>موقع الحادثة</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="مثال: المستودع الرئيسي" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>مستوى الخطورة</Label>
              <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {incidentSeverityOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {incidentStatusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>المبلّغ عن الحادثة</Label>
              <Input value={form.reportedBy} onChange={e => setForm(f => ({ ...f, reportedBy: e.target.value }))} placeholder="اسم المبلّغ" />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>وصف تفصيلي للحادثة</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="اشرح ما حدث بالتفصيل..." />
            </div>
            <div className="flex flex-col gap-1">
              <Label>الأسباب المباشرة</Label>
              <Textarea value={form.directCauses} onChange={e => setForm(f => ({ ...f, directCauses: e.target.value }))} rows={2} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>الأسباب الجذرية</Label>
              <Textarea value={form.rootCauses} onChange={e => setForm(f => ({ ...f, rootCauses: e.target.value }))} rows={2} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>وصف الأضرار المادية</Label>
              <Textarea value={form.propertyDamage} onChange={e => setForm(f => ({ ...f, propertyDamage: e.target.value }))} rows={2} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>تقدير تكلفة الأضرار (ريال)</Label>
              <Input type="number" min={0} inputMode="decimal" value={form.damageCost} onChange={e => setForm(f => ({ ...f, damageCost: e.target.value }))} placeholder="مثال: 5000" dir="ltr" />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>الإجراءات الفورية المتخذة</Label>
              <Textarea value={form.immediateActions} onChange={e => setForm(f => ({ ...f, immediateActions: e.target.value }))} rows={2} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>الشهود</Label>
              <Textarea value={form.witnesses} onChange={e => setForm(f => ({ ...f, witnesses: e.target.value }))} rows={2} placeholder="أسماء الشهود وبياناتهم" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>هل أُبلغت الجهات المختصة؟</Label>
              <Select value={form.authoritiesNotified} onValueChange={v => setForm(f => ({ ...f, authoritiesNotified: v, authorityName: v === "no" ? "" : f.authorityName }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">لا</SelectItem>
                  <SelectItem value="yes">نعم</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.authoritiesNotified === "yes" && (
              <div className="flex flex-col gap-1">
                <Label>اسم الجهة <span className="text-destructive">*</span></Label>
                <Input value={form.authorityName} onChange={e => setForm(f => ({ ...f, authorityName: e.target.value }))} placeholder="مثال: الدفاع المدني" />
              </div>
            )}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>توصيات منع التكرار</Label>
              <Textarea value={form.recommendations} onChange={e => setForm(f => ({ ...f, recommendations: e.target.value }))} rows={2} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Users className="size-4 text-muted-foreground" /> الأطراف المتضررة
              </span>
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setParties(p => [...p, { ...emptyParty }])}>
                <Plus className="size-4" /> إضافة طرف
              </Button>
            </div>

            {parties.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">لا توجد أطراف مضافة. اضغط &quot;إضافة طرف&quot; لإضافة المتضررين.</p>
            ) : (
              parties.map((p, i) => (
                <div key={i} className="rounded-lg border border-border p-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">الطرف {i + 1}</span>
                    <button type="button" onClick={() => setParties(arr => arr.filter((_, j) => j !== i))} className="text-destructive hover:opacity-80">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <Label>الاسم</Label>
                      <Input value={p.name} onChange={e => updateParty(i, "name", e.target.value)} placeholder="الاسم الكامل" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>الجنسية</Label>
                      <Input value={p.nationality} onChange={e => updateParty(i, "nationality", e.target.value)} placeholder="مثال: سعودي" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>الجهة</Label>
                      <Select value={p.affiliation} onValueChange={v => updateParty(i, "affiliation", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {partyAffiliationOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>نوع الإصابة</Label>
                      <Select value={p.injuryType} onValueChange={v => updateParty(i, "injuryType", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {partyInjuryOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>تم نقله للمستشفى</Label>
                      <Select value={p.hospitalized} onValueChange={v => updateParty(i, "hospitalized", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {partyHospitalizedOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6">
            <SignaturePad label="توقيع المبلّغ" value={reporterSignature} onChange={setReporterSignature} />
            <SignaturePad label="توقيع مدير السلامة" value={managerSignature} onChange={setManagerSignature} />
          </div>
        )}

        <div className="flex justify-between mt-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => step > 1 ? setStep(s => s - 1) : setOpen(false)} className="gap-1">
            <ChevronRight className="size-4" />
            {step === 1 ? "إلغاء" : "السابق"}
          </Button>
          {step < 3 ? (
            <Button type="button" onClick={() => setStep(s => s + 1)} disabled={step === 1 && !form.title} className="gap-1">
              التالي <ChevronLeft className="size-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSave} disabled={isPending} className="gap-1">
              {isPending ? "جارٍ الحفظ..." : "حفظ الحادثة"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
