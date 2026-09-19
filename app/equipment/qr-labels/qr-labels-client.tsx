"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Printer, Search } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { equipmentTypeLabels } from "@/lib/labels"
import { useI18n } from "@/lib/i18n/client"
import type { QrLabelRow } from "@/app/actions/equipment-checks"

const powerLabel: Record<string, { ar: string; en: string }> = {
  electric: { ar: "كهربائية", en: "Electric" },
  diesel: { ar: "ديزل", en: "Diesel" },
  lpg: { ar: "غاز LPG", en: "LPG" },
}

export function QrLabelsClient({ labels }: { labels: QrLabelRow[] }) {
  const { locale, dir } = useI18n()
  const ar = locale === "ar"
  const [q, setQ] = useState("")
  const [origin, setOrigin] = useState("")
  const [qrMap, setQrMap] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(true)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  // توليد صور QR كسولاً في المتصفح (مكتبة qrcode ثقيلة، نستوردها ديناميكياً).
  useEffect(() => {
    if (!origin) return
    let cancelled = false
    setGenerating(true)
    ;(async () => {
      const { default: QRCode } = await import("qrcode")
      const entries: Record<string, string> = {}
      for (const l of labels) {
        if (!l.qrToken) continue
        const url = `${origin}/equipment/check?token=${encodeURIComponent(l.qrToken)}`
        try {
          entries[l.qrToken] = await QRCode.toDataURL(url, {
            margin: 1,
            width: 220,
            color: { dark: "#0f172a", light: "#ffffff" },
          })
        } catch {
          entries[l.qrToken] = ""
        }
      }
      if (!cancelled) {
        setQrMap(entries)
        setGenerating(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [origin, labels])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return labels
    return labels.filter(
      (l) =>
        l.fleetNo.toLowerCase().includes(term) ||
        l.plateNumber.toLowerCase().includes(term) ||
        (equipmentTypeLabels[l.equipmentType] || l.equipmentType).toLowerCase().includes(term),
    )
  }, [q, labels])

  return (
    <section className="flex flex-col gap-6" dir={dir}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ar ? "ابحث عن معدة…" : "Search equipment…"}
            className="ps-9"
          />
        </div>
        <Button onClick={() => window.print()} disabled={generating} className="gap-1.5">
          {generating ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
          {ar ? "طباعة الملصقات" : "Print labels"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground print:hidden">
        {ar
          ? "الصق كل ملصق على معدته. عند مسحه بكاميرا الهاتف يفتح نموذج الفحص اليومي لتلك المعدة مباشرةً."
          : "Attach each label to its equipment. Scanning it with a phone opens that equipment's daily check form directly."}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-2">
        {filtered.map((l) => (
          <Card
            key={l.id}
            className="flex flex-col items-center gap-2 p-3 text-center print:border print:shadow-none"
          >
            <div className="flex aspect-square w-full max-w-[160px] items-center justify-center rounded-md bg-white p-2">
              {generating || !qrMap[l.qrToken] ? (
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrMap[l.qrToken] || "/placeholder.svg"} alt="" className="size-full object-contain" />
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span dir="ltr" className="text-sm font-bold">
                {l.fleetNo || l.plateNumber || `#${l.id}`}
              </span>
              <span className="text-xs text-muted-foreground">
                {equipmentTypeLabels[l.equipmentType] || l.equipmentType}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {ar ? powerLabel[l.powerType]?.ar : powerLabel[l.powerType]?.en}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">{ar ? "لا توجد معدات." : "No equipment."}</p>
      )}
    </section>
  )
}
