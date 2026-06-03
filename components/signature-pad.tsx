"use client"

import { useEffect, useRef, useState } from "react"
import { Eraser, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SignaturePad({
  onSave,
  saving = false,
}: {
  onSave: (file: File) => void | Promise<void>
  saving?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.lineWidth = 2.2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#0f172a"
  }, [])

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current!.getContext("2d")!
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext("2d")!
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasInk) setHasInk(true)
  }

  function end() {
    drawing.current = false
  }

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, rect.width, rect.height)
    setHasInk(false)
  }

  async function save() {
    const canvas = canvasRef.current
    if (!canvas || !hasInk) return
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"))
    if (!blob) return
    const file = new File([blob], `signature-${Date.now()}.png`, { type: "image/png" })
    await onSave(file)
    clear()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border bg-card p-2">
        <canvas
          ref={canvasRef}
          className="h-40 w-full touch-none rounded-md border border-dashed border-border bg-white"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          aria-label="منطقة التوقيع"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">وقّع داخل الإطار باستخدام الماوس أو إصبعك.</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={clear} className="gap-1.5 bg-transparent">
            <Eraser className="size-3.5" />
            مسح
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={!hasInk || saving} className="gap-1.5">
            <Check className="size-3.5" />
            {saving ? "جارٍ الحفظ..." : "حفظ التوقيع"}
          </Button>
        </div>
      </div>
    </div>
  )
}
