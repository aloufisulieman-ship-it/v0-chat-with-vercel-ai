"use client"

import { useState, useRef, useTransition } from "react"
import { FileWarning, PenLine, X, ChevronRight, ChevronLeft, Camera, FileText, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { createViolationFull } from "@/app/actions/hse"
import { violationStatusOptions } from "@/lib/labels"
import {
  categoryOptions,
  internalActionOptions,
  FINE_ACTION,
  OTHER_ACTION,
  type ViolationCategory,
} from "@/lib/violation-category"

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

export function ViolationFormDialog() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    employeeName: "", employeeNo: "", nationality: "", companyName: "",
    documentNo: "MHS-IMS-PR-HSE-647", violationDate: "", violationTime: "",
    place: "", violationType: "", category: "", internalAction: "", actionDetail: "",
    description: "", witnesses: "",
    evidences: "", proposedAction: "", status: "open", entryMode: "electronic",
  })

  const [images, setImages] = useState<string[]>([])
  // النماذج الورقية الممسوحة للمخالفة اليدوية: { name, dataUrl }
  const [manualDocs, setManualDocs] = useState<{ name: string; dataUrl: string }[]>([])
  const [editorSignature, setEditorSignature] = useState("")
  const [violatorSignature, setViolatorSignature] = useState("")
  const [managerSignature, setManagerSignature] = useState("")

  function resetForm() {
    setStep(1)
    setForm({
      employeeName: "", employeeNo: "", nationality: "", companyName: "",
      documentNo: "MHS-IMS-PR-HSE-647", violationDate: "", violationTime: "",
      place: "", violationType: "", category: "", internalAction: "", actionDetail: "",
      description: "", witnesses: "",
      evidences: "", proposedAction: "", status: "open", entryMode: "electronic",
    })
    setImages([])
    setManualDocs([])
    setEditorSignature("")
    setViolatorSignature("")
    setManagerSignature("")
  }

  function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach((f) => {
      const reader = new FileReader()
      reader.onload = () => setManualDocs((prev) => [...prev, { name: f.name, dataUrl: reader.result as string }])
      reader.readAsDataURL(f)
    })
    e.target.value = ""
  }

  function handleImageCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach((f) => {
      const reader = new FileReader()
      reader.onload = () => setImages((prev) => [...prev, reader.result as string])
      reader.readAsDataURL(f)
    })
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const fd = new FormData()
        Object.entries(form).forEach(([k, v]) => fd.append(k, v))
        // ادمج الإجراء مع التفاصيل الإضافية (المبلغ أو النص الحر) في قيمة واحدة
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
        toast({ title: "تم الحفظ بنجاح", description: "تم تسجيل المخالفة في قاعدة البيانات." })
        setOpen(false)
        resetForm()
      } catch (err) {
        toast({ title: "تعذّر الحفظ", description: err instanceof Error ? err.message : "حدث خطأ.", variant: "destructive" })
      }
    })
  }

  const steps = ["بيانات المخالفة", "صور الأدلة", "التواقيع"]

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger asChild>
        <Button className="gap-2"><FileWarning className="size-4" /> تسجيل مخالفة جديدة</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسجيل مخالفة جديدة</DialogTitle>
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
              <Label>مصدر المخالفة</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, entryMode: "electronic" }))}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${form.entryMode === "electronic" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted"}`}
                >
                  إلكترونية (عبر النظام)
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, entryMode: "manual" }))}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${form.entryMode === "manual" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted"}`}
                >
                  يدوية (نموذج ورقي)
                </button>
              </div>
              {form.entryMode === "manual" && (
                <div className="flex flex-col gap-2 pt-1">
                  <label className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="size-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">أرفق النموذج الورقي الممسوح (PDF أو صورة أو مستند)</span>
                    <input type="file" accept="image/*,application/pdf,.doc,.docx" multiple className="hidden" onChange={handleDocUpload} />
                  </label>
                  {manualDocs.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                      {manualDocs.map((d, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
                          <span className="flex items-center gap-1.5 truncate"><FileText className="size-3.5 shrink-0 text-muted-foreground" /> <span className="truncate">{d.name}</span></span>
                          <button type="button" onClick={() => setManualDocs(docs => docs.filter((_, j) => j !== i))} className="shrink-0 text-destructive hover:opacity-70" aria-label="حذف الملف">
                            <X className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label>اسم الموظف <span className="text-destructive">*</span></Label>
              <Input value={form.employeeName} onChange={e => setForm(f => ({ ...f, employeeName: e.target.value }))} placeholder="الاسم الكامل" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>الرقم الوظيفي</Label>
              <Input value={form.employeeNo} onChange={e => setForm(f => ({ ...f, employeeNo: e.target.value }))} placeholder="مثال: 1024" dir="ltr" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>الجنسية</Label>
              <Input value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} placeholder="مثال: سعودي، هندي..." />
            </div>
            <div className="flex flex-col gap-1">
              <Label>اسم الشركة</Label>
              <Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>التاريخ</Label>
              <Input type="date" value={form.violationDate} onChange={e => setForm(f => ({ ...f, violationDate: e.target.value }))} dir="ltr" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>الوقت</Label>
              <Input value={form.violationTime} onChange={e => setForm(f => ({ ...f, violationTime: e.target.value }))} placeholder="مثال: 10:30 صباحاً" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>المكان <span className="text-destructive">*</span></Label>
              <Input value={form.place} onChange={e => setForm(f => ({ ...f, place: e.target.value }))} placeholder="موقع المخالفة" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>الحال��</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {violationStatusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>التصنيف <span className="text-destructive">*</span></Label>
              <Select
                value={form.category}
                onValueChange={v => setForm(f => ({ ...f, category: v, internalAction: "", actionDetail: "" }))}
              >
                <SelectTrigger><SelectValue placeholder="اختر التصنيف: داخلية أو خارجية..." /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">يحدد التصنيف جهة الإحالة تلقائياً: الداخلية للموارد البشرية، والخارجية للمالية.</p>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>نوع المخالفة <span className="text-destructive">*</span></Label>
              <Select
                value={form.violationType}
                onValueChange={v => setForm(f => ({ ...f, violationType: v, internalAction: "", actionDetail: "" }))}
              >
                <SelectTrigger><SelectValue placeholder="اختر نوع المخالفة..." /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {VIOLATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.violationType && form.category && (
              <>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label>الإجراء الداخلي</Label>
                  <Select
                    value={form.internalAction}
                    onValueChange={v => setForm(f => ({ ...f, internalAction: v, actionDetail: "" }))}
                  >
                    <SelectTrigger><SelectValue placeholder="اختر الإجراء..." /></SelectTrigger>
                    <SelectContent>
                      {internalActionOptions[form.category as ViolationCategory].map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.internalAction === FINE_ACTION && (
                  <div className="flex flex-col gap-1">
                    <Label>قيمة الغرامة (ريال سعودي) <span className="text-destructive">*</span></Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={form.actionDetail}
                      onChange={e => setForm(f => ({ ...f, actionDetail: e.target.value }))}
                      placeholder="مثال: 500"
                    />
                  </div>
                )}
                {form.internalAction === OTHER_ACTION && (
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <Label>حدّد الإجراء <span className="text-destructive">*</span></Label>
                    <Textarea
                      rows={2}
                      value={form.actionDetail}
                      onChange={e => setForm(f => ({ ...f, actionDetail: e.target.value }))}
                      placeholder="اكتب الإجراء المتخذ..."
                    />
                  </div>
                )}
              </>
            )}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>وصف المخالفة <span className="text-destructive">*</span></Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="اوصف المخالفة بالتفصيل..." />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>الشهود</Label>
              <Textarea value={form.witnesses} onChange={e => setForm(f => ({ ...f, witnesses: e.target.value }))} rows={2} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>الإجراء التأديبي المقترح</Label>
              <Textarea value={form.proposedAction} onChange={e => setForm(f => ({ ...f, proposedAction: e.target.value }))} rows={2} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>إضافة صور أدلة (اختياري)</Label>
              <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 cursor-pointer hover:bg-muted/50 transition-colors">
                <Camera className="size-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">اضغط لالتقاط صورة أو رفع ملف</span>
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
              <p className="text-center text-sm text-muted-foreground py-4">لا توجد صور حتى الآن</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6">
            <SignaturePad label="توقيع المحرر" value={editorSignature} onChange={setEditorSignature} />
            <SignaturePad label="توقيع المخالف" value={violatorSignature} onChange={setViolatorSignature} />
            <SignaturePad label="توقيع المدير" value={managerSignature} onChange={setManagerSignature} />
          </div>
        )}

        <div className="flex justify-between mt-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => step > 1 ? setStep(s => s - 1) : setOpen(false)} className="gap-1">
            <ChevronRight className="size-4" />
            {step === 1 ? "إلغاء" : "السابق"}
          </Button>
          {step < 3 ? (
            <Button type="button" onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && (!form.employeeName || !form.category || !form.violationType || !form.place.trim() || !form.description.trim() || (form.entryMode === "manual" && manualDocs.length === 0))}
              className="gap-1">
              التالي <ChevronLeft className="size-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSave} disabled={isPending} className="gap-1">
              {isPending ? "جارٍ الحفظ..." : "حفظ المخالفة"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
