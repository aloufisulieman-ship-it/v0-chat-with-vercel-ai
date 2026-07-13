"use client"

import { useState, useTransition, type ReactNode } from "react"
import { CheckCircle2, Save, Paperclip, X, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { hrStatusOptions, normalizeHrStatus, type HrStatus } from "@/lib/hr-status"

type HrAction = (formData: FormData) => Promise<void>

export function HrActionCard({
  id,
  action,
  refLabel,
  hrStatus: initialStatus,
  rows,
  details,
  initialAction,
  initialDate,
  initialNotes,
  initialAttachments,
  closedBy,
  closedAt,
}: {
  id: number
  action: HrAction
  refLabel: string
  hrStatus: string | null
  // الحقول المعروضة في رأس البطاقة (رقم، اسم، نوع، تاريخ...)
  rows: { label: string; value: ReactNode }[]
  // زر عرض التفاصيل (RecordDetailsDialog)
  details?: ReactNode
  initialAction: string
  initialDate: string
  initialNotes: string
  initialAttachments: string[]
  closedBy?: string
  closedAt?: string
}) {
  const [hrAction, setHrAction] = useState(initialAction)
  const [hrActionDate, setHrActionDate] = useState(initialDate)
  const [hrNotes, setHrNotes] = useState(initialNotes)
  const [status, setStatus] = useState<HrStatus>(normalizeHrStatus(initialStatus))
  const [attachments, setAttachments] = useState<string[]>(initialAttachments)
  const [pending, startTransition] = useTransition()

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach((f) => {
      const reader = new FileReader()
      reader.onload = () => setAttachments((prev) => [...prev, reader.result as string])
      reader.readAsDataURL(f)
    })
    e.target.value = ""
  }

  function submit() {
    if (status === "closed" && !hrAction.trim()) {
      toast({ title: "الإجراء المتخذ إلزامي عند إغلاق الحالة", variant: "destructive" })
      return
    }
    startTransition(async () => {
      const fd = new FormData()
      fd.append("id", String(id))
      fd.append("hrAction", hrAction)
      fd.append("hrActionDate", hrActionDate)
      fd.append("hrNotes", hrNotes)
      fd.append("hrStatus", status)
      fd.append("hrAttachment", JSON.stringify(attachments))
      try {
        await action(fd)
        toast({ title: status === "closed" ? "تم إغلاق الحالة" : "تم حفظ إجراء الموارد البشرية" })
      } catch (err) {
        toast({
          title: "تعذّر حفظ الإجراء",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        })
      }
    })
  }

  const isImage = (u: string) => u.startsWith("data:image")

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-col">
              <span className="text-xs text-muted-foreground">{r.label}</span>
              <span className="text-sm font-medium text-foreground">{r.value}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">{details}</div>
      </div>

      {/* بيانات الإغلاق إن وُجدت */}
      {status === "closed" && (closedBy || closedAt) && (
        <p className="mb-3 rounded-md bg-green-500/10 px-3 py-1.5 text-xs text-green-700 dark:text-green-400">
          أُغلقت الحالة{closedBy ? ` بواسطة ${closedBy}` : ""}
          {closedAt ? ` بتاريخ ${new Date(closedAt).toLocaleString("ar")}` : ""}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`hrStatusSel-${refLabel}`}>حالة المعالجة</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as HrStatus)} disabled={pending}>
            <SelectTrigger id={`hrStatusSel-${refLabel}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {hrStatusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`hrDate-${refLabel}`}>تاريخ الإجراء</Label>
          <Input
            id={`hrDate-${refLabel}`}
            type="date"
            value={hrActionDate}
            onChange={(e) => setHrActionDate(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor={`hrAction-${refLabel}`}>
            الإجراء المتخذ {status === "closed" && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id={`hrAction-${refLabel}`}
            value={hrAction}
            onChange={(e) => setHrAction(e.target.value)}
            placeholder="مثال: إنذار كتابي، خصم يوم، إحالة للجنة..."
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor={`hrNotes-${refLabel}`}>ملاحظات HR</Label>
          <Textarea
            id={`hrNotes-${refLabel}`}
            value={hrNotes}
            onChange={(e) => setHrNotes(e.target.value)}
            placeholder="ملاحظات إضافية..."
            rows={2}
            disabled={pending}
          />
        </div>

        {/* رفع المرفقات (قرار إداري، محضر، إنذار...) بنفس آلية الصور في النظام */}
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>المرفقات (قرار إداري، محضر اجتماع، إنذار...)</Label>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50">
            <Paperclip className="size-4" />
            اضغط لإرفاق ملف أو صورة
            <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleFiles} disabled={pending} />
          </label>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <div key={i} className="group relative">
                  {isImage(a) ? (
                    <img src={a || "/placeholder.svg"} alt="" className="size-16 rounded border border-border object-cover" />
                  ) : (
                    <div className="flex size-16 flex-col items-center justify-center gap-1 rounded border border-border bg-muted/40 text-[10px] text-muted-foreground">
                      <FileText className="size-5" />
                      ملف
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                    disabled={pending}
                    className="absolute -left-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="حذف المرفق"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant={status === "closed" ? "default" : "outline"} size="sm" onClick={submit} disabled={pending}>
          {status === "closed" ? <CheckCircle2 className="size-4" /> : <Save className="size-4" />}
          {status === "closed" ? "إغلاق الحالة" : "حفظ"}
        </Button>
      </div>
    </div>
  )
}
