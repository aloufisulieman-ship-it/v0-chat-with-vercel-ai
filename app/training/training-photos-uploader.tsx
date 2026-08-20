"use client"

import { useRef, useState } from "react"
import { Camera, ImagePlus, X, Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { compressImage } from "@/lib/image-compress"
import { useI18n } from "@/lib/i18n/client"

// Course-wide photo uploader: supports camera capture and file selection,
// compresses each image, and shows deletable thumbnails. Stores base64 strings.
export function TrainingPhotosUploader({
  photos,
  onChange,
}: {
  photos: string[]
  onChange: (next: string[]) => void
}) {
  const { t } = useI18n()
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      const added: string[] = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue
        added.push(await compressImage(file))
      }
      if (added.length) onChange([...photos, ...added])
    } finally {
      setBusy(false)
      if (cameraRef.current) cameraRef.current.value = ""
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  function removeAt(index: number) {
    onChange(photos.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">{t("trainingExtras.coursePhotos")}</Label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}{" "}
          {t("trainingExtras.capturePhoto")}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
        >
          <ImagePlus className="size-4" /> {t("trainingExtras.uploadFromDevice")}
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p || "/placeholder.svg"}
                alt={t("trainingExtras.coursePhotoAlt").replace("{n}", String(i + 1))}
                className="h-20 w-20 rounded-md border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow"
                aria-label={t("trainingExtras.deletePhoto")}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
