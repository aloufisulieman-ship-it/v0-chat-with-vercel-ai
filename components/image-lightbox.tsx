"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/client"

export type LightboxImage = { url: string; label?: string }

const ZOOM_MIN = 1
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

// Hook مشترك لإدارة حالة المعاينة: يستقبل مصفوفة الصور وفهرس البداية عند النقر،
// ويعيد props جاهزة للتمرير إلى <ImageLightbox/>. يُعاد استخدامه في كل الأسطح
// (المرفقات، كتل إغلاق HR/المالية، بطاقات الإجراء) دون تكرار منطق الفتح/الإغلاق.
export function useLightbox() {
  const [state, setState] = useState<{ images: LightboxImage[]; index: number; open: boolean }>({
    images: [],
    index: 0,
    open: false,
  })
  const openLightbox = useCallback((images: LightboxImage[], index = 0) => {
    if (!images.length) return
    setState({ images, index: Math.max(0, Math.min(index, images.length - 1)), open: true })
  }, [])
  const onOpenChange = useCallback((open: boolean) => setState((s) => ({ ...s, open })), [])
  return {
    openLightbox,
    lightboxProps: { images: state.images, initialIndex: state.index, open: state.open, onOpenChange },
  }
}

function filenameFor(img: LightboxImage, index: number) {
  if (img.url.startsWith("data:")) return `${img.label || "image"}-${index + 1}.png`
  try {
    const u = new URL(img.url, window.location.origin)
    const p = u.searchParams.get("pathname") || u.pathname
    const base = p.split("/").pop() || `image-${index + 1}`
    return decodeURIComponent(base)
  } catch {
    return img.label || `image-${index + 1}`
  }
}

export function ImageLightbox({
  images,
  initialIndex,
  open,
  onOpenChange,
}: {
  images: LightboxImage[]
  initialIndex: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t, dir, formatNumber } = useI18n()
  const [index, setIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const count = images.length
  const current = images[index]

  // إعادة الضبط عند تغيّر الصورة أو فتح النافذة حتى تبدأ كل صورة بحجم/زاوية طبيعية.
  const resetView = useCallback(() => {
    setZoom(1)
    setRotation(0)
    setPan({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    if (open) {
      setIndex(initialIndex)
      resetView()
    }
  }, [open, initialIndex, resetView])

  const go = useCallback(
    (delta: number) => {
      if (count <= 1) return
      setIndex((i) => (i + delta + count) % count)
      resetView()
    },
    [count, resetView],
  )

  // اختصارات لوحة المفاتيح مع مراعاة RTL: السهم الأيمن = الصورة السابقة، الأيسر = التالية.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        e.preventDefault()
        go(dir === "rtl" ? -1 : 1)
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        go(dir === "rtl" ? 1 : -1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, dir, go])

  function zoomBy(delta: number) {
    setZoom((z) => {
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100))
      if (next === 1) setPan({ x: 0, y: 0 })
      return next
    })
  }

  async function handleDownload() {
    if (!current) return
    const name = filenameFor(current, index)
    try {
      const res = await fetch(current.url)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      window.open(current.url, "_blank", "noopener,noreferrer")
    }
  }

  // السحب للتحريك (pan) يعمل فقط عند التكبير.
  function onPointerDown(e: React.PointerEvent) {
    if (zoom <= 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, ox: pan.x, oy: pan.y }
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return
    setPan({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) })
  }
  function onPointerUp(e: React.PointerEvent) {
    dragRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const multiple = count > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir={dir}
        showCloseButton={false}
        className="flex h-[95vh] max-h-[95vh] w-[95vw] max-w-[95vw] flex-col gap-0 overflow-hidden border-none bg-black/90 p-0 text-white sm:max-w-[95vw]"
      >
        <DialogTitle className="sr-only">{current?.label || t("lightbox.image")}</DialogTitle>

        {/* الشريط العلوي: العدّاد والوصف + أدوات التحكم */}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-col">
            {multiple && (
              <span className="text-sm font-semibold tabular-nums text-white">
                {formatNumber(index + 1)} / {formatNumber(count)}
              </span>
            )}
            {current?.label && <span className="truncate text-xs text-white/70">{current.label}</span>}
          </div>
          <div className="flex items-center gap-1">
            <ToolButton label={t("lightbox.zoomOut")} onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN}>
              <ZoomOut className="size-5" />
            </ToolButton>
            <span className="w-12 text-center text-xs tabular-nums text-white/80">{formatNumber(Math.round(zoom * 100))}%</span>
            <ToolButton label={t("lightbox.zoomIn")} onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX}>
              <ZoomIn className="size-5" />
            </ToolButton>
            <ToolButton label={t("lightbox.rotate")} onClick={() => setRotation((r) => (r + 90) % 360)}>
              <RotateCw className="size-5" />
            </ToolButton>
            <ToolButton label={t("lightbox.download")} onClick={handleDownload}>
              <Download className="size-5" />
            </ToolButton>
            <ToolButton label={t("lightbox.close")} onClick={() => onOpenChange(false)}>
              <X className="size-5" />
            </ToolButton>
          </div>
        </div>

        {/* منطقة الصورة */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          {multiple && (
            <ToolButton
              label={t("lightbox.previous")}
              onClick={() => go(-1)}
              className="absolute start-2 top-1/2 z-10 -translate-y-1/2 bg-white/10 hover:bg-white/20"
            >
              {dir === "rtl" ? <ChevronRight className="size-6" /> : <ChevronLeft className="size-6" />}
            </ToolButton>
          )}

          {current && (
            <img
              // eslint-disable-next-line @next/next/no-img-element
              src={current.url || "/placeholder.svg"}
              alt={current.label || t("lightbox.image")}
              crossOrigin="anonymous"
              draggable={false}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onDoubleClick={() => (zoom > 1 ? resetView() : zoomBy(ZOOM_STEP * 4))}
              className={cn(
                "max-h-full max-w-full select-none object-contain transition-transform duration-150",
                zoom > 1 ? (dragRef.current ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
              )}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              }}
            />
          )}

          {multiple && (
            <ToolButton
              label={t("lightbox.next")}
              onClick={() => go(1)}
              className="absolute end-2 top-1/2 z-10 -translate-y-1/2 bg-white/10 hover:bg-white/20"
            >
              {dir === "rtl" ? <ChevronLeft className="size-6" /> : <ChevronRight className="size-6" />}
            </ToolButton>
          )}
        </div>

        {/* شريط الصور المصغّرة للتنقّل السريع */}
        {multiple && (
          <div className="flex items-center gap-2 overflow-x-auto px-4 py-3">
            {images.map((img, i) => (
              <button
                key={`${img.url}-${i}`}
                type="button"
                onClick={() => {
                  setIndex(i)
                  resetView()
                }}
                aria-label={`${t("lightbox.image")} ${formatNumber(i + 1)}`}
                aria-current={i === index}
                className={cn(
                  "size-14 shrink-0 overflow-hidden rounded-md border-2 transition-opacity",
                  i === index ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-80",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url || "/placeholder.svg"}
                  alt={img.label || `${t("lightbox.image")} ${i + 1}`}
                  crossOrigin="anonymous"
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ToolButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md text-white/90 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  )
}
