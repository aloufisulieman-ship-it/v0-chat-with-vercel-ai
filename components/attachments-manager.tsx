"use client"

import { useRef, useState, useTransition } from "react"
import { ImagePlus, Trash2, Loader2, PenLine, FileImage, FileText, Download, ZoomIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SignaturePad } from "@/components/signature-pad"
import { RoleSignatures } from "@/components/role-signatures"
import { ImageLightbox, useLightbox, type LightboxImage } from "@/components/image-lightbox"
import {
  uploadAttachment,
  deleteAttachment,
  type AttachmentRow,
} from "@/app/actions/attachments"
import { type SignatureRole } from "@/lib/signature-roles"
import { toast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n/client"

export function fileUrl(pathname: string) {
  return `/api/file?pathname=${encodeURIComponent(pathname)}`
}

export function AttachmentsManager({
  module,
  recordId,
  initial,
  signatureRoles,
  hideSignatures,
  readOnly = false,
}: {
  module: string
  recordId: number
  initial: AttachmentRow[]
  signatureRoles?: SignatureRole[]
  hideSignatures?: boolean
  // وضع القراءة فقط (السجل المؤرشف): عرض المرفقات دون رفع/حذف/توقيع.
  readOnly?: boolean
}) {
  const { t } = useI18n()
  const [items, setItems] = useState<AttachmentRow[]>(initial)
  const [isPending, startTransition] = useTransition()
  const [uploadingCount, setUploadingCount] = useState(0)
  const [savingSig, setSavingSig] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const photos = items.filter((i) => i.kind === "photo")
  const manualDocs = items.filter((i) => i.kind === "manual_form")
  const signatures = items.filter((i) => i.kind === "signature")
  const useRoles = !!signatureRoles && signatureRoles.length > 0

  // معاينة الصور (Lightbox): تُدمج صور "الصور المرفقة" وصور "النماذج الممسوحة" في
  // مصفوفة واحدة قابلة للتنقّل. ملفات PDF تُفتح في تبويب جديد ولا تدخل المعاينة.
  const { openLightbox, lightboxProps } = useLightbox()
  const galleryImages: LightboxImage[] = [
    ...photos.map((p) => ({ url: fileUrl(p.pathname), label: t("lightbox.sourcePhoto") })),
    ...manualDocs
      .filter((d) => d.contentType.startsWith("image/"))
      .map((d) => ({ url: fileUrl(d.pathname), label: d.filename || t("lightbox.sourceScan") })),
  ]
  const galleryIndexOf = (url: string) => galleryImages.findIndex((g) => g.url === url)

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
      toast({ title: t("attachments.unsupportedTitle"), description: t("attachments.unsupportedDesc"), variant: "destructive" })
      return
    }
    setUploadingCount(list.length)
    try {
      const uploaded: AttachmentRow[] = []
      for (const file of list) {
        uploaded.push(await uploadOne(file, "photo"))
      }
      setItems((prev) => [...prev, ...uploaded])
      toast({ title: t("attachments.photosUploadedTitle"), description: t("attachments.photosUploadedDesc").replace("{count}", String(uploaded.length)) })
    } catch (err) {
      toast({
        title: t("attachments.uploadFailedTitle"),
        description: err instanceof Error ? err.message : t("attachments.uploadFailedDesc"),
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
      toast({ title: t("attachments.sigSavedTitle") })
    } catch (err) {
      toast({
        title: t("attachments.sigSaveFailedTitle"),
        description: err instanceof Error ? err.message : t("attachments.sigSaveFailedDesc"),
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
        toast({ title: t("attachments.deletedTitle") })
      } catch {
        toast({ title: t("attachments.deleteFailedTitle"), variant: "destructive" })
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
            {t("attachments.photosHeading")}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {photos.length}
            </span>
          </h4>
          {!readOnly && (
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
            {uploadingCount > 0 ? t("attachments.uploadingCount").replace("{count}", String(uploadingCount)) : t("attachments.addPhotos")}
          </Button>
          )}
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
            {t("attachments.noPhotos")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <figure key={p.id} className="group relative overflow-hidden rounded-lg border border-border transition-colors hover:border-primary">
                <button
                  type="button"
                  onClick={() => openLightbox(galleryImages, galleryIndexOf(fileUrl(p.pathname)))}
                  className="block w-full cursor-pointer"
                  aria-label={t("recordDetails.viewDetails")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fileUrl(p.pathname) || "/placeholder.svg"}
                    alt={p.filename}
                    className="aspect-square w-full object-cover transition-opacity group-hover:opacity-80"
                    crossOrigin="anonymous"
                  />
                  <span className="pointer-events-none absolute bottom-1.5 end-1.5 flex size-6 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <ZoomIn className="size-3.5" />
                  </span>
                </button>
                {!readOnly && <button
                  type="button"
                  onClick={() => remove(p.id)}
                  disabled={isPending}
                  className="absolute left-1.5 top-1.5 rounded-md bg-destructive/90 p-1.5 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={t("attachments.deletePhoto")}
                >
                  <Trash2 className="size-3.5" />
                </button>}
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
            {t("attachments.manualDocHeading")}
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
                    <button
                      type="button"
                      onClick={() => openLightbox(galleryImages, galleryIndexOf(fileUrl(d.pathname)))}
                      className="group relative size-12 shrink-0 cursor-pointer overflow-hidden rounded border border-transparent transition-colors hover:border-primary"
                      aria-label={t("recordDetails.viewDetails")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={fileUrl(d.pathname) || "/placeholder.svg"}
                        alt={d.filename}
                        className="size-full object-cover transition-opacity group-hover:opacity-80"
                        crossOrigin="anonymous"
                      />
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <ZoomIn className="size-4 text-white" />
                      </span>
                    </button>
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
                    <Download className="size-3.5" /> {t("attachments.open")}
                  </a>
                  {!readOnly && <button
                    type="button"
                    onClick={() => remove(d.id)}
                    disabled={isPending}
                    className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                    aria-label={t("attachments.deleteFile")}
                  >
                    <Trash2 className="size-3.5" />
                  </button>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Role-named official signatures (violations, incidents, ...) */}
      {!hideSignatures && !readOnly && useRoles && (
        <RoleSignatures
          module={module}
          recordId={recordId}
          roles={signatureRoles!}
          items={items}
          onChange={setItems}
        />
      )}

      {/* Free-form signatures (modules without role config) */}
      {!hideSignatures && !readOnly && !useRoles && (
      <section className="flex flex-col gap-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <PenLine className="size-4 text-muted-foreground" />
          {t("attachments.signaturesHeading")}
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
                  alt={t("attachments.signatureAlt")}
                  className="h-24 w-full object-contain p-2"
                  crossOrigin="anonymous"
                />
                {!readOnly && <button
                  type="button"
                  onClick={() => remove(s.id)}
                  disabled={isPending}
                  className="absolute left-1.5 top-1.5 rounded-md bg-destructive/90 p-1.5 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={t("attachments.deleteSignature")}
                >
                  <Trash2 className="size-3.5" />
                </button>}
              </figure>
            ))}
          </div>
        )}

        <SignaturePad onSave={handleSignature} saving={savingSig} />
      </section>
      )}

      <ImageLightbox {...lightboxProps} />
    </div>
  )
}
