"use client"

import { useEffect, useState, useTransition } from "react"
import { AlertCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useI18n } from "@/lib/i18n/client"
import { PermitDetailView } from "@/components/permit-detail-view"
import { getPermitById, type PermitDetail } from "@/app/actions/permit-workflow"

// نافذة عرض تفاصيل التصريح: تجلب البيانات عند الفتح فقط مع حالة تحميل/خطأ.
export function PermitViewDialog({
  permitId,
  open,
  onOpenChange,
  isManager,
}: {
  permitId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isManager: boolean
}) {
  const { t, dir } = useI18n()
  const [data, setData] = useState<PermitDetail | null>(null)
  const [error, setError] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open || permitId == null) return
    setData(null)
    setError(false)
    startTransition(async () => {
      try {
        const res = await getPermitById(permitId)
        if (res) setData(res)
        else setError(true)
      } catch {
        setError(true)
      }
    })
  }, [open, permitId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={dir} className="max-h-[92svh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("permitDetail.title")}</DialogTitle>
        </DialogHeader>
        {isPending || (!data && !error) ? (
          <PermitDetailSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertCircle className="size-10 text-destructive" />
            <p className="text-sm text-muted-foreground">{t("permitDetail.loadError")}</p>
          </div>
        ) : data ? (
          <PermitDetailView permit={data} isManager={isManager} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function PermitDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
    </div>
  )
}
