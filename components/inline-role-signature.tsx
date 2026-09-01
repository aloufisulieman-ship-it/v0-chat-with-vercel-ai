"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Trash2, PenLine, CheckCircle2 } from "lucide-react"
import { SignaturePad } from "@/components/signature-pad"
import { fileUrl } from "@/components/attachments-manager"
import {
  uploadAttachment,
  deleteAttachment,
  getRecordRoleSignature,
  type AttachmentRow,
} from "@/app/actions/attachments"
import { roleKindFor, type SignatureRole } from "@/lib/signature-roles"
import { toast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n/client"

// مربع توقيع مضمَّن داخل بطاقة المعالجة (HR/المالية). يعرض التوقيع المحفوظ إن وُجد،
// وإلا يعرض لوحة توقيع بالماوس/اللمس. يبلّغ الأب بحالة التوقيع عبر onChange ليُربط
// بها زر الإغلاق. النطاق (module) يفرّق بين المخالفات والحوادث لنفس الدور.
export function InlineRoleSignature({
  module,
  recordId,
  role,
  required = false,
  disabled = false,
  onChange,
}: {
  module: string
  recordId: number
  role: SignatureRole
  required?: boolean
  disabled?: boolean
  onChange?: (signed: boolean) => void
}) {
  const { t } = useI18n()
  const [sig, setSig] = useState<{ id: number; pathname: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isPending, startTransition] = useTransition()
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    let active = true
    setLoading(true)
    getRecordRoleSignature(module, recordId, role.key)
      .then((row) => {
        if (!active) return
        setSig(row)
        onChangeRef.current?.(!!row)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [module, recordId, role.key])

  async function handleSave(file: File) {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.set("module", module)
      fd.set("recordId", String(recordId))
      fd.set("kind", roleKindFor(role.key))
      fd.set("file", file)
      const row = (await uploadAttachment(fd)) as AttachmentRow
      setSig({ id: row.id, pathname: row.pathname })
      onChangeRef.current?.(true)
      toast({ title: t("signaturePad.saved") })
    } catch (err) {
      toast({
        title: t("signaturePad.saveFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  function handleDelete() {
    if (!sig) return
    startTransition(async () => {
      try {
        await deleteAttachment(sig.id)
        setSig(null)
        onChangeRef.current?.(false)
        toast({ title: t("signaturePad.deleted") })
      } catch {
        toast({ title: t("signaturePad.deleteFailed"), variant: "destructive" })
      }
    })
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <PenLine className="size-4 text-muted-foreground" />
          {sig && <CheckCircle2 className="size-3.5 text-primary" />}
          {role.label}
          {required && !sig && <span className="text-destructive">*</span>}
        </span>
        {sig && !disabled && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label={`${t("signaturePad.delete")} ${role.label}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-24 w-full animate-pulse rounded-md border border-dashed border-border bg-muted/40" />
      ) : sig ? (
        <div className="overflow-hidden rounded-md border border-border bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl(sig.pathname) || "/placeholder.svg"}
            alt={role.label}
            className="h-24 w-full object-contain p-2"
            crossOrigin="anonymous"
          />
        </div>
      ) : (
        <SignaturePad onSave={handleSave} saving={saving} />
      )}
    </section>
  )
}
