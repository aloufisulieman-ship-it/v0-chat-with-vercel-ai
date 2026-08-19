"use client"

import { useState, useRef, useTransition } from "react"
import { GraduationCap, PenLine, X, Plus, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { createTrainingFull } from "@/app/actions/hse"
import { inspectionStatusOptions } from "@/lib/labels"
import { useI18n } from "@/lib/i18n/client"
import { statusLabel } from "@/lib/i18n/labels"

// لوحة توقيع رقمية تدعم الماوس واللمس (بصمة الإصبع على الشاشة) وتحفظ كصورة base64.
function SignaturePad({
  value,
  onChange,
  label,
  compact = false,
}: {
  value: string
  onChange: (v: string) => void
  label?: string
  compact?: boolean
}) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    }
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
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange("")
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{label}</Label>
          <button type="button" onClick={clear} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
            <X className="size-3" /> {t("trainingMod.clearSignature")}
          </button>
        </div>
      )}
      <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-border bg-white">
        <canvas
          ref={canvasRef}
          width={compact ? 220 : 340}
          height={compact ? 70 : 120}
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
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <PenLine className="size-3" /> {t("trainingMod.signHere")}
            </span>
          </div>
        )}
        {compact && value && (
          <button
            type="button"
            onClick={clear}
            className="absolute left-1 top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
            aria-label={t("trainingMod.clearSignatureAria")}
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </div>
  )
}

type Attendee = {
  name: string
  designation: string
  company: string
  cardCode: string
  understood: string
  signature: string
}

const emptyAttendee: Attendee = {
  name: "",
  designation: "",
  company: "MHS",
  cardCode: "",
  understood: "yes",
  signature: "",
}

export function TrainingFormDialog() {
  const { t, dir } = useI18n()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const initialForm = {
    title: "",
    trainingDate: "",
    conductedBy: "",
    language: "العربية",
    status: "scheduled",
  }

  const [form, setForm] = useState(initialForm)
  const [trainerSignature, setTrainerSignature] = useState("")
  const [attendees, setAttendees] = useState<Attendee[]>([{ ...emptyAttendee }])

  function resetForm() {
    setForm(initialForm)
    setTrainerSignature("")
    setAttendees([{ ...emptyAttendee }])
  }

  function updateAttendee(index: number, key: keyof Attendee, value: string) {
    setAttendees((prev) => prev.map((a, i) => (i === index ? { ...a, [key]: value } : a)))
  }

  function handleSave() {
    if (!form.title.trim()) {
      toast({ title: t("trainingMod.toastTitleRequired"), variant: "destructive" })
      return
    }
    startTransition(async () => {
      try {
        const fd = new FormData()
        Object.entries(form).forEach(([k, v]) => fd.append(k, v))
        fd.append("trainerSignature", trainerSignature)
        fd.append("attendeesList", JSON.stringify(attendees.filter((a) => a.name.trim() !== "")))
        await createTrainingFull(fd)
        toast({ title: t("trainingMod.toastSaved"), description: t("trainingMod.toastSavedDesc") })
        setOpen(false)
        resetForm()
      } catch (err) {
        toast({ title: t("trainingMod.toastSaveFailed"), description: err instanceof Error ? err.message : t("trainingMod.toastError"), variant: "destructive" })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger asChild>
        <Button className="gap-2"><GraduationCap className="size-4" /> {t("trainingMod.newCourse")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-4xl" dir={dir}>
        <DialogHeader>
          <DialogTitle>{t("trainingMod.formDialogTitle")}</DialogTitle>
        </DialogHeader>

        {/* بيانات الدورة */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label>{t("trainingMod.fTopic")} <span className="text-destructive">*</span></Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t("trainingMod.phTopic")} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t("trainingMod.fCourseDate")}</Label>
            <Input type="date" value={form.trainingDate} onChange={(e) => setForm((f) => ({ ...f, trainingDate: e.target.value }))} dir="ltr" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t("trainingMod.fConductedBy")}</Label>
            <Input value={form.conductedBy} onChange={(e) => setForm((f) => ({ ...f, conductedBy: e.target.value }))} placeholder={t("trainingMod.phTrainerName")} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t("trainingMod.fLanguage")}</Label>
            <Select value={form.language} onValueChange={(v) => setForm((f) => ({ ...f, language: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="العربية">{t("trainingMod.langArabic")}</SelectItem>
                <SelectItem value="الإنجليزية">{t("trainingMod.langEnglish")}</SelectItem>
                <SelectItem value="الأردية">{t("trainingMod.langUrdu")}</SelectItem>
                <SelectItem value="الهندية">{t("trainingMod.langHindi")}</SelectItem>
                <SelectItem value="أخرى">{t("trainingMod.langOther")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t("trainingMod.fStatus")}</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {inspectionStatusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{statusLabel(t, o.value)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <SignaturePad label={t("trainingMod.trainerSignature")} value={trainerSignature} onChange={setTrainerSignature} />
          </div>
        </div>

        {/* جدول الحضور */}
        <div className="mt-2 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="size-4 text-muted-foreground" /> {t("trainingMod.attendanceLog")}
            </span>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setAttendees((a) => [...a, { ...emptyAttendee }])}>
              <Plus className="size-4" /> {t("trainingMod.addTrainee")}
            </Button>
          </div>

          {attendees.map((a, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{t("trainingMod.traineeLabel")} {i + 1}</span>
                <button
                  type="button"
                  onClick={() => setAttendees((arr) => (arr.length > 1 ? arr.filter((_, j) => j !== i) : arr))}
                  className="text-destructive hover:opacity-80 disabled:opacity-30"
                  disabled={attendees.length === 1}
                  aria-label={t("trainingMod.deleteTrainee")}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label>{t("trainingMod.fName")}</Label>
                  <Input value={a.name} onChange={(e) => updateAttendee(i, "name", e.target.value)} placeholder={t("trainingMod.phFullName")} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>{t("trainingMod.fDesignation")}</Label>
                  <Input value={a.designation} onChange={(e) => updateAttendee(i, "designation", e.target.value)} placeholder={t("trainingMod.phDesignation")} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>{t("trainingMod.fCompany")}</Label>
                  <Input value={a.company} onChange={(e) => updateAttendee(i, "company", e.target.value)} placeholder={t("trainingMod.phCompany")} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>{t("trainingMod.fCardCode")}</Label>
                  <Input value={a.cardCode} onChange={(e) => updateAttendee(i, "cardCode", e.target.value)} placeholder={t("trainingMod.phCardCode")} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>{t("trainingMod.fUnderstood")}</Label>
                  <Select value={a.understood} onValueChange={(v) => updateAttendee(i, "understood", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">{t("trainingMod.optYes")}</SelectItem>
                      <SelectItem value="no">{t("trainingMod.optNo")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-sm font-medium">{t("trainingMod.fSignature")}</Label>
                  <SignaturePad value={a.signature} onChange={(v) => updateAttendee(i, "signature", v)} compact />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => { setOpen(false); resetForm() }} disabled={isPending}>{t("trainingMod.cancel")}</Button>
          <Button onClick={handleSave} disabled={isPending}>{isPending ? t("trainingMod.saving") : t("trainingMod.saveTraining")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
