"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Truck, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useI18n } from "@/lib/i18n/client"

type Item = { id: number; plateNumber: string; fleetNo: string; equipmentType: string; powerType: string }

// بديل مسح QR: يبحث السائق عن معدته يدوياً ثم ينتقل إلى نموذج الفحص.
export function EquipmentPicker({ list, notFound }: { list: Item[]; notFound: boolean }) {
  const { locale } = useI18n()
  const ar = locale === "ar"
  const router = useRouter()
  const [q, setQ] = useState("")

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return list
    return list.filter(
      (e) =>
        e.fleetNo.toLowerCase().includes(term) ||
        e.plateNumber.toLowerCase().includes(term) ||
        e.equipmentType.toLowerCase().includes(term),
    )
  }, [q, list])

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      {notFound && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{ar ? "لم يتم التعرّف على المعدة من الرمز. اختر المعدة يدوياً." : "Equipment not recognized from the code. Pick it manually."}</span>
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={ar ? "ابحث برقم الأسطول أو اللوحة أو النوع…" : "Search by fleet no., plate, or type…"}
          className="ps-9"
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">{ar ? "لا توجد معدات مطابقة." : "No matching equipment."}</p>
        )}
        {filtered.map((e) => (
          <Card
            key={e.id}
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/equipment/check?id=${e.id}`)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") router.push(`/equipment/check?id=${e.id}`)
            }}
            className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-accent"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Truck className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold" dir="ltr">
                {e.fleetNo || e.plateNumber || `#${e.id}`}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {e.equipmentType} · {e.plateNumber}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
