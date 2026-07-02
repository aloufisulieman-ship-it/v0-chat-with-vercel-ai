"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import { FileText, FileSpreadsheet, Mail, Eye, Loader2 } from "lucide-react"
import { getReportData, type ReportSection, type ReportType } from "@/app/actions/hse"
import { elementToPdf } from "@/lib/pdf"
import * as XLSX from "xlsx"

const reportTypeOptions: { value: ReportType; label: string }[] = [
  { value: "incidents", label: "الحوادث" },
  { value: "violations", label: "المخالفات" },
  { value: "inspections", label: "التفتيش" },
  { value: "observations", label: "الملاحظات الوشيكة" },
  { value: "positives", label: "الملاحظات الإيجابية" },
  { value: "all", label: "تقرير شامل" },
]

export function ReportsClient() {
  const { toast } = useToast()
  const [type, setType] = useState<ReportType>("incidents")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sections, setSections] = useState<ReportSection[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<"" | "pdf" | "excel" | "email">("")

  // Email dialog state
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState("")
  const [emailMessage, setEmailMessage] = useState("")
  const [sending, setSending] = useState(false)

  const previewRef = useRef<HTMLDivElement>(null)

  const typeLabel = reportTypeOptions.find((o) => o.value === type)?.label ?? ""
  const rangeText =
    dateFrom || dateTo ? `من ${dateFrom || "البداية"} إلى ${dateTo || "الآن"}` : "كل الفترات"

  async function loadPreview() {
    setLoading(true)
    try {
      const data = await getReportData(type, dateFrom, dateTo)
      setSections(data)
    } catch (e) {
      toast({ title: "تعذّر جلب البيانات", description: (e as Error).message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // Builds an off-screen styled element identical to the on-screen preview,
  // used as the source for the PDF (renders Arabic RTL correctly via DOM).
  function buildPdfSource(): HTMLElement {
    const el = document.createElement("div")
    el.dir = "rtl"
    el.style.cssText =
      "position:fixed;top:-10000px;right:0;width:794px;background:#ffffff;color:#0f172a;font-family:system-ui,'Segoe UI',Tahoma,sans-serif;font-size:12pt;padding:40px;box-sizing:border-box;"

    const header = `
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #0f766e;padding-bottom:14px;margin-bottom:20px;">
        <div style="font-size:22px;font-weight:700;color:#1a5fa8;">MHS · الأيادي الفضية الحديثة</div>
        <div style="text-align:left;font-size:11px;color:#64748b;line-height:1.7;">
          <div>${escapeHtml(typeLabel)} — نظام إدارة السلامة (HSE)</div>
          <div>${escapeHtml(rangeText)}</div>
          <div>تاريخ الإصدار: ${new Date().toLocaleDateString("ar-EG")}</div>
        </div>
      </div>`

    const body = (sections ?? [])
      .map((s) => {
        const head = s.columns.map((c) => `<th style="border:1px solid #000;background:#f0f0f0;padding:6px;font-size:11pt;">${escapeHtml(c.label)}</th>`).join("")
        const rows = s.rows.length
          ? s.rows
              .map(
                (r) =>
                  `<tr>${s.columns.map((c) => `<td style="border:1px solid #000;padding:6px;font-size:11pt;text-align:center;">${escapeHtml(String(r[c.key] ?? "-"))}</td>`).join("")}</tr>`,
              )
              .join("")
          : `<tr><td colspan="${s.columns.length}" style="border:1px solid #000;padding:10px;text-align:center;color:#64748b;">لا توجد بيانات في هذه الفترة</td></tr>`
        return `
          <h2 style="font-size:14pt;color:#0f766e;margin:18px 0 8px;">${escapeHtml(s.title)} (${s.rows.length})</h2>
          <table style="width:100%;border-collapse:collapse;border:2px solid #000;"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`
      })
      .join("")

    const footer = `<div style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:10pt;color:#94a3b8;text-align:center;">تم إنشاء هذا التقرير إلكترونياً من نظام إدارة الصحة والسلامة والبيئة</div>`

    el.innerHTML = header + body + footer
    return el
  }

  const fileBase = `تقرير-${typeLabel}-${new Date().toISOString().slice(0, 10)}`

  async function handlePdf() {
    if (!sections) return
    setBusy("pdf")
    let src: HTMLElement | null = null
    try {
      src = buildPdfSource()
      document.body.appendChild(src)
      const pdf = await elementToPdf(src)
      pdf.save(`${fileBase}.pdf`)
      toast({ title: "تم تنزيل ملف PDF" })
    } catch (e) {
      toast({ title: "تعذّر إنشاء PDF", description: (e as Error).message, variant: "destructive" })
    } finally {
      if (src) document.body.removeChild(src)
      setBusy("")
    }
  }

  function handleExcel() {
    if (!sections) return
    setBusy("excel")
    try {
      const wb = XLSX.utils.book_new()
      for (const s of sections) {
        const aoa = [
          s.columns.map((c) => c.label),
          ...s.rows.map((r) => s.columns.map((c) => r[c.key] ?? "-")),
        ]
        const ws = XLSX.utils.aoa_to_sheet(aoa)
        ws["!cols"] = s.columns.map(() => ({ wch: 20 }))
        // Sheet names max 31 chars and cannot contain some symbols.
        const name = s.title.replace(/[\\/?*[\]:]/g, "").slice(0, 31)
        XLSX.utils.book_append_sheet(wb, ws, name)
      }
      XLSX.writeFile(wb, `${fileBase}.xlsx`)
      toast({ title: "تم تنزيل ملف Excel" })
    } catch (e) {
      toast({ title: "تعذّر إنشاء Excel", description: (e as Error).message, variant: "destructive" })
    } finally {
      setBusy("")
    }
  }

  async function handleSendEmail() {
    if (!sections) return
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailTo)) {
      toast({ title: "أدخل بريداً إلكترونياً صالحاً", variant: "destructive" })
      return
    }
    setSending(true)
    let src: HTMLElement | null = null
    try {
      src = buildPdfSource()
      document.body.appendChild(src)
      const pdf = await elementToPdf(src)
      const dataUri = pdf.output("datauristring")
      const res = await fetch("/api/reports/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          subject: `${typeLabel} — نظام إدارة السلامة`,
          message: emailMessage,
          fileName: `${fileBase}.pdf`,
          pdfBase64: dataUri,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "فشل الإرسال")
      toast({ title: "تم إرسال التقرير بنجاح", description: `إلى ${emailTo}` })
      setEmailOpen(false)
      setEmailTo("")
      setEmailMessage("")
    } catch (e) {
      toast({ title: "تعذّر إرسال البريد", description: (e as Error).message, variant: "destructive" })
    } finally {
      if (src) document.body.removeChild(src)
      setSending(false)
    }
  }

  const hasData = sections?.some((s) => s.rows.length > 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <Card className="p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <Label>نوع التقرير</Label>
            <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {reportTypeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>من تاريخ</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>إلى تاريخ</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={loadPreview} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
              معاينة البيانات
            </Button>
          </div>
        </div>

        {sections && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            <Button variant="outline" className="gap-2" onClick={handlePdf} disabled={!hasData || busy !== ""}>
              {busy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
              تصدير PDF
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExcel} disabled={!hasData || busy !== ""}>
              {busy === "excel" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
              تصدير Excel
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setEmailOpen(true)} disabled={!hasData || busy !== ""}>
              <Mail className="size-4" />
              إرسال بالإيميل
            </Button>
          </div>
        )}
      </Card>

      {/* Preview */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Spinner /> جارٍ تحميل البيانات...
        </div>
      )}

      {sections && !loading && (
        <div ref={previewRef} className="flex flex-col gap-8">
          {sections.map((s) => (
            <section key={s.key}>
              <h2 className="mb-3 text-lg font-semibold text-foreground">
                {s.title} <span className="text-sm font-normal text-muted-foreground">({s.rows.length})</span>
              </h2>
              {s.rows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  لا توجد بيانات في هذه الفترة.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {s.columns.map((c) => (
                          <th key={c.key} className="whitespace-nowrap px-3 py-2 text-right font-semibold text-foreground">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.rows.map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          {s.columns.map((c) => (
                            <td key={c.key} className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                              {String(r[c.key] ?? "-")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Email dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إرسال التقرير بالبريد الإلكتروني</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label>البريد الإلكتروني للمستلم</Label>
              <Input
                type="email"
                dir="ltr"
                placeholder="name@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>رسالة (اختياري)</Label>
              <Textarea
                rows={3}
                placeholder="نص يرافق التقرير المرفق..."
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">سيُرفق ملف PDF للتقرير تلقائياً بالرسالة.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)} disabled={sending}>إلغاء</Button>
            <Button onClick={handleSendEmail} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
              إرسال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Escapes user/content text before inserting into the off-screen PDF source.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
