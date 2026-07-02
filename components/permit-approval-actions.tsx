"use client"

import { useState, useTransition } from "react"
import { CheckCircle, XCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { updatePermitStatus } from "@/app/actions/hse"

export function PermitApprovalActions({
  permitId,
  approverName,
}: {
  permitId: number
  approverName: string
}) {
  const [mode, setMode] = useState<null | "approve" | "reject">(null)
  const [signature, setSignature] = useState("")
  const [notes, setNotes] = useState("")
  const [reason, setReason] = useState("")
  const [isPending, startTransition] = useTransition()

  function close() {
    setMode(null)
    setSignature("")
    setNotes("")
    setReason("")
  }

  function submit() {
    if (mode === "reject" && !reason.trim()) {
      toast({ title: "سبب الرفض مطلوب", variant: "destructive" })
      return
    }
    startTransition(async () => {
      try {
        await updatePermitStatus(
          permitId,
          mode === "approve" ? "approved" : "rejected",
          signature.trim() || approverName,
          mode === "approve" ? notes : reason,
        )
        toast({
          title: mode === "approve" ? "تم اعتماد التصريح" : "تم رفض التصريح",
          description: mode === "approve" ? "أصبح التصريح معتمداً." : "تم تسجيل سبب الرفض.",
        })
        close()
      } catch (err) {
        toast({
          title: "تعذّر تنفيذ الإجراء",
          description: err instanceof Error ? err.message : "حدث خطأ غير متوقع.",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setMode("approve")}
          className="flex items-center gap-1 rounded-md border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600 transition-colors hover:bg-green-500/20 dark:text-green-400"
          aria-label="موافقة"
        >
          <CheckCircle className="size-3.5" />
          موافقة
        </button>
        <button
          onClick={() => setMode("reject")}
          className="flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
          aria-label="رفض"
        >
          <XCircle className="size-3.5" />
          رفض
        </button>
      </div>

      <Dialog open={mode !== null} onOpenChange={(o) => (o ? null : close())}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{mode === "approve" ? "اعتماد تصريح العمل" : "رفض تصريح العمل"}</DialogTitle>
            <DialogDescription>
              {mode === "approve"
                ? "أدخل توقيع المدير وملاحظة اختيارية لاعتماد التصريح."
                : "يرجى إدخال سبب رفض التصريح (إجباري)."}
            </DialogDescription>
          </DialogHeader>

          {mode === "approve" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signature">توقيع المدير</Label>
                <Input
                  id="signature"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder={approverName}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notes">ملاحظة (اختياري)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي ملاحظات إضافية..."
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reason">سبب الرفض *</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="اذكر سبب رفض التصريح..."
                rows={4}
                required
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={isPending}>
              إلغاء
            </Button>
            <Button
              onClick={submit}
              disabled={isPending}
              className={
                mode === "approve"
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
            >
              {mode === "approve" ? "اعتماد" : "تأكيد الرفض"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
