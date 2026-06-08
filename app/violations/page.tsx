"use client"

import { useState, useEffect, useRef, useTransition } from "react"
import { FileWarning, Clock, CheckCircle2, PenLine, X, ChevronRight, ChevronLeft, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getViolations, createViolationFull, deleteViolation } from "@/app/actions/hse"
import { violationStatusOptions, statusLabels } from "@/lib/labels"

// ─── قائمة أنواع المخالفات ───────────────────────────────────────────────────
const VIOLATION_TYPES = [
  // عدم ارتداء معدات الحماية
  "عدم ارتداء خوذة السلامة",
  "عدم ارتداء حذاء السلامة",
  "عدم ارتداء سترة عاكسة",
  "عدم ارتداء قفازات واقية",
  "عدم ارتداء نظارات واقية",
  "عدم ارتداء كمامة أو جهاز تنفس",
  "عدم ارتداء حزام الأمان للعمل على الارتفاع",
  // سلامة العمل
  "العمل بدون تصريح عمل",
  "تجاوز منطقة العمل المحددة",
  "مخالفة إجراءات العزل والقفل (LOTO)",
  "استخدام معدات تالفة أو غير مطابقة",
  "تشغيل معدات بدون تدريب أو ترخيص",
  "الإهمال في تأمين منطقة العمل",
  "عدم الإبلاغ عن حادثة أو إصابة",
  // النظافة والترتيب
  "إهمال نظافة موقع العمل",
  "عدم التخلص الصحيح من النفايات",
  "سد مخارج الطوارئ أو ممرات الإخلاء",
  "تخزين مواد بطريقة غير آمنة",
  // السلوك
  "التشتت أو استخدام الهاتف أثناء العمل",
  "الإهمال المتعمد في اتباع تعليمات السلامة",
  "التدخين في مناطق محظورة",
  "السير في مسارات المركبات",
  "التصرف بصورة عدوانية أو غير لائقة",
  // المركبات والمعدات
  "قيادة مركبة بسرعة زائدة داخل الموقع",
  "عدم ارتداء حزام الأمان في المركبة",
  "استخدام الجوال أثناء القيادة",
  "إهمال صيانة المركبة أو المعدة",
  // المواد الخطرة
  "التعامل مع مواد خطرة بدون مؤهل",
  "عدم الالتزام بتعليمات بطاقة MSDS",
  "تسريب مواد كيميائية دون إبلاغ",
  // أخرى
  "مخالفة أخرى",
]

// ─── قائمة أنواع الحوادث ─────────────────────────────────────────────────────
export const INCIDENT_TYPES = [
  "إصابة عمل (بحاجة إلى إسعاف أولي)",
  "إصابة عمل (بحاجة إلى علاج طبي)",
  "إصابة عمل (مع توقف عن العمل)",
  "حالة وفاة",
  "حادثة كادت تقع (Near Miss)",
  "حريق أو انفجار",
  "تسرب مواد كيميائية أو خطرة",
  "انهيار أو سقوط هيكل",
  "سقوط من ارتفاع",
  "حادثة مركبة داخل الموقع",
  "صعق كهربائي",
  "انسكاب نفطي أو بيئي",
  "أضرار في الممتلكات",
  "حادثة صحية (إغماء، تشنج، إلخ)",
  "حادثة أخرى",
]

// ─── لوحة التوقيع ─────────────────────────────────────────────────────────────
function SignaturePad({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0)
      img.src = value
    }
  }, [])

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

// ─── نموذج تسجيل المخالفة (متعدد الخطوات) ────────────────────────────────────
function ViolationFormDialog({ user, onSaved }: { user: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [isPending, startTransition] = useTransition()

  // بيانات الخطوة الأولى
  const [form, setForm] = useState({
    employeeName: "",
    employeeNo: "",
    nationality: "",
    companyName: "",
    documentNo: "MHS-IMS-PR-HSE-647",
    violationDate: "",
    violationTime: "",
    place: "",
    violationType: "",
    description: "",
    witnesses: "",
    evidences: "",
    proposedAction: "",
    status: "open",
  })

  // صور الأدلة (base64)
  const [images, setImages] = useState<string[]>([])

  // التواقيع
  const [editorSignature, setEditorSignature] = useState("")
  const [violatorSignature, setViolatorSignature] = useState("")
  const [managerSignature, setManagerSignature] = useState("")

  function resetForm() {
    setStep(1)
    setForm({
      employeeName: "", employeeNo: "", nationality: "", companyName: "",
      documentNo: "MHS-IMS-PR-HSE-647", violationDate: "", violationTime: "",
      place: "", violationType: "", description: "", witnesses: "",
      evidences: "", proposedAction: "", status: "open",
    })
    setImages([])
    setEditorSignature("")
    setViolatorSignature("")
    setManagerSignature("")
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
        fd.append("editorSignature", editorSignature)
        fd.append("violatorSignature", violatorSignature)
        fd.append("managerSignature", managerSignature)
        fd.append("images", JSON.stringify(images))
        await createViolationFull(fd)
        toast({ title: "تم الحفظ بنجاح", description: "تم تسجيل المخالفة في قاعدة البيانات." })
        setOpen(false)
        resetForm()
        onSaved()
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

        {/* شريط الخطوات */}
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

        {/* ── الخطوة 1: بيانات المخالفة ── */}
        {step === 1 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <Label>المكان</Label>
              <Input value={form.place} onChange={e => setForm(f => ({ ...f, place: e.target.value }))} placeholder="موقع المخالفة" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {violationStatusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>نوع المخالفة <span className="text-destructive">*</span></Label>
              <Select value={form.violationType} onValueChange={v => setForm(f => ({ ...f, violationType: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر نوع المخالفة..." /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {VIOLATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>وصف تفصيلي (اختياري)</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="تفاصيل إضافية..." />
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

        {/* ── الخطوة 2: صور الأدلة ── */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>إضافة صور أدلة (اختياري)</Label>
              <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 cursor-pointer hover:bg-muted/50 transition-colors">
                <Camera className="size-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">اضغط لالتقاط صورة أو رفع ملف</span>
                <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handleImageCapture} />
              </label>
            </div>
            {images.length > 0 && (
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
            )}
            {images.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">لا توجد صور حتى الآن</p>}
          </div>
        )}

        {/* ── الخطوة 3: التواقيع ── */}
        {step === 3 && (
          <div className="flex flex-col gap-6">
            <SignaturePad label="توقيع المحرر" value={editorSignature} onChange={setEditorSignature} />
            <SignaturePad label="توقيع المخالف" value={violatorSignature} onChange={setViolatorSignature} />
            <SignaturePad label="توقيع المدير" value={managerSignature} onChange={setManagerSignature} />
          </div>
        )}

        {/* أزرار التنقل */}
        <div className="flex justify-between mt-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => step > 1 ? setStep(s => s - 1) : setOpen(false)}
            className="gap-1">
            <ChevronRight className="size-4" />
            {step === 1 ? "إلغاء" : "السابق"}
          </Button>
          {step < 3 ? (
            <Button type="button" onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && (!form.employeeName || !form.violationType)}
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

// ─── الصفحة الرئيسية ──────────────────────────────────────────────────────────
type Violation = Awaited<ReturnType<typeof getViolations>>[number]

export default async function ViolationsPage() {
  const user = await requireModule("violations")
  const violations = await getViolations()

  const open = violations.filter((v) => v.status === "open" || v.status === "in_progress").length
  const closed = violations.filter((v) => v.status === "closed").length

  const columns: Column<Violation>[] = [
    { key: "employeeName", header: "الموظف", render: (r) => <span className="font-medium">{r.employeeName}</span> },
    { key: "employeeNo", header: "الرقم الوظيفي", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.employeeNo || "-"}</span> },
    { key: "description", header: "نوع / وصف المخالفة", render: (r) => <span className="text-muted-foreground line-clamp-1 max-w-xs">{r.description || "-"}</span> },
    { key: "place", header: "المكان", render: (r) => <span className="text-muted-foreground">{r.place || "-"}</span> },
    { key: "violationDate", header: "التاريخ", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.violationDate ?? "-"}</span> },
    { key: "status", header: "الحالة", render: (r) => <StatusBadge status={r.status ?? "open"} /> },
    {
      key: "actions", header: "", className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="violations" recordId={r.id}
            title={`مخالفة: ${r.employeeName}`}
            subtitle="نموذج مخالفة رسمي"
            documentNo={r.documentNo ?? "MHS-IMS-PR-HSE-647"}
            fields={[
              { label: "اسم الموظف", value: r.employeeName },
              { label: "الرقم الوظيفي", value: r.employeeNo || "-" },
              { label: "الجنسية", value: (r as any).nationality || "-" },
              { label: "اسم الشركة", value: r.companyName || "-" },
              { label: "التاريخ", value: r.violationDate ?? "-" },
              { label: "الوقت", value: r.violationTime || "-" },
              { label: "المكان", value: r.place || "-" },
              { label: "وصف المخالفة", value: r.description || "-" },
              { label: "الشهود", value: r.witnesses || "-" },
              { label: "الإجراء المقترح", value: r.proposedAction || "-" },
              { label: "الحالة", value: statusLabels[r.status ?? ""] ?? "-" },
            ]}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={deleteViolation} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title="إدارة المخالفات"
      subtitle="تسجيل ومتابعة المخالفات وفق النموذج الرسمي (MHS-IMS-PR-HSE-647)"
      user={user}
      action={<ViolationFormDialog user={user} onSaved={() => {}} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="إجمالي المخالفات" value={violations.length} icon={FileWarning} tone="blue" />
        <KpiCard label="مفتوحة / قيد المعالجة" value={open} icon={Clock} tone="accent" />
        <KpiCard label="مغلقة" value={closed} icon={CheckCircle2} tone="primary" />
      </div>
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">سجل المخالفات</h2>
        <DataTable columns={columns} rows={violations} emptyMessage="لا توجد مخالفات مسجلة." />
      </div>
    </AppShell>
  )
}
