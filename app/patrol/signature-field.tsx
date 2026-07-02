"use client"

import { useEffect, useRef } from "react"
import SignatureCanvas from "react-signature-canvas"
import { X, PenLine } from "lucide-react"

// حقل توقيع رقمي مبني على react-signature-canvas.
// يُستورد ديناميكياً (ssr:false) من patrol-client لأن المكتبة تعتمد على DOM.
// يتواصل مع الأب عبر value/onChange (base64) فقط، فلا حاجة لتمرير ref عبر الحدود.
export default function SignatureField({
  label,
  value,
  onChange,
  disabled,
  disabledText,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  disabledText?: string
}) {
  const padRef = useRef<SignatureCanvas>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // ضبط أبعاد الـ canvas الفعلية لتطابق حجم العرض (مع مراعاة كثافة البكسل)
  // حتى تكون إحداثيات الرسم دقيقة ولا ينزاح القلم عن مكان اللمس.
  useEffect(() => {
    const pad = padRef.current
    const wrap = wrapRef.current
    if (!pad || !wrap) return
    const canvas = pad.getCanvas()
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const prev = pad.isEmpty() ? null : pad.toDataURL()
      canvas.width = wrap.clientWidth * ratio
      canvas.height = wrap.clientHeight * ratio
      canvas.getContext("2d")?.scale(ratio, ratio)
      pad.clear()
      if (prev) pad.fromDataURL(prev)
    }
    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [])

  // مزامنة المسح الخارجي: إذا أفرغ الأب القيمة (زر مسح أو رفض التوقيع) نُفرغ اللوحة.
  useEffect(() => {
    if (!value && padRef.current && !padRef.current.isEmpty()) {
      padRef.current.clear()
    }
  }, [value])

  function handleEnd() {
    if (disabled || !padRef.current) return
    onChange(padRef.current.isEmpty() ? "" : padRef.current.toDataURL())
  }
  function clear() {
    padRef.current?.clear()
    onChange("")
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-600">{label}</label>
        {!disabled && (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
          >
            <X className="size-3" /> مسح
          </button>
        )}
      </div>
      <div
        ref={wrapRef}
        className="relative h-[160px] w-full rounded-md border border-gray-300 bg-white"
        style={{ opacity: disabled ? 0.55 : 1 }}
      >
        <SignatureCanvas
          ref={padRef}
          penColor="#1a1a2e"
          clearOnResize={false}
          onEnd={handleEnd}
          canvasProps={{
            width: 600,
            height: 200,
            className: `h-full w-full rounded-md bg-white touch-none ${disabled ? "pointer-events-none" : "cursor-crosshair"}`,
          }}
        />
        {(!value || disabled) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {disabled ? (
              <span className="text-xs text-gray-400">{disabledText || "معطّل"}</span>
            ) : (
              !value && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <PenLine className="size-3" /> وقّع هنا
                </span>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
