"use client"

import { useState, useTransition } from "react"
import { Pencil, X, FileText, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { updateViolation } from "@/app/actions/hse"
import { violationStatusOptions } from "@/lib/labels"
import { compressImage } from "@/lib/image-compress"
import { categoryOptions, type ViolationCategory } from "@/lib/violation-category"
import { useI18n } from "@/lib/i18n/client"
import { statusLabel, categoryOptionLabel } from "@/lib/i18n/labels"

type ViolationRow = {
  id: number
  companyName: string | null
  employeeName: string
  employeeNo: string | null
  nationality: string | null
  violationType: string | null
  category: string | null
  entryMode: string | null
  detectedBy: string | null
  internalAction: string | null
  violationDate: string | null
  violationTime: string | null
  place: string | null
  description: string | null
  witnesses: string | null
  proposedAction: string | null
  status: string | null
}

export function ViolationEditDialog({ violation }: { violation: ViolationRow }) {
  const { t, dir } = useI18n()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    companyName: violation.companyName ?? "",
    employeeName: violation.employeeName ?? "",
    employeeNo: violation.employeeNo ?? "",
    nationality: violation.nationality ?? "",
    violationType: violation.violationType ?? "",
    category: violation.category ?? "internal",
    entryMode: violation.entryMode ?? "electronic",
    detectedBy: violation.detectedBy ?? "",
    internalAction: violation.internalAction ?? "",
    violationDate: violation.violationDate ?? "",
    violationTime: violation.violationTime ?? "",
    place: violation.place ?? "",
    description: violation.description ?? "",
    witnesses: violation.witnesses ?? "",
    proposedAction: violation.proposedAction ?? "",
    status: violation.status ?? "open",
  })

  // نماذج ورقية ممسوحة إضافية تُرفع أثناء التعديل.
  const [manualDocs, setManualDocs] = useState<{ name: string; dataUrl: string }[]>([])

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

  function handleSave() {
    if (!form.employeeName.trim()) {
      toast({ title: t("violationForm.employeeNameRequired"), variant: "destructive" })
      return
    }
    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.append("id", String(violation.id))
        Object.entries(form).forEach(([k, v]) => fd.append(k, v))
        fd.append("manualDocs", JSON.stringify(manualDocs.map((d) => d.dataUrl)))
        await updateViolation(fd)
        toast({ title: t("violationForm.editSavedTitle"), description: t("violationForm.editSavedDesc") })
        setOpen(false)
        setManualDocs([])
      } catch (err) {
        toast({ title: t("violationForm.saveFailedTitle"), description: err instanceof Error ? err.message : t("violationForm.saveFailedDesc"), variant: "destructive" })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" aria-label={t("violationForm.editTrigger")}>
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl" dir={dir}>
        <DialogHeader>
          <DialogTitle>{t("violationForm.editTitle")}</DialogTitle>
        </DialogHeader>

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
            <div className="flex flex-col gap-2 pt-1">
              <label className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="size-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{t("violationForm.attachManualExtra")}</span>
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
          </div>

          <div className="flex flex-col gap-1">
            <Label>{t("violationForm.employeeName")} <span className="text-destructive">*</span></Label>
            <Input value={form.employeeName} onChange={e => setForm(f => ({ ...f, employeeName: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t("violationForm.employeeNo")}</Label>
            <Input value={form.employeeNo} onChange={e => setForm(f => ({ ...f, employeeNo: e.target.value }))} dir="ltr" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t("violationForm.nationality")}</Label>
            <Input value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} />
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
            <Input value={form.violationTime} onChange={e => setForm(f => ({ ...f, violationTime: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t("violationForm.violationType")}</Label>
            <Input value={form.violationType} onChange={e => setForm(f => ({ ...f, violationType: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t("violationForm.category")}</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as ViolationCategory }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categoryOptions.map(o => <SelectItem key={o.value} value={o.value}>{categoryOptionLabel(t, o.value)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t("violationForm.internalAction")}</Label>
            <Input value={form.internalAction} onChange={e => setForm(f => ({ ...f, internalAction: e.target.value }))} />
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
          <div className="flex flex-col gap-1">
            <Label>{t("violationForm.place")}</Label>
            <Input value={form.place} onChange={e => setForm(f => ({ ...f, place: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t("violationForm.detectedBy")}</Label>
            <Input value={form.detectedBy} onChange={e => setForm(f => ({ ...f, detectedBy: e.target.value }))} placeholder={t("violationForm.detectedByShort")} />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label>{t("violationForm.description")}</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
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

        <div className="flex justify-between mt-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("violationForm.cancel")}</Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? t("violationForm.saving") : t("violationForm.saveEdits")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
