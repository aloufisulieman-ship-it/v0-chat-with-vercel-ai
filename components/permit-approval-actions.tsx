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
import { useI18n } from "@/lib/i18n/client"

export function PermitApprovalActions({
  permitId,
  approverName,
}: {
  permitId: number
  approverName: string
}) {
  const { t, dir } = useI18n()
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
      toast({ title: t("permitApproval.reasonRequired"), variant: "destructive" })
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
          title: mode === "approve" ? t("permitApproval.approvedTitle") : t("permitApproval.rejectedTitle"),
          description: mode === "approve" ? t("permitApproval.approvedDesc") : t("permitApproval.rejectedDesc"),
        })
        close()
      } catch (err) {
        toast({
          title: t("permitApproval.actionFailedTitle"),
          description: err instanceof Error ? err.message : t("permitApproval.actionFailedDesc"),
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
          aria-label={t("permitApproval.approve")}
        >
          <CheckCircle className="size-3.5" />
          {t("permitApproval.approve")}
        </button>
        <button
          onClick={() => setMode("reject")}
          className="flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
          aria-label={t("permitApproval.reject")}
        >
          <XCircle className="size-3.5" />
          {t("permitApproval.reject")}
        </button>
      </div>

      <Dialog open={mode !== null} onOpenChange={(o) => (o ? null : close())}>
        <DialogContent dir={dir}>
          <DialogHeader>
            <DialogTitle>{mode === "approve" ? t("permitApproval.approveTitle") : t("permitApproval.rejectTitle")}</DialogTitle>
            <DialogDescription>
              {mode === "approve" ? t("permitApproval.approveDesc") : t("permitApproval.rejectDesc")}
            </DialogDescription>
          </DialogHeader>

          {mode === "approve" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signature">{t("permitApproval.managerSignature")}</Label>
                <Input
                  id="signature"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder={approverName}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notes">{t("permitApproval.noteOptional")}</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("permitApproval.notePlaceholder")}
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reason">{t("permitApproval.reasonLabel")}</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("permitApproval.reasonPlaceholder")}
                rows={4}
                required
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={isPending}>
              {t("permitApproval.cancel")}
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
              {mode === "approve" ? t("permitApproval.confirmApprove") : t("permitApproval.confirmReject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
