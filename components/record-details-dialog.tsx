"use client"

import { useRef, useState } from "react"
import { Eye, Download, Mail, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AttachmentsManager, fileUrl } from "@/components/attachments-manager"
import { getAttachments, type AttachmentRow } from "@/app/actions/attachments"
import { downloadElementPdf } from "@/lib/pdf"
import { toast } from "@/hooks/use-toast"

export type DetailField = { label: string; value: string }

// Converts a same-origin image URL to a data URL so html2canvas can embed it reliably.
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export function RecordDetailsDialog({
  module,
  recordId,
  title,
  subtitle,
  documentNo,
  fields,
  initialAttachments,
}: {
  module: string
  recordId: number
  title: string
  subtitle?: string
  documentNo?: string
  fields: DetailField[]
  initialAttachments: AttachmentRow[]
}) {
  const [open, setOpen] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentRow[]>(initialAttachments)
  const [busy, setBusy] = useState<"pdf" | "email" | null>(null)
  const reportRef = useRef<HTMLDivElement | null>(null)

  // Refresh attachments when opening so PDF/email reflect the latest uploads.
  async function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      try {
        const fresh = await getAttachments(module, recordId)
        setAttachments(fresh)
      } catch {
        // keep current
      }
    }
  }

  // Builds an off-screen printable report with embedded (data-url) images.
  async function buildReportElement(): Promise<HTMLElement> {
    const photos = attachments.filter((a) => a.kind === "photo")
    const signatures = attachments.filter((a) => a.kind === "signature")

    const photoData = await Promise.all(photos.map((p) => toDataUrl(fileUrl(p.pathname))))
    const sigData = await Promise.all(signatures.map((s) => toDataUrl(fileUrl(s.pathname))))

    const container = document.createElement("div")
    container.dir = "rtl"
    container.style.cssText =
      "position:fixed;top:-10000px;right:0;width:794px;background:#ffffff;color:#0f172a;font-family:system-ui,'Segoe UI',Tahoma,sans-serif;padding:40px;box-sizing:border-box;"

    const rows = fields
      .filter((f) => f.value && f.value !== "-")
      .map(
        (f) => `
        <tr>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;width:35%;vertical-align:top;">${f.label}</td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;vertical-align:top;">${escapeHtml(f.value)}</td>
        </tr>`,
      )
      .join("")

    const photosHtml = photoData
      .filter(Boolean)
      .map(
        (d) =>
          `<img src="${d}" style="width:48%;margin:1%;border:1px solid #e2e8f0;border-radius:6px;object-fit:cover;" />`,
      )
      .join("")

    const sigHtml = sigData
      .filter(Boolean)
      .map(
        (d) =>
          `<div style="display:inline-block;width:46%;margin:1%;border:1px solid #e2e8f0;border-radius:6px;padding:8px;text-align:center;background:#fff;"><img src="${d}" style="max-height:90px;max-width:100%;" /></div>`,
      )
      .join("")

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #0f766e;padding-bottom:16px;margin-bottom:24px;">
        <div>
          <h1 style="margin:0;font-size:22px;color:#0f766e;">${escapeHtml(title)}</h1>
          ${subtitle ? `<p style="margin:6px 0 0;font-size:13px;color:#64748b;">${escapeHtml(subtitle)}</p>` : ""}
        </div>
        <div style="text-align:left;font-size:12px;color:#64748b;">
          ${documentNo ? `<div>رقم الوثيقة: <span style="font-family:monospace;">${escapeHtml(documentNo)}</span></div>` : ""}
          <div>تاريخ التصدير: ${new Date().toLocaleDateString("ar-EG")}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">${rows}</table>
      ${
        photosHtml
          ? `<h2 style="font-size:15px;color:#0f766e;margin:24px 0 8px;">الصور المرفقة (${photoData.filter(Boolean).length})</h2><div style="display:flex;flex-wrap:wrap;">${photosHtml}</div>`
          : ""
      }
      ${
        sigHtml
          ? `<h2 style="font-size:15px;color:#0f766e;margin:24px 0 8px;">التواقيع</h2><div>${sigHtml}</div>`
          : ""
      }
      <div style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:12px;font-size:11px;color:#94a3b8;text-align:center;">
        نظام إدارة الصحة والسلامة والبيئة (HSE) — تم إنشاء هذا التقرير إلكترونياً
      </div>
    `
    document.body.appendChild(container)
    return container
  }

  const fileBase = `${title}-${recordId}`.replace(/\s+/g, "-")

  async function handleDownload() {
    setBusy("pdf")
    let el: HTMLElement | null = null
    try {
      el = await buildReportElement()
      await downloadElementPdf(el, fileBase)
      toast({ title: "تم تنزيل ملف PDF" })
    } catch (err) {
      toast({
        title: "تعذّر إنشاء PDF",
        description: err instanceof Error ? err.message : "حدث خطأ.",
        variant: "destructive",
      })
    } finally {
      if (el) document.body.removeChild(el)
      setBusy(null)
    }
  }

  async function handleEmail() {
    setBusy("email")
    let el: HTMLElement | null = null
    try {
      // Download the PDF first so the user can attach it to the email.
      el = await buildReportElement()
      await downloadElementPdf(el, fileBase)

      const lines = fields.filter((f) => f.value && f.value !== "-").map((f) => `${f.label}: ${f.value}`)
      const body = [
        `تقرير: ${title}`,
        documentNo ? `رقم الوثيقة: ${documentNo}` : "",
        "",
        ...lines,
        "",
        `عدد الصور المرفقة: ${attachments.filter((a) => a.kind === "photo").length}`,
        `عدد التواقيع: ${attachments.filter((a) => a.kind === "signature").length}`,
        "",
        "ملاحظة: تم تنزيل ملف PDF الكامل (يحتوي الصور والتواقيع) على جهازك — يرجى إرفاقه بهذه الرسالة.",
      ]
        .filter((l) => l !== null)
        .join("\n")

      const mailto = `mailto:?subject=${encodeURIComponent(`تقرير ${title}`)}&body=${encodeURIComponent(body)}`
      window.location.href = mailto
      toast({
        title: "تم تجهيز البريد",
        description: "أُنزِل ملف PDF — أرفقه بالرسالة قبل الإرسال.",
      })
    } catch (err) {
      toast({
        title: "تعذّر تجهيز البريد",
        description: err instanceof Error ? err.message : "حدث خطأ.",
        variant: "destructive",
      })
    } finally {
      if (el) document.body.removeChild(el)
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="عرض التفاصيل">
          <Eye className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-wrap gap-2 border-b border-border pb-4">
          <Button size="sm" onClick={handleDownload} disabled={busy !== null} className="gap-1.5">
            {busy === "pdf" ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            تنزيل PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleEmail}
            disabled={busy !== null}
            className="gap-1.5 bg-transparent"
          >
            {busy === "email" ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
            إرسال بالبريد
          </Button>
        </div>

        {/* On-screen field summary */}
        <div ref={reportRef} className="rounded-lg border border-border">
          <dl className="divide-y divide-border text-sm">
            {fields
              .filter((f) => f.value && f.value !== "-")
              .map((f) => (
                <div key={f.label} className="grid grid-cols-3 gap-2 px-4 py-2.5">
                  <dt className="font-medium text-muted-foreground">{f.label}</dt>
                  <dd className="col-span-2 text-foreground">{f.value}</dd>
                </div>
              ))}
          </dl>
        </div>

        <AttachmentsManager module={module} recordId={recordId} initial={attachments} />
      </DialogContent>
    </Dialog>
  )
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>")
}
