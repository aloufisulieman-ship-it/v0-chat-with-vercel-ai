"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { closeRecord, referRecord, reopenRecord } from "@/app/actions/lifecycle"
import { DEPTS, deptLabel, lifecycleUi, type Dept, type LifecycleModule } from "@/lib/lifecycle"

type L = "ar" | "en"

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

// ---------- نافذة الإحالة ----------
export function ReferDialog({
  open,
  onOpenChange,
  module,
  recordId,
  locale = "ar",
  defaultDept,
  lockedDept,
  lockedReason,
  onReferred,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  module: LifecycleModule
  recordId: number
  locale?: L
  defaultDept?: Dept | null
  // عند تمريرها تُقفَل الجهة على قيمة واحدة (قاعدة تصنيف الحوادث: داخلية→HR، خارجية→المالية).
  lockedDept?: Dept | null
  lockedReason?: string
  // يُستدعى بعد نجاح الإحالة إن اختار المستخدم إرسال البريد أيضاً (يفتح نافذة البريد).
  onReferred?: (opts: { alsoEmail: boolean }) => void
}) {
  const s = lifecycleUi(locale)
  const router = useRouter()
  const { toast } = useToast()
  const [dept, setDept] = useState<Dept | "">(lockedDept ?? defaultDept ?? "")
  const [notes, setNotes] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [alsoEmail, setAlsoEmail] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!dept) return
    setBusy(true)
    try {
      await referRecord({ module, id: recordId, dept, notes, dueDate: dueDate || null })
      toast({ title: locale === "en" ? "Record referred" : "تمت إحالة السجل" })
      onOpenChange(false)
      router.refresh()
      onReferred?.({ alsoEmail })
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent dir={locale === "ar" ? "rtl" : "ltr"} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{s.referTitle}</DialogTitle>
          <DialogDescription>{s.referDesc}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{s.dept}</Label>
            <Select value={dept} onValueChange={(v) => setDept(v as Dept)} disabled={busy || !!lockedDept}>
              <SelectTrigger aria-readonly={!!lockedDept}>
                <SelectValue placeholder={s.dept} />
              </SelectTrigger>
              <SelectContent>
                {(lockedDept ? [lockedDept] : DEPTS).map((d) => (
                  <SelectItem key={d} value={d}>
                    {deptLabel(d, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lockedDept && lockedReason && <p className="text-xs text-muted-foreground text-pretty">{lockedReason}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`refer-notes-${recordId}`}>{s.notes}</Label>
            <Textarea
              id={`refer-notes-${recordId}`}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`refer-due-${recordId}`}>{s.dueDate}</Label>
            <Input
              id={`refer-due-${recordId}`}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`refer-email-${recordId}`}
              checked={alsoEmail}
              onCheckedChange={(v) => setAlsoEmail(v === true)}
              disabled={busy}
            />
            <Label htmlFor={`refer-email-${recordId}`} className="text-sm font-normal">
              {s.alsoEmail}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {s.cancel}
          </Button>
          <Button onClick={submit} disabled={busy || !dept} className="gap-2">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? s.saving : s.refer}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- نافذة الإغلاق (تؤرشف تلقائياً) ----------
export function CloseDialog({
  open,
  onOpenChange,
  module,
  recordId,
  locale = "ar",
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  module: LifecycleModule
  recordId: number
  locale?: L
}) {
  const s = lifecycleUi(locale)
  const router = useRouter()
  const { toast } = useToast()
  const [action, setAction] = useState("")
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function submit() {
    if (!action.trim()) return
    setBusy(true)
    try {
      const file = fileRef.current?.files?.[0]
      const evidenceDataUrl = file ? await fileToDataUrl(file) : undefined
      await closeRecord({ module, id: recordId, closureAction: action.trim(), evidenceDataUrl })
      toast({ title: locale === "en" ? "Record closed and archived" : "تم إغلاق السجل وأرشفته" })
      onOpenChange(false)
      router.refresh()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent dir={locale === "ar" ? "rtl" : "ltr"} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{s.closeTitle}</DialogTitle>
          <DialogDescription>{s.closeDesc}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`close-action-${recordId}`}>{s.closureAction}</Label>
            <Textarea
              id={`close-action-${recordId}`}
              rows={3}
              value={action}
              onChange={(e) => setAction(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`close-evidence-${recordId}`}>{s.evidence}</Label>
            <Input id={`close-evidence-${recordId}`} type="file" ref={fileRef} accept="image/*,.pdf" disabled={busy} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {s.cancel}
          </Button>
          <Button onClick={submit} disabled={busy || !action.trim()} className="gap-2">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? s.saving : s.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- نافذة إعادة الفتح (admin فقط، السبب إلزامي) ----------
export function ReopenDialog({
  open,
  onOpenChange,
  module,
  recordId,
  locale = "ar",
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  module: LifecycleModule
  recordId: number
  locale?: L
}) {
  const s = lifecycleUi(locale)
  const router = useRouter()
  const { toast } = useToast()
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!reason.trim()) return
    setBusy(true)
    try {
      await reopenRecord({ module, id: recordId, reason: reason.trim() })
      toast({ title: locale === "en" ? "Record reopened" : "تمت إعادة فتح السجل" })
      onOpenChange(false)
      router.refresh()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent dir={locale === "ar" ? "rtl" : "ltr"} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{s.reopenTitle}</DialogTitle>
          <DialogDescription>{s.reopenDesc}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`reopen-reason-${recordId}`}>{s.reopenReason}</Label>
          <Textarea
            id={`reopen-reason-${recordId}`}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {s.cancel}
          </Button>
          <Button onClick={submit} disabled={busy || !reason.trim()} className="gap-2">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? s.saving : s.reopen}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
