"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRightLeft, CheckCircle2, MoreHorizontal, Play, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { startProcessing } from "@/app/actions/lifecycle"
import {
  canTransition,
  classificationLabel,
  deptForClassification,
  lifecycleUi,
  normalizeLifecycle,
  type Dept,
  type LifecycleModule,
} from "@/lib/lifecycle"
import { CloseDialog, ReferDialog, ReopenDialog } from "./lifecycle-dialogs"

type L = "ar" | "en"

// قائمة إجراءات دورة الحياة لصف واحد: إحالة / بدء المعالجة / إغلاق / إعادة فتح (admin).
// تعرض فقط الانتقالات المسموحة من الحالة الحالية. عند الأرشفة تظهر "إعادة فتح" للمدير فقط.
export function LifecycleActions({
  module,
  recordId,
  status,
  assignedDept,
  classification,
  isAdmin,
  locale = "ar",
  onRequestEmail,
  // "menu" = زر ثلاث نقاط (جداول)، "buttons" = أزرار مباشرة (لوحات HR/المالية).
  variant = "menu",
}: {
  module: LifecycleModule
  recordId: number
  status: string | null | undefined
  assignedDept?: Dept | string | null
  // للحوادث: يقفل جهة الإحالة (داخلية→HR، خارجية→المالية). يُتجاهل للمخالفات.
  classification?: string | null
  isAdmin: boolean
  locale?: L
  onRequestEmail?: () => void
  variant?: "menu" | "buttons"
}) {
  const s = lifecycleUi(locale)
  const router = useRouter()
  const { toast } = useToast()
  const from = normalizeLifecycle(status)
  const [dlg, setDlg] = useState<"refer" | "close" | "reopen" | null>(null)
  const [busy, setBusy] = useState(false)

  const canRefer = canTransition(from, "referred")
  const canStart = canTransition(from, "in_progress")
  const canClose = canTransition(from, "closed")
  const canReopen = isAdmin && from === "archived"

  const lockedDept: Dept | null = module === "incidents" ? deptForClassification(classification) : null
  const lockedReason =
    module === "incidents"
      ? locale === "en"
        ? `${classificationLabel(classification, "en")} incident — routing is fixed to this department`
        : `حادثة ${classificationLabel(classification, "ar")} — جهة الإحالة ثابتة حسب التصنيف`
      : undefined

  async function start() {
    setBusy(true)
    try {
      await startProcessing(module, recordId)
      toast({ title: locale === "en" ? "Processing started" : "بدأت المعالجة" })
      router.refresh()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const items = [
    canRefer && { key: "refer", icon: ArrowRightLeft, label: s.refer, onClick: () => setDlg("refer") },
    canStart && { key: "start", icon: Play, label: s.startProcessing, onClick: start },
    canClose && { key: "close", icon: CheckCircle2, label: s.close, onClick: () => setDlg("close") },
    canReopen && { key: "reopen", icon: RotateCcw, label: s.reopen, onClick: () => setDlg("reopen") },
  ].filter(Boolean) as { key: string; icon: typeof Play; label: string; onClick: () => void }[]

  const dialogs = (
    <>
      <ReferDialog
        open={dlg === "refer"}
        onOpenChange={(v) => !v && setDlg(null)}
        module={module}
        recordId={recordId}
        locale={locale}
        defaultDept={(assignedDept as Dept) || null}
        lockedDept={lockedDept}
        lockedReason={lockedReason}
        onReferred={({ alsoEmail }) => alsoEmail && onRequestEmail?.()}
      />
      <CloseDialog
        open={dlg === "close"}
        onOpenChange={(v) => !v && setDlg(null)}
        module={module}
        recordId={recordId}
        locale={locale}
      />
      <ReopenDialog
        open={dlg === "reopen"}
        onOpenChange={(v) => !v && setDlg(null)}
        module={module}
        recordId={recordId}
        locale={locale}
      />
    </>
  )

  if (items.length === 0) return null

  if (variant === "buttons") {
    return (
      <>
        <div className="flex flex-wrap gap-2">
          {items.map((it) => (
            <Button
              key={it.key}
              size="sm"
              variant={it.key === "close" ? "default" : "outline"}
              className="gap-1.5"
              onClick={it.onClick}
              disabled={busy}
            >
              <it.icon className="size-3.5" />
              {it.label}
            </Button>
          ))}
        </div>
        {dialogs}
      </>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={locale === "en" ? "Lifecycle actions" : "إجراءات الحالة"}
            disabled={busy}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {items.map((it) => (
            <DropdownMenuItem key={it.key} onClick={it.onClick} className="gap-2">
              <it.icon className="size-4" />
              {it.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs}
    </>
  )
}
