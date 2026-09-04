"use client"

import { useState } from "react"
import { FileDown, Loader2 } from "lucide-react"

// زر «تقرير جاهزية التدقيق»: يفتح نافذة مستقلة بمحتوى HTML جاهز (RTL) ثم window.print()
// ليحفظه المستخدم كـ PDF — نفس نمط الطباعة المستخدم في تفاصيل السجلات.
export function GapAnalysisExport({
  html,
  fileName,
  label,
}: {
  html: string
  fileName: string
  label: string
}) {
  const [busy, setBusy] = useState(false)

  function handleExport() {
    setBusy(true)
    try {
      const w = window.open("", "_blank", "width=900,height=1200")
      if (!w) return
      w.document.open()
      w.document.write(
        `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${fileName}</title>` +
          `<style>@page{size:A4;margin:14mm} body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}</style></head><body>` +
          html +
          `</body></html>`,
      )
      w.document.close()
      w.focus()
      setTimeout(() => w.print(), 400)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
      {label}
    </button>
  )
}
