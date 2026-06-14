"use client"

import { useState, useTransition, type ReactNode } from "react"
import { CheckCircle2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { StatusBadge } from "@/components/status-badge"
import { toast } from "@/hooks/use-toast"

type HrAction = (formData: FormData) => Promise<void>

export function HrActionCard({
  id,
  action,
  refLabel,
  status,
  rows,
  details,
  initialAction,
  initialDate,
  initialNotes,
}: {
  id: number
  action: HrAction
  refLabel: string
  status: string
  // الحقول المعروضة في رأس البطاقة (رقم، اسم، نوع، تاريخ...)
  rows: { label: string; value: ReactNode }[]
  // زر عرض التفاصيل (RecordDetailsDialog)
  details?: ReactNode
  initialAction: string
  initialDate: string
  initialNotes: string
}) {
  const [hrAction, setHrAction] = useState(initialAction)
  const [hrActionDate, setHrActionDate] = useState(initialDate)
  const [hrNotes, setHrNotes] = useState(initialNotes)
  const [pending, startTransition] = useTransition()
  const isClosed = status === "closed"

  function submit(markDone: boolean) {
    startTransition(async () => {
      const fd = new FormData()
      fd.append("id", String(id))
      fd.append("hrAction", hrAction)
      fd.append("hrActionDate", hrActionDate)
      fd.append("hrNotes", hrNotes)
      if (markDone) fd.append("markDone", "1")
      try {
        await action(fd)
        toast({ title: markDone ? "تم إغلاق البند" : "تم حفظ إجراء الموارد البشرية" })
      } catch {
        toast({ title: "تعذّر حفظ الإجراء", variant: "destructive" })
      }
    })
  }

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
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {details}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor={`hrAction-${refLabel}`}>إجراء الموارد البشرية</Label>
          <Input
            id={`hrAction-${refLabel}`}
            value={hrAction}
            onChange={(e) => setHrAction(e.target.value)}
            placeholder="مثال: إنذار كتابي، خصم يوم، إحالة للجنة..."
            disabled={pending}
          />
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
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => submit(false)} disabled={pending}>
          <Save className="size-4" />
          حفظ
        </Button>
        <Button type="button" size="sm" onClick={() => submit(true)} disabled={pending || isClosed}>
          <CheckCircle2 className="size-4" />
          {isClosed ? "تم الإغلاق" : "تم الإجراء"}
        </Button>
      </div>
    </div>
  )
}
