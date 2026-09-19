"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Loader2, Printer, ShieldCheck, ShieldAlert, CheckCircle2, XCircle, MinusCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/client"
import { getDailyCheck, type DailyCheckRow } from "@/app/actions/equipment-checks"
import { downloadElementPdf } from "@/lib/pdf"

type CheckItem = {
  id: number
  itemCode: string
  labelAr: string
  status: string
  isSafetyCritical: boolean
  note: string
  photoUrl: string
}

export function CheckDetailDialog({ checkId, onClose }: { checkId: number | null; onClose: () => void }) {
  const { locale } = useI18n()
  const ar = locale === "ar"
  const [data, setData] = useState<{ check: DailyCheckRow; items: CheckItem[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [isPrinting, startPrint] = useTransition()
  const printRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (checkId == null) {
      setData(null)
      return
    }
    setLoading(true)
    getDailyCheck(checkId)
      .then((res) => setData(res as { check: DailyCheckRow; items: CheckItem[] } | null))
      .finally(() => setLoading(false))
  }, [checkId])

  function handlePrint() {
    if (!printRef.current || !data) return
    startPrint(async () => {
      await downloadElementPdf(printRef.current!, `${data.check.code}.pdf`, { singlePage: true })
    })
  }

  const shiftLabel = (s: string) => (ar ? { "1": "الأولى", "2": "الثانية", "3": "الثالثة" }[s] ?? s : `Shift ${s}`)
  const statusIcon = (s: string) =>
    s === "ok" ? (
      <CheckCircle2 className="size-4 text-primary" />
    ) : s === "defect" ? (
      <XCircle className="size-4 text-destructive" />
    ) : (
      <MinusCircle className="size-4 text-muted-foreground" />
    )
  const statusText = (s: string) => (ar ? { ok: "سليم", defect: "عيب", na: "لا ينطبق" }[s] ?? s : s)

  return (
    <Dialog open={checkId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span className="font-mono text-sm" dir="ltr">
              {data?.check.code ?? (ar ? "تفاصيل الفحص" : "Check detail")}
            </span>
            {data && (
              <Button size="sm" variant="outline" onClick={handlePrint} disabled={isPrinting} className="gap-1.5 bg-transparent">
                {isPrinting ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />}
                {ar ? "طباعة PDF" : "Print PDF"}
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}

        {data && (
          <div ref={printRef} className="flex flex-col gap-4 bg-white p-1 text-foreground">
            {/* رأس التقرير */}
            <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-base font-bold">{ar ? "تقرير الفحص اليومي قبل التشغيل" : "Daily Pre-Operation Check Report"}</h2>
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {data.check.code} · {data.check.checkDate}
                </p>
              </div>
              {data.check.result === "fit" ? (
                <Badge variant="default" className="gap-1">
                  <ShieldCheck className="size-3" />
                  {ar ? "صالحة للتشغيل" : "Fit"}
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <ShieldAlert className="size-3" />
                  {ar ? "غير صالحة" : "Unfit"}
                </Badge>
              )}
            </div>

            {/* بيانات أساسية */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Field label={ar ? "السائق" : "Operator"} value={data.check.operatorName} />
              <Field label={ar ? "الوردية" : "Shift"} value={shiftLabel(data.check.shift)} />
              <Field
                label={ar ? "طريقة الإدخال" : "Entry method"}
                value={data.check.entryMethod === "qr" ? (ar ? "مسح QR" : "QR scan") : ar ? "يدوي" : "Manual"}
              />
              <Field
                label={ar ? "تصريح القيادة" : "Driving permit"}
                value={
                  data.check.permitStatus === "valid" ? (ar ? "ساري" : "Valid") : ar ? "غير ساري" : "Invalid"
                }
              />
              {data.check.hourMeter != null && <Field label={ar ? "عداد الساعات" : "Hour meter"} value={String(data.check.hourMeter)} ltr />}
              <Field label={ar ? "الموقع" : "Location"} value={data.check.location || "-"} />
            </div>

            {/* بنود الفحص */}
            <div className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold text-muted-foreground">{ar ? "بنود الفحص" : "Checklist items"}</h3>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <tbody>
                    {data.items.map((it) => (
                      <tr key={it.id} className={cn("border-b border-border/60 last:border-0", it.status === "defect" && "bg-destructive/5")}>
                        <td className="p-2 align-top">
                          <div className="flex items-center gap-2">
                            {statusIcon(it.status)}
                            <div className="flex flex-col">
                              <span className="font-medium">{it.labelAr}</span>
                              {it.isSafetyCritical && (
                                <span className="text-[10px] font-medium text-destructive">{ar ? "حرج للسلامة" : "Safety-critical"}</span>
                              )}
                              {it.note && <span className="mt-0.5 text-xs text-muted-foreground">{it.note}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="w-20 p-2 text-end align-top text-xs text-muted-foreground">{statusText(it.status)}</td>
                        <td className="w-14 p-2 align-top">
                          {it.photoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.photoUrl || "/placeholder.svg"} alt="" crossOrigin="anonymous" className="size-10 rounded border object-cover" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {data.check.notes && (
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-semibold text-muted-foreground">{ar ? "ملاحظات" : "Notes"}</h3>
                <p className="whitespace-pre-wrap text-sm">{data.check.notes}</p>
              </div>
            )}

            {/* التوقيعات */}
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
              <SignatureBlock label={ar ? "توقيع السائق" : "Operator signature"} name={data.check.operatorName} url={data.check.operatorSignatureUrl} />
              <SignatureBlock
                label={ar ? "توقيع المشرف" : "Supervisor signature"}
                name={data.check.supervisorName}
                url={data.check.supervisorSignatureUrl}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/40 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium", ltr && "font-mono")} dir={ltr ? "ltr" : undefined}>
        {value}
      </span>
    </div>
  )
}

function SignatureBlock({ label, name, url }: { label: string; name: string; url: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex h-16 items-center justify-center rounded-md border border-border bg-muted/20">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url || "/placeholder.svg"} alt="" crossOrigin="anonymous" className="max-h-14 object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      <span className="text-center text-xs font-medium">{name || "—"}</span>
    </div>
  )
}
