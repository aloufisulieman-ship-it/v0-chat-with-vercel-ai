"use client"

import { useState, useRef, useTransition, useEffect } from "react"
import { FileWarning, PenLine, X, ChevronRight, ChevronLeft, Camera, FileText, Upload, BadgeCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { createViolationFull } from "@/app/actions/hse"
import type { EmployeeRecord } from "@/app/training/employee-registry"
import { violationStatusOptions } from "@/lib/labels"
import { compressImage } from "@/lib/image-compress"
import {
  categoryOptions,
  internalActionOptions,
  FINE_ACTION,
  OTHER_ACTION,
  type ViolationCategory,
} from "@/lib/violation-category"
import { useI18n } from "@/lib/i18n/client"
import { statusLabel, categoryOptionLabel, internalActionLabel, violationTypeLabel } from "@/lib/i18n/labels"

const VIOLATION_TYPES = [
  "عدم ارتداء خوذة السلامة",
  "عدم ارتداء حذاء السلامة",
  "عدم ارتداء سترة عاكسة",
  "عدم ارتداء قفازات واقية",
  "عدم ارتداء نظارات واقية",
  "عدم ارتداء كمامة أو جهاز تنفس",
  "عدم ارتداء حزام الأمان للعمل على الارتفاع",
  "العمل بدون تصريح عمل",
  "تجاوز منطقة العمل المحددة",
  "مخالفة إجراءات العزل والقفل (LOTO)",
  "استخدام معدات تالفة أو غير مطابقة",
  "تشغيل معدات بدون تدريب أو ترخيص",
  "الإهمال في تأمين منطقة العمل",
  "عدم الإبلاغ عن حادثة أو إصابة",
  "إهمال نظافة موقع العمل",
  "عدم التخلص الصحيح من النفايات",
  "سد مخارج الطوارئ أو ممرات الإخلاء",
  "تخزين مواد بطريقة غير آمنة",
  "التشتت أو استخدام الهاتف أثناء العمل",
  "الإهمال المتعمد في اتباع تعليمات السلامة",
  "التدخين في مناطق محظورة",
  "السير في مسارات المركبات",
  "التصرف بصورة عدوانية أو غير لائقة",
  "قيادة مركبة بسرعة زائدة داخل الموقع",
  "عدم ارتداء حزام الأمان في المركبة",
  "استخدام الجوال أثناء القيادة",
  "إهمال صيانة المركبة أو المعدة",
  "التعامل مع مواد خطرة بدون مؤهل",
  "عدم الالتزام بتعليمات بطاقة MSDS",
  "تسريب مواد كيميائية دون إبلاغ",
  "مخالفة أخرى",
]

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
    if (!drawing) return
    setDrawing(false)

    const source = canvasRef.current!
    // Canvas التوقيع محدود أصلاً إلى 340x120. نعيد رسمه على خلفية بيضاء
    // قبل تصديره كـ JPEG مضغوط لتجنب حمولة PNG الكبيرة أو الخلفية الشفافة.
    const output = document.createElement("canvas")
    output.width = Math.min(source.width, 500)
    output.height = Math.min(source.height, 200)
    const ctx = output.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, output.width, output.height)
    ctx.drawImage(source, 0, 0, output.width, output.height)
    onChange(output.toDataURL("image/jpeg", 0.7))
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
          <X className="size-3" /> {t("violationForm.clear")}
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
              <PenLine className="size-3" /> {t("violationForm.signHere")}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function ViolationFormDialog({
  employees = [],
  initialEvidence,
  initialDetectedBy = "",
  autoOpen = false,
  violationTypes,
}: {
  employees?: EmployeeRecord[]
  // صورة إثبات مبدئية (data URL) تُحمّل مسبقاً — مثلاً لقطة من تسجيل فيديو.
  initialEvidence?: string
  // اسم المفتش الذي رصد المخالفة (يُعبّأ مسبقاً عند القدوم من رصد الذكاء الاصطناعي).
  initialDetectedBy?: string
  // فتح النموذج تلقائياً عند التحميل (عند القدوم من صفحة التسجيلات).
  autoOpen?: boolean
  // أنواع المخالفات المخصّصة للمؤسسة (من إعدادات التشغيل). عند غيابها نرجع للقائمة الافتراضية.
  violationTypes?: string[]
}) {
  // القائمة الفعّالة: إعدادات المؤسسة إن وُجدت وإلا الافتراضية المدمجة.
  const violationTypeList = violationTypes && violationTypes.length > 0 ? violationTypes : VIOLATION_TYPES
  const { t, dir } = useI18n()
  const [open, setOpen] = useState(autoOpen)
  const [step, setStep] = useState(1)
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    employeeRefId: "", employeeName: "", employeeNo: "", nationality: "", companyName: "",
    documentNo: "MHS-IMS-PR-HSE-647", violationDate: "", violationTime: "",
    place: "", violationType: "", category: "", internalAction: "", actionDetail: "",
    description: "", witnesses: "",
    evidences: "", proposedAction: "", status: "open", entryMode: "electronic",
    detectedBy: initialDetectedBy,
  })

  // إذا كانت صورة الإثبات المبدئية data URL نضعها مباشرة؛ وإن كانت رابط Blob (http)
  // نحوّلها لاحقاً إلى data URL عبر useEffect حتى تُضمّن ضمن حمولة الحفظ.
  const isDataUrl = (v?: string) => !!v && v.startsWith("data:")
  const [images, setImages] = useState<string[]>(isDataUrl(initialEvidence) ? [initialEvidence as string] : [])
  // النماذج الو��قية الممسوحة للمخالفة اليدوية: { name, dataUrl }
  const [manualDocs, setManualDocs] = useState<{ name: string; dataUrl: string }[]>([])
  const [editorSignature, setEditorSignature] = useState("")
  const [violatorSignature, setViolatorSignature] = useState("")
  const [managerSignature, setManagerSignature] = useState("")

  // ربط سريع برقم اليونيفورم: يُدخل المفتش الرقم المطرّز على ظهر زيّ الموظف، فيبحث
  // النظام في السجل ويربط المخالفة تلقائياً بملف الموظف صاحب هذا الرقم.
  const [uniformLookup, setUniformLookup] = useState("")
  const uniformMatch =
    uniformLookup.trim() !== ""
      ? employees.find((e) => (e.uniformNumber ?? "").trim() === uniformLookup.trim())
      : undefined

  function applyUniformLookup(value: string) {
    setUniformLookup(value)
    const match = employees.find((e) => (e.uniformNumber ?? "").trim() === value.trim())
    if (match) {
      setForm((current) => ({
        ...current,
        employeeRefId: String(match.id),
        employeeName: match.name,
        employeeNo: match.employeeId,
        nationality: match.nationality,
        companyName: match.company,
      }))
    }
  }

  // تحويل رابط لقطة (Blob http) إلى data URL مضغوط لتضمينه ضمن أدلة المخالفة.
  useEffect(() => {
    if (!initialEvidence || isDataUrl(initialEvidence)) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(initialEvidence, { cache: "no-store" })
        const blob = await res.blob()
        const file = new File([blob], "screenshot.jpg", { type: blob.type || "image/jpeg" })
        const dataUrl = await compressImage(file, 1200, 0.7)
        if (!cancelled) setImages((prev) => (prev.length ? prev : [dataUrl]))
      } catch {
        /* يتجاهل — يمكن للمراجع رفع الصورة يدوياً */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initialEvidence])

  function resetForm() {
    setStep(1)
    setForm({
      employeeRefId: "", employeeName: "", employeeNo: "", nationality: "", companyName: "",
      documentNo: "MHS-IMS-PR-HSE-647", violationDate: "", violationTime: "",
      place: "", violationType: "", category: "", internalAction: "", actionDetail: "",
      description: "", witnesses: "",
      evidences: "", proposedAction: "", status: "open", entryMode: "electronic",
      detectedBy: initialDetectedBy,
    })
    setImages(isDataUrl(initialEvidence) ? [initialEvidence as string] : [])
    setManualDocs([])
    setUniformLookup("")
    setEditorSignature("")
    setViolatorSignature("")
    setManagerSignature("")
  }

  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error(t("violationForm.fileReadFailed")))
      reader.readAsDataURL(file)
    })
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const files = Array.from(input.files ?? [])
    input.value = ""

    try {
      const docs = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          // اضغط النماذج المصورة فقط؛ PDF وWord يبقيان بصيغتهما الأصلية.
          dataUrl: file.type.startsWith("image/")
            ? await compressImage(file, 1200, 0.7)
            : await fileToDataUrl(file),
        })),
      )
      setManualDocs((prev) => [...prev, ...docs])
    } catch {
      toast({ title: t("violationForm.filePrepFailed"), variant: "destructive" })
    }
  }

  async function handleImageCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const files = Array.from(input.files ?? [])
    input.value = ""

    try {
      const compressed = await Promise.all(files.map((file) => compressImage(file, 1200, 0.7)))
      setImages((prev) => [...prev, ...compressed])
    } catch {
      toast({ title: t("violationForm.imageCompressFailed"), variant: "destructive" })
    }
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const fd = new FormData()
        Object.entries(form).forEach(([k, v]) => fd.append(k, v))
        // ادمج ا��إجراء مع التفاصيل الإضافية (المبلغ أو النص الحر) في قيمة واحدة
        let internalActionValue = form.internalAction
        if (form.internalAction === FINE_ACTION && form.actionDetail.trim()) {
          internalActionValue = `${FINE_ACTION}: ${form.actionDetail.trim()} ريال سعودي`
        } else if (form.internalAction === OTHER_ACTION && form.actionDetail.trim()) {
          internalActionValue = form.actionDetail.trim()
        }
        fd.set("internalAction", internalActionValue)
        fd.append("editorSignature", editorSignature)
        fd.append("violatorSignature", violatorSignature)
        fd.append("managerSignature", managerSignature)
        fd.append("images", JSON.stringify(images))
        fd.append("manualDocs", JSON.stringify(manualDocs.map((d) => d.dataUrl)))
        await createViolationFull(fd)
        toast({ title: t("violationForm.savedTitle"), description: t("violationForm.savedDesc") })
        setOpen(false)
        resetForm()
      } catch (err) {
        toast({ title: t("violationForm.saveFailedTitle"), description: err instanceof Error ? err.message : t("violationForm.saveFailedDesc"), variant: "destructive" })
      }
    })
  }

  const steps = [t("violationForm.stepData"), t("violationForm.stepEvidence"), t("violationForm.stepSignatures")]

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger asChild>
        <Button className="gap-2"><FileWarning className="size-4" /> {t("violationForm.trigger")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl" dir={dir}>
        <DialogHeader>
          <DialogTitle>{t("violationForm.dialogTitle")}</DialogTitle>
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
            <div className="flex flex-col gap-2 sm:col-span-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label>{t("violationForm.source")}</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, entryMode: "electronic" }))}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${form.entryMode === "electronic" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted"}`}
                >
                  {t("violationForm.sourceElectronic")}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, entryMode: "manual" }))}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${form.entryMode === "manual" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted"}`}
                >
                  {t("violationForm.sourceManual")}
                </button>
              </div>
              {form.entryMode === "manual" && (
                <div className="flex flex-col gap-2 pt-1">
                  <label className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="size-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{t("violationForm.attachManual")}</span>
                    <input type="file" accept="image/*,application/pdf,.doc,.docx" multiple className="hidden" onChange={handleDocUpload} />
                  </label>
                  {manualDocs.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                      {manualDocs.map((d, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
                          <span className="flex items-center gap-1.5 truncate"><FileText className="size-3.5 shrink-0 text-muted-foreground" /> <span className="truncate">{d.name}</span></span>
                          <button type="button" onClick={() => setManualDocs(docs => docs.filter((_, j) => j !== i))} className="shrink-0 text-destructive hover:opacity-70" aria-label={t("violationForm.deleteFile")}>
                            <X className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label htmlFor="violation-employee">{t("violationForm.pickFromRegistry")}</Label>
              <select
                id="violation-employee"
                value={form.employeeRefId}
                onChange={(event) => {
                  const selected = employees.find((item) => String(item.id) === event.target.value)
                  setForm((current) => selected ? ({ ...current, employeeRefId: String(selected.id), employeeName: selected.name, employeeNo: selected.employeeId, nationality: selected.nationality, companyName: selected.company }) : ({ ...current, employeeRefId: "" }))
                }}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="">{t("violationForm.manualEntry")}</option>
                {employees.filter((item) => item.active).map((employee) => <option key={employee.id} value={employee.id}>{employee.name} — {employee.employeeId}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
              <Label htmlFor="violation-uniform-lookup" className="flex items-center gap-1.5">
                <BadgeCheck className="size-4 text-primary" /> {t("violationForm.uniformLookup")}
              </Label>
              <Input
                id="violation-uniform-lookup"
                value={uniformLookup}
                onChange={(e) => applyUniformLookup(e.target.value)}
                placeholder={t("violationForm.uniformPlaceholder")}
                dir="ltr"
                inputMode="numeric"
                className="max-w-40 font-mono"
              />
              {uniformLookup.trim() !== "" && (
                uniformMatch ? (
                  <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-background p-2">
                    {uniformMatch.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={uniformMatch.photoUrl || "/placeholder.svg"} alt={uniformMatch.name} className="size-10 shrink-0 rounded-full border border-border object-cover" />
                    ) : (
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground"><BadgeCheck className="size-4" /></span>
                    )}
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                        <BadgeCheck className="size-3.5 shrink-0" />
                        {t("violationForm.uniformMatched").replace("{name}", uniformMatch.name).replace("{id}", uniformMatch.employeeId)}
                      </p>
                      {uniformMatch.phone && <p className="font-mono text-xs text-muted-foreground" dir="ltr">{uniformMatch.phone}</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-destructive">{t("violationForm.uniformNoMatch")}</p>
                )
              )}
              <span className="text-xs text-muted-foreground">{t("violationForm.uniformHint")}</span>
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("violationForm.employeeName")} <span className="text-destructive">*</span></Label>
              <Input value={form.employeeName} onChange={e => setForm(f => ({ ...f, employeeName: e.target.value }))} placeholder={t("violationForm.fullName")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("violationForm.employeeNo")}</Label>
              <Input value={form.employeeNo} onChange={e => setForm(f => ({ ...f, employeeNo: e.target.value }))} placeholder={t("violationForm.employeeNoPlaceholder")} dir="ltr" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("violationForm.nationality")}</Label>
              <Input value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} placeholder={t("violationForm.nationalityPlaceholder")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("violationForm.companyName")}</Label>
              <Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("violationForm.date")}</Label>
              <Input type="date" value={form.violationDate} onChange={e => setForm(f => ({ ...f, violationDate: e.target.value }))} dir="ltr" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("violationForm.time")}</Label>
              <Input value={form.violationTime} onChange={e => setForm(f => ({ ...f, violationTime: e.target.value }))} placeholder={t("violationForm.timePlaceholder")} />
            </div>
                    <div className="flex flex-col gap-1">
                      <Label>{t("violationForm.place")} <span className="text-destructive">*</span></Label>
                      <Input value={form.place} onChange={e => setForm(f => ({ ...f, place: e.target.value }))} placeholder={t("violationForm.placePlaceholder")} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>{t("violationForm.detectedBy")}</Label>
                      <Input
                        value={form.detectedBy}
                        onChange={e => setForm(f => ({ ...f, detectedBy: e.target.value }))}
                        placeholder={t("violationForm.detectedByPlaceholder")}
                      />
                    </div>
            <div className="flex flex-col gap-1">
              <Label>{t("violationForm.status")}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {violationStatusOptions.map(o => <SelectItem key={o.value} value={o.value}>{statusLabel(t, o.value)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>{t("violationForm.category")} <span className="text-destructive">*</span></Label>
              <Select
                value={form.category}
                onValueChange={v => setForm(f => ({ ...f, category: v, internalAction: "", actionDetail: "" }))}
              >
                <SelectTrigger><SelectValue placeholder={t("violationForm.categoryPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(o => <SelectItem key={o.value} value={o.value}>{categoryOptionLabel(t, o.value)}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("violationForm.categoryHint")}</p>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>{t("violationForm.violationType")} <span className="text-destructive">*</span></Label>
              <Select
                value={form.violationType}
                onValueChange={v => setForm(f => ({ ...f, violationType: v, internalAction: "", actionDetail: "" }))}
              >
                <SelectTrigger><SelectValue placeholder={t("violationForm.violationTypePlaceholder")} /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {violationTypeList.map(vt => <SelectItem key={vt} value={vt}>{violationTypeLabel(t, vt)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.violationType && form.category && (
              <>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label>{t("violationForm.internalAction")}</Label>
                  <Select
                    value={form.internalAction}
                    onValueChange={v => setForm(f => ({ ...f, internalAction: v, actionDetail: "" }))}
                  >
                    <SelectTrigger><SelectValue placeholder={t("violationForm.internalActionPlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      {internalActionOptions[form.category as ViolationCategory].map(o => (
                        <SelectItem key={o.value} value={o.value}>{internalActionLabel(t, o.value)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.internalAction === FINE_ACTION && (
                  <div className="flex flex-col gap-1">
                    <Label>{t("violationForm.fineValue")} <span className="text-destructive">*</span></Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={form.actionDetail}
                      onChange={e => setForm(f => ({ ...f, actionDetail: e.target.value }))}
                      placeholder={t("violationForm.fineValuePlaceholder")}
                    />
                  </div>
                )}
                {form.internalAction === OTHER_ACTION && (
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <Label>{t("violationForm.specifyAction")} <span className="text-destructive">*</span></Label>
                    <Textarea
                      rows={2}
                      value={form.actionDetail}
                      onChange={e => setForm(f => ({ ...f, actionDetail: e.target.value }))}
                      placeholder={t("violationForm.specifyActionPlaceholder")}
                    />
                  </div>
                )}
              </>
            )}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>{t("violationForm.description")} <span className="text-destructive">*</span></Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder={t("violationForm.descriptionPlaceholder")} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>{t("violationForm.witnesses")}</Label>
              <Textarea value={form.witnesses} onChange={e => setForm(f => ({ ...f, witnesses: e.target.value }))} rows={2} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>{t("violationForm.proposedAction")}</Label>
              <Textarea value={form.proposedAction} onChange={e => setForm(f => ({ ...f, proposedAction: e.target.value }))} rows={2} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t("violationForm.addEvidence")}</Label>
              <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 cursor-pointer hover:bg-muted/50 transition-colors">
                <Camera className="size-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t("violationForm.captureHint")}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageCapture} />
              </label>
            </div>
            {images.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative group">
                    <img src={img} className="w-full h-32 object-cover rounded-lg border" alt="" />
                    <button type="button" onClick={() => setImages(imgs => imgs.filter((_, j) => j !== i))}
                      className="absolute top-1 left-1 size-6 bg-destructive text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">{t("violationForm.noImagesYet")}</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6">
            <SignaturePad label={t("violationForm.sigEditor")} value={editorSignature} onChange={setEditorSignature} />
            <SignaturePad label={t("violationForm.sigViolator")} value={violatorSignature} onChange={setViolatorSignature} />
            <SignaturePad label={t("violationForm.sigManager")} value={managerSignature} onChange={setManagerSignature} />
          </div>
        )}

        <div className="flex justify-between mt-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => step > 1 ? setStep(s => s - 1) : setOpen(false)} className="gap-1">
            {dir === "rtl" ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            {step === 1 ? t("violationForm.cancel") : t("violationForm.previous")}
          </Button>
          {step < 3 ? (
            <Button type="button" onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && (!form.employeeName || !form.category || !form.violationType || !form.place.trim() || !form.description.trim() || (form.entryMode === "manual" && manualDocs.length === 0))}
              className="gap-1">
              {t("violationForm.next")} {dir === "rtl" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
            </Button>
          ) : (
            <Button type="button" onClick={handleSave} disabled={isPending} className="gap-1">
              {isPending ? t("violationForm.saving") : t("violationForm.saveViolation")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
