"use client"

import { useState, useTransition, type ReactNode } from "react"
import { CheckCircle2, Save, Paperclip, X, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { financeStatusOptions, normalizeFinanceStatus, type FinanceStatus } from "@/lib/finance-status"

type FinanceAction = (formData: FormData) => Promise<void>

export function FinanceActionCard({
  id,
  action,
  refLabel,
  financeStatus: initialStatus,
  rows,
  details,
  initialSettlement,
  initialReceipt,
  closedBy,
  closedAt,
}: {
  id: number
  action: FinanceAction
  refLabel: string
  financeStatus: string | null
  // الحقول المعروضة في رأس البطاقة (رقم، اسم، نوع، تاريخ...)
  rows: { label: string; value: ReactNode }[]
  // زر عرض التفاصيل (RecordDetailsDialog)
  details?: ReactNode
  initialSettlement: string
  initialReceipt: string
  closedBy?: string
  closedAt?: string
}) {
  const [settlementNumber, setSettlementNumber] = useState(initialSettlement)
  const [receipt, setReceipt] = useState<string>(initialReceipt)
  const [status, setStatus] = useState<FinanceStatus>(normalizeFinanceStatus(initialStatus))
  const [pending, startTransition] = useTransition()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setReceipt(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  function submit() {
    if (status === "closed" && !settlementNumber.trim()) {
      toast({ title: "رقم الستلمنت إلزامي عند إغلاق الحالة", variant: "destructive" })
      return
    }
    if (status === "closed" && !receipt) {
      toast({ title: "إيصال الدفع إلزامي عند إغلاق الحالة", variant: "destructive" })
      return
    }
    startTransition(async () => {
      const fd = new FormData()
      fd.append("id", String(id))
      fd.append("settlementNumber", settlementNumber)
      fd.append("paymentReceipt", receipt)
      fd.append("financeStatus", status)
      try {
        await action(fd)
        toast({ title: status === "closed" ? "تم إغلاق الحالة" : "تم حفظ إجراء المالية" })
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
          <Label htmlFor={`finStatusSel-${refLabel}`}>حالة المعالجة</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as FinanceStatus)} disabled={pending}>
            <SelectTrigger id={`finStatusSel-${refLabel}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {financeStatusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`settlement-${refLabel}`}>
            رقم الستلمنت {status === "closed" && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id={`settlement-${refLabel}`}
            value={settlementNumber}
            onChange={(e) => setSettlementNumber(e.target.value)}
            placeholder="مثال: STL-2026-0142"
            dir="ltr"
            disabled={pending}
          />
        </div>

        {/* رفع إيصال الدفع بنفس آلية الملفات في النظام */}
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>
            إيصال الدفع {status === "closed" && <span className="text-destructive">*</span>}
          </Label>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50">
            <Paperclip className="size-4" />
            اضغط لإرفاق إيصال الدفع (صورة أو PDF)
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} disabled={pending} />
          </label>
          {receipt && (
            <div className="group relative w-fit">
              {isImage(receipt) ? (
                <img src={receipt || "/placeholder.svg"} alt="إيصال الدفع" className="size-16 rounded border border-border object-cover" />
              ) : (
                <div className="flex size-16 flex-col items-center justify-center gap-1 rounded border border-border bg-muted/40 text-[10px] text-muted-foreground">
                  <FileText className="size-5" />
                  ملف
                </div>
              )}
              <button
                type="button"
                onClick={() => setReceipt("")}
                disabled={pending}
                className="absolute -left-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="حذف الإيصال"
              >
                <X className="size-3" />
              </button>
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
