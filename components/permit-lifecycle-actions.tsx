"use client"

import { useState, useTransition } from "react"
import { MoreVertical, Check, X, Clock3, PauseCircle, PlayCircle, Archive, Printer, Mail, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { toast } from "@/hooks/use-toast"
import { InlineSignatureField } from "@/components/inline-signature-field"
import { normalizePermitStatus } from "@/lib/permit-workflow"
import { useI18n } from "@/lib/i18n/client"
import {
  approvePermit,
  rejectPermit,
  closePermit,
  extendPermit,
  suspendPermit,
  resumePermit,
  archivePermit,
} from "@/app/actions/permit-workflow"

type Dlg = null | "approve" | "reject" | "close" | "extend" | "suspend"

export function PermitLifecycleActions({
  permitId,
  documentNo,
  status,
  isManager,
  onPrint,
}: {
  permitId: number
  documentNo: string
  status: string
  isManager: boolean
  onPrint: () => void
}) {
  const { t } = useI18n()
  const [dlg, setDlg] = useState<Dlg>(null)
  const [isPending, startTransition] = useTransition()

  // حقول الحوارات.
  const [approveSig, setApproveSig] = useState("")
  const [signerName, setSignerName] = useState("")
  const [reason, setReason] = useState("")
  const [issuerSig, setIssuerSig] = useState("")
  const [issuerName, setIssuerName] = useState("")
  const [receiverSig, setReceiverSig] = useState("")
  const [receiverName, setReceiverName] = useState("")
  const [siteCondition, setSiteCondition] = useState("")
  const [extendedTo, setExtendedTo] = useState("")

  const st = normalizePermitStatus(status)

  function run(fn: (fd: FormData) => Promise<void>, fd: FormData, successKey: string) {
    startTransition(async () => {
      try {
        await fn(fd)
        toast({ title: t(successKey) })
        setDlg(null)
        resetFields()
      } catch (err) {
        toast({ title: t("permitLifecycle.failed"), description: err instanceof Error ? err.message : "", variant: "destructive" })
      }
    })
  }
  function resetFields() {
    setApproveSig("")
    setSignerName("")
    setReason("")
    setIssuerSig("")
    setIssuerName("")
    setReceiverSig("")
    setReceiverName("")
    setSiteCondition("")
    setExtendedTo("")
  }

  const emailHref = `mailto:?subject=${encodeURIComponent(`${t("permitLifecycle.emailSubject")} ${documentNo}`)}`

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={t("permitLifecycle.menu")}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {isManager && st === "pending" && (
            <>
              <DropdownMenuItem onClick={() => setDlg("approve")} className="gap-2">
                <Check className="size-4 text-success" />
                {t("permitLifecycle.approve")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDlg("reject")} className="gap-2">
                <X className="size-4 text-destructive" />
                {t("permitLifecycle.reject")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {isManager && st === "active" && (
            <>
              <DropdownMenuItem onClick={() => setDlg("extend")} className="gap-2">
                <Clock3 className="size-4 text-primary" />
                {t("permitLifecycle.extend")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDlg("suspend")} className="gap-2">
                <PauseCircle className="size-4 text-accent" />
                {t("permitLifecycle.suspend")}
              </DropdownMenuItem>
            </>
          )}
          {isManager && st === "suspended" && (
            <DropdownMenuItem
              onClick={() => {
                const fd = new FormData()
                fd.set("permitId", String(permitId))
                run(resumePermit, fd, "permitLifecycle.resumed")
              }}
              className="gap-2"
            >
              <PlayCircle className="size-4 text-success" />
              {t("permitLifecycle.resume")}
            </DropdownMenuItem>
          )}
          {(st === "active" || st === "suspended" || st === "expired") && (
            <DropdownMenuItem onClick={() => setDlg("close")} className="gap-2">
              <Lock className="size-4 text-muted-foreground" />
              {t("permitLifecycle.close")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onPrint} className="gap-2">
            <Printer className="size-4 text-muted-foreground" />
            {t("permitLifecycle.print")}
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="gap-2">
            <a href={emailHref}>
              <Mail className="size-4 text-muted-foreground" />
              {t("permitLifecycle.email")}
            </a>
          </DropdownMenuItem>
          {isManager && st !== "closed" && (
            <DropdownMenuItem
              onClick={() => {
                const fd = new FormData()
                fd.set("permitId", String(permitId))
                run(archivePermit, fd, "permitLifecycle.archived")
              }}
              className="gap-2"
            >
              <Archive className="size-4 text-muted-foreground" />
              {t("permitLifecycle.archive")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* اعتماد */}
      <Dialog open={dlg === "approve"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("permitLifecycle.approveTitle")}</DialogTitle>
            <DialogDescription>{documentNo}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ap-name">{t("permitLifecycle.signerName")}</Label>
              <Input id="ap-name" value={signerName} onChange={(e) => setSignerName(e.target.value)} />
            </div>
            <InlineSignatureField label={t("permitLifecycle.approverSignature")} required onChange={setApproveSig} />
          </div>
          <DialogFooter>
            <Button
              disabled={isPending || !approveSig}
              onClick={() => {
                const fd = new FormData()
                fd.set("permitId", String(permitId))
                fd.set("role", "approver")
                fd.set("signerName", signerName)
                fd.set("signature", approveSig)
                run(approvePermit, fd, "permitLifecycle.approved")
              }}
            >
              {t("permitLifecycle.confirmApprove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* رفض */}
      <Dialog open={dlg === "reject"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("permitLifecycle.rejectTitle")}</DialogTitle>
            <DialogDescription>{documentNo}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rj-reason">
              {t("permitLifecycle.reason")}
              <span className="text-destructive"> *</span>
            </Label>
            <Textarea id="rj-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={isPending || !reason.trim()}
              onClick={() => {
                const fd = new FormData()
                fd.set("permitId", String(permitId))
                fd.set("reason", reason)
                run(rejectPermit, fd, "permitLifecycle.rejected")
              }}
            >
              {t("permitLifecycle.confirmReject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* إغلاق */}
      <Dialog open={dlg === "close"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("permitLifecycle.closeTitle")}</DialogTitle>
            <DialogDescription>{t("permitLifecycle.closeDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cl-site">{t("permitLifecycle.siteCondition")}</Label>
              <Textarea id="cl-site" rows={2} value={siteCondition} onChange={(e) => setSiteCondition(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cl-iname">{t("permitLifecycle.issuerName")}</Label>
                <Input id="cl-iname" value={issuerName} onChange={(e) => setIssuerName(e.target.value)} />
                <InlineSignatureField label={t("permitLifecycle.issuerSignature")} required onChange={setIssuerSig} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cl-rname">{t("permitLifecycle.receiverName")}</Label>
                <Input id="cl-rname" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
                <InlineSignatureField label={t("permitLifecycle.receiverSignature")} required onChange={setReceiverSig} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={isPending || !issuerSig || !receiverSig}
              onClick={() => {
                const fd = new FormData()
                fd.set("permitId", String(permitId))
                fd.set("issuerName", issuerName)
                fd.set("issuerSignature", issuerSig)
                fd.set("receiverName", receiverName)
                fd.set("receiverSignature", receiverSig)
                fd.set("siteConditionAfter", siteCondition)
                run(closePermit, fd, "permitLifecycle.closed")
              }}
            >
              {t("permitLifecycle.confirmClose")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تمديد */}
      <Dialog open={dlg === "extend"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("permitLifecycle.extendTitle")}</DialogTitle>
            <DialogDescription>{documentNo}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ex-to">{t("permitLifecycle.newEnd")}</Label>
            <Input id="ex-to" type="datetime-local" dir="ltr" value={extendedTo} onChange={(e) => setExtendedTo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button
              disabled={isPending || !extendedTo}
              onClick={() => {
                const fd = new FormData()
                fd.set("permitId", String(permitId))
                fd.set("extendedTo", extendedTo)
                run(extendPermit, fd, "permitLifecycle.extended")
              }}
            >
              {t("permitLifecycle.confirmExtend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* إيقاف مؤقت */}
      <Dialog open={dlg === "suspend"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("permitLifecycle.suspendTitle")}</DialogTitle>
            <DialogDescription>{documentNo}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sp-reason">
              {t("permitLifecycle.reason")}
              <span className="text-destructive"> *</span>
            </Label>
            <Textarea id="sp-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button
              disabled={isPending || !reason.trim()}
              onClick={() => {
                const fd = new FormData()
                fd.set("permitId", String(permitId))
                fd.set("reason", reason)
                run(suspendPermit, fd, "permitLifecycle.suspended")
              }}
            >
              {t("permitLifecycle.confirmSuspend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
