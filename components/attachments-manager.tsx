"use client"

import { useRef, useState, useTransition } from "react"
import { ImagePlus, Trash2, Loader2, PenLine, FileImage, FileText, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SignaturePad } from "@/components/signature-pad"
import { RoleSignatures } from "@/components/role-signatures"
import {
  uploadAttachment,
  deleteAttachment,
  type AttachmentRow,
} from "@/app/actions/attachments"
import { type SignatureRole } from "@/lib/signature-roles"
import { toast } from "@/hooks/use-toast"

export function fileUrl(pathname: string) {
  return `/api/file?pathname=${encodeURIComponent(pathname)}`
}

export function AttachmentsManager({
  module,
  recordId,
  initial,
  signatureRoles,
  hideSignatures,
}: {
  module: string
  recordId: number
  initial: AttachmentRow[]
  signatureRoles?: SignatureRole[]
  hideSignatures?: boolean
}) {
  const [items, setItems] = useState<AttachmentRow[]>(initial)
  const [isPending, startTransition] = useTransition()
  const [uploadingCount, setUploadingCount] = useState(0)
  const [savingSig, setSavingSig] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const photos = items.filter((i) => i.kind === "photo")
  const manualDocs = items.filter((i) => i.kind === "manual_form")
  const signatures = items.filter((i) => i.kind === "signature")
  const useRoles = !!signatureRoles && signatureRoles.length > 0

  async function uploadOne(file: File, kind: "photo" | "signature") {
    const fd = new FormData()
    fd.set("module", module)
    fd.set("recordId", String(recordId))
    fd.set("kind", kind)
    fd.set("file", file)
    const row = await uploadAttachment(fd)
    return row as AttachmentRow
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"))
    if (list.length === 0) {
      toast({ title: "ملفات غير مدعومة", description: "يُسمح برفع الصور فقط.", variant: "destructive" })
      return
    }
    setUploadingCount(list.length)
    try {
      const uploaded: AttachmentRow[] = []
      for (const file of list) {
        uploaded.push(await uploadOne(file, "photo"))
      }
      setItems((prev) => [...prev, ...uploaded])
      toast({ title: "تم رفع الصور", description: `تم رفع ${uploaded.length} صورة بنجاح.` })
    } catch (err) {
      toast({
        title: "تعذّر الرفع",
        description: err instanceof Error ? err.message : "حدث خطأ أثناء الرفع.",
        variant: "destructive",
      })
    } finally {
      setUploadingCount(0)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleSignature(file: File) {
    setSavingSig(true)
    try {
      const row = await uploadOne(file, "signature")
      setItems((prev) => [...prev, row])
      toast({ title: "تم حفظ التوقيع" })
    } catch (err) {
      toast({
        title: "تعذّر حفظ التوقيع",
        description: err instanceof Error ? err.message : "حدث خطأ.",
        variant: "destructive",
      })
    } finally {
      setSavingSig(false)
    }
  }

  function remove(id: number) {
    startTransition(async () => {
      try {
        await deleteAttachment(id)
        setItems((prev) => prev.filter((i) => i.id !== id))
        toast({ title: "تم الحذف" })
      } catch {
        toast({ title: "تعذّر الحذف", variant: "destructive" })
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Photos */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileImage className="size-4 text-muted-foreground" />
            الصور المرفقة
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {photos.length}
            </span>
          </h4>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 bg-transparent"
            onClick={() => inputRef.current?.click()}
            disabled={uploadingCount > 0}
          >
            {uploadingCount > 0 ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ImagePlus className="size-3.5" />
            )}
            {uploadingCount > 0 ? `جارٍ رفع ${uploadingCount}...` : "إضافة صور"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {photos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-xs text-muted-foreground">
            لا توجد صور. يمكنك رفع عدد غير محدود من الصور.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <figure key={p.id} className="group relative overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl(p.pathname) || "/placeholder.svg"}
                  alt={p.filename}
                  className="aspect-square w-full object-cover"
                  crossOrigin="anonymous"
                />
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  disabled={isPending}
                  className="absolute left-1.5 top-1.5 rounded-md bg-destructive/90 p-1.5 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="حذف الصورة"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </figure>
            ))}
          </div>
        )}
      </section>

      {/* النماذج الورقية الممسوحة للمخالفات اليدوية (PDF/صور/مستندات) */}
      {manualDocs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="size-4 text-muted-foreground" />
            النموذج الورقي (يدوي)
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {manualDocs.length}
            </span>
          </h4>
          <ul className="flex flex-col gap-2">
            {manualDocs.map((d) => {
              const isImage = d.contentType.startsWith("image/")
              return (
                <li key={d.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fileUrl(d.pathname) || "/placeholder.svg"}
                      alt={d.filename}
                      className="size-12 shrink-0 rounded object-cover"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded bg-muted">
                      <FileText className="size-5 text-muted-foreground" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{d.filename}</span>
                  <a
                    href={fileUrl(d.pathname)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <Download className="size-3.5" /> فتح
                  </a>
                  <button
                    type="button"
                    onClick={() => remove(d.id)}
                    disabled={isPending}
                    className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                    aria-label="حذف الملف"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Role-named official signatures (violations, incidents, ...) */}
      {!hideSignatures && useRoles && (
        <RoleSignatures
          module={module}
          recordId={recordId}
          roles={signatureRoles!}
          items={items}
          onChange={setItems}
        />
      )}

      {/* Free-form signatures (modules without role config) */}
      {!hideSignatures && !useRoles && (
      <section className="flex flex-col gap-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <PenLine className="size-4 text-muted-foreground" />
          التواقيع
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {signatures.length}
          </span>
        </h4>

        {signatures.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {signatures.map((s) => (
              <figure key={s.id} className="group relative overflow-hidden rounded-lg border border-border bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl(s.pathname) || "/placeholder.svg"}
                  alt="توقيع"
                  className="h-24 w-full object-contain p-2"
                  crossOrigin="anonymous"
                />
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  disabled={isPending}
                  className="absolute left-1.5 top-1.5 rounded-md bg-destructive/90 p-1.5 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="حذف التوقيع"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </figure>
            ))}
          </div>
        )}

        <SignaturePad onSave={handleSignature} saving={savingSig} />
      </section>
      )}
    </div>
  )
}
