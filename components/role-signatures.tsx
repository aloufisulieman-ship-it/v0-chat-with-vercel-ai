"use client"

import { useState, useTransition } from "react"
import { Trash2, PenLine, CheckCircle2 } from "lucide-react"
import { SignaturePad } from "@/components/signature-pad"
import { fileUrl } from "@/components/attachments-manager"
import { uploadAttachment, deleteAttachment, type AttachmentRow } from "@/app/actions/attachments"
import { type SignatureRole, roleKindFor } from "@/lib/signature-roles"
import { toast } from "@/hooks/use-toast"

export function RoleSignatures({
  module,
  recordId,
  roles,
  items,
  onChange,
}: {
  module: string
  recordId: number
  roles: SignatureRole[]
  items: AttachmentRow[]
  onChange: (next: AttachmentRow[]) => void
}) {
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function signatureFor(roleKey: string) {
    return items.find((i) => i.kind === roleKindFor(roleKey))
  }

  async function handleSave(roleKey: string, file: File) {
    setSavingKey(roleKey)
    try {
      const fd = new FormData()
      fd.set("module", module)
      fd.set("recordId", String(recordId))
      fd.set("kind", roleKindFor(roleKey))
      fd.set("file", file)
      const row = (await uploadAttachment(fd)) as AttachmentRow
      onChange([...items, row])
      toast({ title: "تم حفظ التوقيع" })
    } catch (err) {
      toast({
        title: "تعذّر حفظ التوقيع",
        description: err instanceof Error ? err.message : "حدث خطأ.",
        variant: "destructive",
      })
    } finally {
      setSavingKey(null)
    }
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      try {
        await deleteAttachment(id)
        onChange(items.filter((i) => i.id !== id))
        toast({ title: "تم حذف التوقيع" })
      } catch {
        toast({ title: "تعذّر الحذف", variant: "destructive" })
      }
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <PenLine className="size-4 text-muted-foreground" />
        التواقيع الرسمية
      </h4>

      <div className="grid gap-4 sm:grid-cols-2">
        {roles.map((role) => {
          const sig = signatureFor(role.key)
          return (
            <div key={role.key} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  {sig && <CheckCircle2 className="size-3.5 text-primary" />}
                  {role.label}
                </span>
                {sig && (
                  <button
                    type="button"
                    onClick={() => handleDelete(sig.id)}
                    disabled={isPending}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`حذف ${role.label}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>

              {sig ? (
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
                <SignaturePad onSave={(file) => handleSave(role.key, file)} saving={savingKey === role.key} />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
