"use client"

import { useRef, useState, useTransition } from "react"
import { CheckCircle2, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n/client"
import { completeCorrectiveAction } from "@/app/actions/risk-lifecycle"

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("read error"))
    reader.readAsDataURL(file)
  })
}

export function CompleteActionDialog({ actionId }: { actionId: number }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [fileName, setFileName] = useState("")
  const fileRef = useRef<HTMLInputElement | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const implemented = String(fd.get("implementedControls") ?? "")
    const file = fileRef.current?.files?.[0]
    if (!file) {
      toast({ title: t("riskLifecycle.evidenceRequired"), variant: "destructive" })
      return
    }
    startTransition(async () => {
      try {
        const dataUrl = await fileToDataUrl(file)
        await completeCorrectiveAction({ actionId, implementedControls: implemented, evidenceDataUrl: dataUrl })
        toast({ title: t("riskLifecycle.completed") })
        setOpen(false)
        setFileName("")
      } catch (err) {
        toast({
          title: t("riskLifecycle.actionFailed"),
          description: err instanceof Error ? err.message : "",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-transparent">
          <CheckCircle2 className="size-3.5" />
          {t("riskLifecycle.complete")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("riskLifecycle.completeTitle")}</DialogTitle>
          <DialogDescription>{t("riskLifecycle.completeDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="implementedControls">
              {t("risksMod.controlsImplemented")} <span className="text-destructive">*</span>
            </Label>
            <Textarea id="implementedControls" name="implementedControls" rows={3} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="evidence">
              {t("riskLifecycle.evidenceLabel")} <span className="text-destructive">*</span>
            </Label>
            <label
              htmlFor="evidence"
              className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted/40"
            >
              <Paperclip className="size-4" />
              {fileName || t("riskLifecycle.evidenceHint")}
            </label>
            <input
              id="evidence"
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("recordDialog.saving") : t("riskLifecycle.confirmComplete")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
