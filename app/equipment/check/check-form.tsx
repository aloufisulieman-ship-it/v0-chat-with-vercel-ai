"use client"

import { useState, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Truck,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ShieldCheck,
  ShieldAlert,
  Camera,
  Loader2,
  AlertTriangle,
  ClipboardCheck,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/client"
import { InlineSignatureField } from "@/components/inline-signature-field"
import {
  submitDailyCheck,
  resolveOperatorPermit,
  type CheckEquipmentInfo,
  type ChecklistItemRow,
  type SubmitCheckResult,
  type OperatorPermitResult,
} from "@/app/actions/equipment-checks"
import { compressSignatureDataUrl } from "@/lib/image-compress"

type ItemStatus = "ok" | "defect" | "na"
type ItemState = { status: ItemStatus; note: string; photoUrl: string }

async function uploadImage(dataUrl: string, kind: string): Promise<string> {
  const res = await fetch("/api/equipment-checks/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image: dataUrl, kind }),
  })
  if (!res.ok) throw new Error("upload failed")
  const json = (await res.json()) as { url: string }
  return json.url
}

export function CheckForm({
  info,
  items,
  currentShift,
  operatorDefaultName,
}: {
  info: CheckEquipmentInfo
  items: ChecklistItemRow[]
  currentShift: "1" | "2" | "3"
  operatorDefaultName: string
}) {
  const { locale } = useI18n()
  const ar = locale === "ar"
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [operatorName, setOperatorName] = useState(operatorDefaultName ?? "")
  const [shift, setShift] = useState<"1" | "2" | "3">(currentShift)
  const [hourMeter, setHourMeter] = useState("")
  const [notes, setNotes] = useState("")
  const [signature, setSignature] = useState("")
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(items.map((it) => [it.itemCode, { status: "ok", note: "", photoUrl: "" }])),
  )
  const [error, setError] = useState("")
  const [result, setResult] = useState<SubmitCheckResult | null>(null)
  const [duplicateConfirm, setDuplicateConfirm] = useState<string | null>(null)
  const [uploadingCode, setUploadingCode] = useState<string | null>(null)

  // حالة تصريح القيادة (يُتحقّق منه فور كتابة الاسم).
  const [permit, setPermit] = useState<OperatorPermitResult | null>(null)
  const [checkingPermit, setCheckingPermit] = useState(false)
  const permitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const activeItemForPhoto = useRef<string | null>(null)

  function verifyPermit(name: string) {
    if (permitTimer.current) clearTimeout(permitTimer.current)
    if (!name.trim()) {
      setPermit(null)
      return
    }
    permitTimer.current = setTimeout(async () => {
      setCheckingPermit(true)
      try {
        const res = await resolveOperatorPermit(name)
        setPermit(res)
      } catch {
        setPermit(null)
      } finally {
        setCheckingPermit(false)
      }
    }, 500)
  }

  function setItem(code: string, patch: Partial<ItemState>) {
    setState((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }))
  }

  function triggerPhoto(code: string) {
    activeItemForPhoto.current = code
    fileInputRef.current?.click()
  }

  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const code = activeItemForPhoto.current
    e.target.value = ""
    if (!file || !code) return
    setUploadingCode(code)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const compressed = await compressSignatureDataUrl(dataUrl)
      const url = await uploadImage(compressed, "defect")
      setItem(code, { photoUrl: url })
    } catch {
      setError(ar ? "تعذّر رفع الصورة." : "Photo upload failed.")
    } finally {
      setUploadingCode(null)
    }
  }

  const criticalDefects = items.filter((it) => it.isSafetyCritical && state[it.itemCode]?.status === "defect")
  const minorDefects = items.filter((it) => !it.isSafetyCritical && state[it.itemCode]?.status === "defect")
  const projectedUnfit = criticalDefects.length > 0

  function doSubmit(allowDuplicate: boolean) {
    setError("")
    if (!operatorName.trim()) {
      setError(ar ? "أدخل اسم السائق." : "Enter operator name.")
      return
    }
    if (!signature) {
      setError(ar ? "توقيع السائق مطلوب." : "Operator signature is required.")
      return
    }
    // بنود العيوب الحرجة تتطلب ملاحظة توضيحية.
    for (const it of criticalDefects) {
      if (!state[it.itemCode].note.trim()) {
        setError(ar ? `أضف ملاحظة للعيب الحرج: ${it.labelAr}` : `Add a note for critical defect: ${it.labelEn}`)
        return
      }
    }

    startTransition(async () => {
      try {
        const sigUrl = await uploadImage(await compressSignatureDataUrl(signature), "signature")
        const res = await submitDailyCheck({
          equipmentId: info.id,
          operatorName: operatorName.trim(),
          shift,
          hourMeter: hourMeter ? Number(hourMeter) : null,
          entryMethod: info.qrToken ? "qr" : "manual",
          location: info.location,
          notes,
          operatorSignatureUrl: sigUrl,
          allowDuplicate,
          items: items.map((it) => ({
            itemCode: it.itemCode,
            status: state[it.itemCode].status,
            note: state[it.itemCode].note,
            photoUrl: state[it.itemCode].photoUrl,
          })),
        })
        if (!res.ok) {
          if (res.blocked === "duplicate") {
            setDuplicateConfirm(res.message ?? (ar ? "يوجد فحص سابق. متابعة؟" : "Duplicate exists. Continue?"))
            return
          }
          setError(res.message ?? (ar ? "تعذّر اعتماد الفحص." : "Could not submit the check."))
          return
        }
        setDuplicateConfirm(null)
        setResult(res)
      } catch {
        setError(ar ? "حدث خطأ غير متوقع." : "An unexpected error occurred.")
      }
    })
  }

  // ── شاشة النتيجة بعد الاعتماد ──
  if (result) {
    const fit = result.result === "fit"
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5 py-6 text-center">
        <div
          className={cn(
            "flex size-20 items-center justify-center rounded-full",
            fit ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
          )}
        >
          {fit ? <ShieldCheck className="size-10" /> : <ShieldAlert className="size-10" />}
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold">
            {fit ? (ar ? "المعدة صالحة للتشغيل" : "Equipment fit for operation") : ar ? "المعدة غير صالحة" : "Equipment unfit"}
          </h2>
          <p className="font-mono text-sm text-muted-foreground" dir="ltr">
            {result.code}
          </p>
        </div>
        {!fit && (
          <div className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-start text-sm">
            <p className="font-semibold text-destructive">{ar ? "أُخرجت المعدة من الخدمة تلقائياً." : "Equipment was automatically taken out of service."}</p>
            {result.maintenanceTicketCode && (
              <p className="mt-1 text-muted-foreground" dir="ltr">
                {ar ? "تذكرة صيانة: " : "Maintenance ticket: "}
                {result.maintenanceTicketCode}
              </p>
            )}
          </div>
        )}
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1 bg-transparent" onClick={() => router.push("/equipment/check")}>
            {ar ? "فحص معدة أخرى" : "Check another"}
          </Button>
          <Button className="flex-1" onClick={() => router.push(`/equipment/${info.id}`)}>
            {ar ? "عرض بطاقة المعدة" : "View equipment"}
          </Button>
        </div>
      </div>
    )
  }

  const permitBlocked = permit && permit.status !== "valid"

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 pb-24">
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhotoSelected} />

      {/* بطاقة المعدة */}
      <Card className="flex items-center gap-4 p-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Truck className="size-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold" dir="ltr">
            {info.fleetNo || info.plateNumber || `#${info.id}`}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {info.equipmentType} · {info.manufacturer} {info.model}
          </p>
        </div>
        <div className="shrink-0 rounded-md bg-muted px-2.5 py-1 text-xs font-medium">
          {info.powerType === "electric" ? (ar ? "كهربائية" : "Electric") : ar ? "ديزل" : "Diesel"}
        </div>
      </Card>

      {info.openTicket && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {ar ? "المعدة خارج الخدمة بتذكرة صيانة مفتوحة " : "Out of service — open maintenance ticket "}
            <span dir="ltr" className="font-mono">
              ({info.openTicket.code})
            </span>
            . {ar ? "لا يمكن اعتماد فحص جديد." : "New checks are blocked."}
          </span>
        </div>
      )}

      {/* بيانات السائق والوردية */}
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="operator">{ar ? "اسم السائق" : "Operator name"}</Label>
          <Input
            id="operator"
            value={operatorName}
            onChange={(e) => {
              setOperatorName(e.target.value)
              verifyPermit(e.target.value)
            }}
            placeholder={ar ? "الاسم الكامل" : "Full name"}
          />
          {/* حالة تصريح القيادة */}
          {checkingPermit && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              {ar ? "جارٍ التحقق من تصريح القيادة…" : "Checking driving permit…"}
            </p>
          )}
          {!checkingPermit && permit && (
            <p
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium",
                permit.status === "valid" ? "text-primary" : "text-destructive",
              )}
            >
              {permit.status === "valid" ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
              {permit.status === "valid"
                ? ar
                  ? `تصريح قيادة ساري (${permit.documentNo})`
                  : `Valid permit (${permit.documentNo})`
                : permit.status === "expired"
                  ? ar
                    ? "تصريح القيادة منتهي الصلاحية"
                    : "Driving permit expired"
                  : ar
                    ? "لا يوجد تصريح قيادة ساري بهذا الاسم"
                    : "No valid driving permit for this name"}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label>{ar ? "الوردية" : "Shift"}</Label>
            <Select value={shift} onValueChange={(v) => setShift(v as "1" | "2" | "3")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{ar ? "الأولى" : "Shift 1"}</SelectItem>
                <SelectItem value="2">{ar ? "الثانية" : "Shift 2"}</SelectItem>
                <SelectItem value="3">{ar ? "الثالثة" : "Shift 3"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="hourMeter">{ar ? "عداد الساعات" : "Hour meter"}</Label>
            <Input
              id="hourMeter"
              type="number"
              inputMode="numeric"
              value={hourMeter}
              onChange={(e) => setHourMeter(e.target.value)}
              placeholder={ar ? "اختياري" : "Optional"}
              dir="ltr"
            />
          </div>
        </div>
      </Card>

      {/* بنود الفحص */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-1">
          <ClipboardCheck className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{ar ? "بنود الفحص" : "Checklist items"}</h3>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>

        {items.map((it) => {
          const s = state[it.itemCode]
          const isDefect = s?.status === "defect"
          return (
            <Card key={it.itemCode} className={cn("flex flex-col gap-3 p-4", isDefect && "border-destructive/40")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium leading-snug">{ar ? it.labelAr : it.labelEn}</span>
                  {it.isSafetyCritical && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-destructive">
                      <ShieldAlert className="size-3" />
                      {ar ? "بند حرج للسلامة" : "Safety-critical"}
                    </span>
                  )}
                </div>
              </div>

              {/* أزرار الحالة */}
              <div className="grid grid-cols-3 gap-2">
                <StatusButton
                  active={s?.status === "ok"}
                  tone="ok"
                  icon={CheckCircle2}
                  label={ar ? "سليم" : "OK"}
                  onClick={() => setItem(it.itemCode, { status: "ok" })}
                />
                <StatusButton
                  active={s?.status === "defect"}
                  tone="defect"
                  icon={XCircle}
                  label={ar ? "عيب" : "Defect"}
                  onClick={() => setItem(it.itemCode, { status: "defect" })}
                />
                <StatusButton
                  active={s?.status === "na"}
                  tone="na"
                  icon={MinusCircle}
                  label={ar ? "لا ينطبق" : "N/A"}
                  onClick={() => setItem(it.itemCode, { status: "na" })}
                />
              </div>

              {/* تفاصيل العيب */}
              {isDefect && (
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={s.note}
                    onChange={(e) => setItem(it.itemCode, { note: e.target.value })}
                    placeholder={
                      it.isSafetyCritical
                        ? ar
                          ? "صف العيب (مطلوب للبند الحرج)"
                          : "Describe the defect (required for critical item)"
                        : ar
                          ? "ملاحظة (اختياري)"
                          : "Note (optional)"
                    }
                    rows={2}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 bg-transparent"
                      onClick={() => triggerPhoto(it.itemCode)}
                      disabled={uploadingCode === it.itemCode}
                    >
                      {uploadingCode === it.itemCode ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Camera className="size-3.5" />
                      )}
                      {s.photoUrl ? (ar ? "تغيير الصورة" : "Change photo") : ar ? "إضافة صورة" : "Add photo"}
                    </Button>
                    {s.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.photoUrl || "/placeholder.svg"} alt="" className="size-10 rounded-md border object-cover" />
                    )}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* ملخّص النتيجة المتوقّعة */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium",
          projectedUnfit
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : "border-primary/30 bg-primary/10 text-primary",
        )}
      >
        {projectedUnfit ? <ShieldAlert className="size-4" /> : <ShieldCheck className="size-4" />}
        {projectedUnfit
          ? ar
            ? `عيوب حرجة (${criticalDefects.length}) — ستُخرَج المعدة من الخدمة`
            : `Critical defects (${criticalDefects.length}) — equipment will be taken out of service`
          : minorDefects.length > 0
            ? ar
              ? `عيوب غير حرجة (${minorDefects.length}) — المعدة صالحة مع إجراء تصحيحي`
              : `Minor defects (${minorDefects.length}) — fit with a corrective action`
            : ar
              ? "لا عيوب — المعدة صالحة للتشغيل"
              : "No defects — fit for operation"}
      </div>

      {/* التوقيع */}
      <Card className="p-4">
        <InlineSignatureField label={ar ? "توقيع السائق" : "Operator signature"} required onChange={setSignature} />
      </Card>

      {/* ملاحظات عامة */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">{ar ? "ملاحظات عامة" : "General notes"}</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* شريط الإرسال الثابت */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Button
            className="flex-1"
            size="lg"
            disabled={isPending || Boolean(info.openTicket) || Boolean(permitBlocked)}
            onClick={() => doSubmit(false)}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
            {ar ? "اعتماد الفحص" : "Submit check"}
          </Button>
        </div>
      </div>

      {/* تأكيد التكرار */}
      <Dialog open={Boolean(duplicateConfirm)} onOpenChange={(o) => !o && setDuplicateConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ar ? "فحص مكرّر" : "Duplicate check"}</DialogTitle>
            <DialogDescription>{duplicateConfirm}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateConfirm(null)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={() => doSubmit(true)} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {ar ? "المتابعة على أي حال" : "Continue anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusButton({
  active,
  tone,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  tone: "ok" | "defect" | "na"
  icon: typeof CheckCircle2
  label: string
  onClick: () => void
}) {
  const toneActive =
    tone === "ok"
      ? "border-primary bg-primary text-primary-foreground"
      : tone === "defect"
        ? "border-destructive bg-destructive text-destructive-foreground"
        : "border-muted-foreground bg-muted text-foreground"
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg border py-2.5 text-xs font-medium transition-colors",
        active ? toneActive : "border-border bg-transparent text-muted-foreground hover:bg-accent",
      )}
    >
      <Icon className="size-5" />
      {label}
    </button>
  )
}
