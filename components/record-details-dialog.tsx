"use client"

import { useRef, useState } from "react"
import { Eye, Download, Mail, Loader2, PenLine } from "lucide-react"
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
import { signatureRoles as signatureRolesConfig, labelForSignatureKind } from "@/lib/signature-roles"
import { toast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n/client"

export type DetailField = { label: string; value: string }

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

function isBase64Image(value: string) {
  return value?.startsWith("data:image")
}

export function RecordDetailsDialog({
  module,
  recordId,
  title,
  subtitle,
  documentNo,
  fields,
  signatures,
  initialAttachments,
  trigger,
  extraSection,
  extraReportHtml,
  suppressReportAttachments,
}: {
  module: string
  recordId: number
  title: string
  subtitle?: string
  documentNo?: string
  fields: DetailField[]
  signatures?: DetailField[]
  initialAttachments: AttachmentRow[]
  trigger?: React.ReactNode
  // Optional custom block rendered on-screen below the fields.
  extraSection?: React.ReactNode
  // Optional custom HTML injected into the PDF (page 1) after the fields table.
  extraReportHtml?: string
  // When true, the PDF omits the separate "attachments & signatures" page
  // (used by training, where attendee signatures already appear inline).
  suppressReportAttachments?: boolean
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentRow[]>(initialAttachments)
  const [busy, setBusy] = useState<"pdf" | "email" | null>(null)
  const reportRef = useRef<HTMLDivElement | null>(null)
  const moduleRoles = signatureRolesConfig[module]

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

  async function buildReportElement(): Promise<HTMLElement> {
    const photos = attachments.filter((a) => a.kind === "photo")
    const signatureAttachments = attachments.filter(
      (a) => a.kind === "signature" || a.kind.startsWith("signature:"),
    )

    const photoData = await Promise.all(photos.map((p) => toDataUrl(fileUrl(p.pathname))))
    const sigData = await Promise.all(
      signatureAttachments.map(async (s) => ({
        data: await toDataUrl(fileUrl(s.pathname)),
        label: s.kind === "signature" ? t("recordDetails.signatureLabel") : labelForSignatureKind(module, s.kind),
      })),
    )

    // التواقيع الرسمية المحفوظة كـ base64 في أعمدة السجل (prop التواقيع)
    const columnSigs = (signatures ?? [])
      .filter((f) => isBase64Image(f.value))
      .map((f) => ({ data: f.value, label: f.label }))

    // استخدم مصدراً واحداً فقط لتفادي تكرار التواقيع: أعمدة السجل إن وُجدت،
    // وإلا فالمرفقات المحفوظة باسم الدور.
    const allSigs = columnSigs.length > 0 ? columnSigs : sigData.filter((s) => s.data)

    const container = document.createElement("div")
    container.dir = "rtl"
    container.style.cssText =
      "position:fixed;top:-10000px;right:0;width:794px;background:#ffffff;color:#0f172a;font-family:system-ui,'Segoe UI',Tahoma,sans-serif;font-size:12pt;line-height:1.5;box-sizing:border-box;"

    const rows = fields
      .filter((f) => f.value && f.value !== "-" && !isBase64Image(f.value))
      .map(
        (f) => `<tr>
          <td style="border:1px solid black;background:#f0f0f0;font-weight:bold;width:30%;padding:6px;vertical-align:top;">${f.label}</td>
          <td style="border:1px solid black;background:#ffffff;width:70%;padding:6px;vertical-align:top;white-space:pre-line;">${escapeHtml(f.value)}</td>
        </tr>`,
      )
      .join("")

    // الصور المرفقة: شبكة من عمودين، عرض كل صورة لا يتجاوز نصف الصفحة
    const validPhotos = photoData.filter(Boolean)
    const photosHtml = validPhotos
      .map(
        (d) =>
          `<div style="width:50%;box-sizing:border-box;padding:6px;"><img src="${d}" style="width:100%;height:220px;border:1px solid #e2e8f0;border-radius:6px;object-fit:cover;" /></div>`,
      )
      .join("")

    // التواقيع الرسمية: جدول 2×2
    const sigCell = (s?: { data: string | null; label: string }) =>
      s && s.data
        ? `<td style="width:50%;border:1px solid #e2e8f0;padding:12px;text-align:center;vertical-align:top;background:#fff;"><img src="${s.data}" style="max-height:110px;max-width:90%;" /><div style="margin-top:8px;font-size:12pt;font-weight:600;color:#334155;border-top:1px solid #e2e8f0;padding-top:8px;">${escapeHtml(s.label)}</div></td>`
        : `<td style="width:50%;border:1px solid #e2e8f0;padding:12px;"></td>`
    const sigRows: string[] = []
    for (let i = 0; i < allSigs.length; i += 2) {
      sigRows.push(`<tr>${sigCell(allSigs[i])}${sigCell(allSigs[i + 1])}</tr>`)
    }
    const sigHtml = sigRows.length
      ? `<table style="width:100%;border-collapse:collapse;">${sigRows.join("")}</table>`
      : ""

    const mhsLogo = `
      <svg width="118" height="64" viewBox="0 0 118 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrow" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="#1a5fa8"/>
          </marker>
        </defs>
        <path d="M 95 9 A 17 17 0 1 1 93 8" stroke="#1a5fa8" stroke-width="3" fill="none" marker-end="url(#arrow)"/>
        <text x="6" y="44" font-size="38" font-weight="bold" fill="#1a5fa8" font-family="Arial, sans-serif">MHS</text>
        <text x="59" y="60" font-size="11" font-weight="600" fill="#1a5fa8" font-family="system-ui, Tahoma, sans-serif" text-anchor="middle">الأيادي الفضية الحديثة</text>
      </svg>`

    container.innerHTML = `
      <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;margin-bottom:24px;">
        <tr>
          <td style="border:1px solid #cbd5e1;padding:10px;width:150px;text-align:center;vertical-align:middle;background:#ffffff;">
            ${mhsLogo}
          </td>
          <td style="border:1px solid #cbd5e1;padding:10px 14px;text-align:center;vertical-align:middle;">
            <div style="font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(title)}</div>
            ${subtitle ? `<div style="font-size:12px;color:#64748b;margin-top:4px;">${escapeHtml(subtitle)}</div>` : ""}
            <div style="font-size:11px;color:#94a3b8;margin-top:4px;direction:ltr;">Health, Safety &amp; Environment Report</div>
          </td>
          <td style="border:1px solid #cbd5e1;padding:8px 12px;width:210px;font-size:11px;color:#334155;vertical-align:middle;line-height:1.7;">
            <div>رقم الوثيقة: <span style="font-family:monospace;">MHS-IMS-FR-HSE-01</span></div>
            <div>رقم الإصدار/التاريخ: 01 / 28.12.2025</div>
            <div>رقم المراجعة/التاريخ: 00</div>
            ${documentNo ? `<div style="margin-top:4px;padding-top:4px;border-top:1px solid #e2e8f0;">المرجع: <span style="font-family:monospace;">${escapeHtml(documentNo)}</span></div>` : ""}
          </td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;border:2px solid black;font-size:12pt;">${rows}</table>
      ${extraReportHtml ? `<div style="margin-top:20px;">${extraReportHtml}</div>` : ""}
      <div style="border:2px solid black;border-top:none;padding:6px;font-size:12pt;color:#334155;text-align:center;">
        نظام إدارة الصحة والسلامة والبيئة (HSE) — تم إنشاء هذا التقرير إلكترونياً
      </div>
    `

    // Natural-height first page (no forced A4 min-height → avoids blank pages).
    const page1 = `<div style="padding:40px;box-sizing:border-box;">${container.innerHTML}</div>`

    // The attachments/signatures page is skipped entirely for training, where
    // attendee signatures already appear inline in the attendance table.
    const hasAttachments = !suppressReportAttachments && (!!photosHtml || !!sigHtml)

    const page2 = hasAttachments
      ? `<div style="margin-top:24px;padding:0 40px 40px;box-sizing:border-box;">
           <h1 style="font-size:16pt;color:#0f766e;margin:0 0 16px;border-bottom:2px solid #0f766e;padding-bottom:10px;">المرفقات والتواقيع الرسمية</h1>
           ${
             photosHtml
               ? `<h2 style="font-size:14pt;color:#0f766e;margin:0 0 8px;">الصور المرفقة (${validPhotos.length})</h2><div style="display:flex;flex-wrap:wrap;margin-bottom:28px;">${photosHtml}</div>`
               : ""
           }
           ${
             sigHtml
               ? `<h2 style="font-size:14pt;color:#0f766e;margin:0 0 8px;">التواقيع الرسمية</h2>${sigHtml}`
               : ""
           }
         </div>`
      : ""

    // أعِد بناء المحتوى: بيانات السجل ثم المرفقات والتواقيع (إن وُجدت).
    container.innerHTML = page1 + page2
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
      toast({ title: t("recordDetails.pdfDownloadedTitle") })
    } catch (err) {
      toast({
        title: t("recordDetails.pdfFailedTitle"),
        description: err instanceof Error ? err.message : t("recordDetails.genericError"),
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
      el = await buildReportElement()
      await downloadElementPdf(el, fileBase)

      const lines = fields
        .filter((f) => f.value && f.value !== "-" && !isBase64Image(f.value))
        .map((f) => `${f.label}: ${f.value}`)
      const body = [
        t("recordDetails.mailReport").replace("{title}", title),
        documentNo ? t("recordDetails.mailDocNo").replace("{no}", documentNo) : "",
        "",
        ...lines,
        "",
        t("recordDetails.mailPhotoCount").replace("{count}", String(attachments.filter((a) => a.kind === "photo").length)),
        t("recordDetails.mailSigCount").replace("{count}", String(attachments.filter((a) => a.kind === "signature" || a.kind.startsWith("signature:")).length)),
        "",
        t("recordDetails.mailAttachNote"),
      ]
        .filter((l) => l !== null)
        .join("\n")

      const mailto = `mailto:?subject=${encodeURIComponent(t("recordDetails.mailSubject").replace("{title}", title))}&body=${encodeURIComponent(body)}`
      window.location.href = mailto
      toast({
        title: t("recordDetails.emailReadyTitle"),
        description: t("recordDetails.emailReadyDesc"),
      })
    } catch (err) {
      toast({
        title: t("recordDetails.emailFailedTitle"),
        description: err instanceof Error ? err.message : t("recordDetails.genericError"),
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
        {trigger ?? (
          <Button variant="ghost" size="icon" className="size-8" aria-label={t("recordDetails.viewDetails")}>
            <Eye className="size-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-wrap gap-2 border-b border-border pb-4">
          <Button size="sm" onClick={handleDownload} disabled={busy !== null} className="gap-1.5">
            {busy === "pdf" ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {t("recordDetails.downloadPdf")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleEmail}
            disabled={busy !== null}
            className="gap-1.5 bg-transparent"
          >
            {busy === "email" ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
            {t("recordDetails.sendEmail")}
          </Button>
        </div>

        {/* عرض الحقول على الشاشة */}
        <div ref={reportRef} className="rounded-lg border border-border">
          <dl className="divide-y divide-border text-sm">
            {fields
              .filter((f) => f.value && f.value !== "-")
              .map((f) => (
                <div key={f.label} className="grid grid-cols-3 gap-2 px-4 py-2.5">
                  <dt className="font-medium text-muted-foreground">{f.label}</dt>
                  <dd className="col-span-2 whitespace-pre-line text-foreground">
                    {isBase64Image(f.value) ? (
                      <img
                        src={f.value}
                        alt={f.label}
                        className="h-24 rounded border border-border object-contain bg-white"
                      />
                    ) : (
                      f.value
                    )}
                  </dd>
                </div>
              ))}
          </dl>
        </div>

        {extraSection}

        <AttachmentsManager
          key={`${recordId}-${attachments.length}`}
          module={module}
          recordId={recordId}
          initial={attachments}
          signatureRoles={moduleRoles}
          hideSignatures={!!signatures}
        />

        {signatures && signatures.length > 0 && (
          <section className="flex flex-col gap-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <PenLine className="size-4 text-muted-foreground" />
              {t("recordDetails.officialSignatures")}
            </h4>
            <div className="grid gap-4 sm:grid-cols-3">
              {signatures.map((sig) => (
                <div
                  key={sig.label}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3"
                >
                  <span className="text-sm font-medium text-foreground">{sig.label}</span>
                  {isBase64Image(sig.value) ? (
                    <div className="overflow-hidden rounded-md border border-border bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sig.value || "/placeholder.svg"}
                        alt={sig.label}
                        className="h-24 w-full object-contain p-2"
                      />
                    </div>
                  ) : (
                    <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border bg-muted/30">
                      <span className="text-xs text-muted-foreground">{t("recordDetails.notSignedYet")}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
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
