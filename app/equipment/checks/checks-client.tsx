"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ShieldCheck,
  ShieldAlert,
  ClipboardCheck,
  Search,
  QrCode,
  Truck,
  AlertTriangle,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { equipmentTypeLabels } from "@/lib/labels"
import { useI18n } from "@/lib/i18n/client"
import { CheckDetailDialog } from "./check-detail-dialog"
import type { RecentCheckRow } from "@/app/actions/equipment-checks"

type Compliance = {
  totalActive: number
  checkedToday: number
  outOfService: number
  currentShift: "1" | "2" | "3"
  uninspectedThisShift: { id: number; fleetNo: string; plateNumber: string; equipmentType: string }[]
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof ShieldCheck
  label: string
  value: string
  tone?: "default" | "good" | "bad"
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className={
          "flex size-10 shrink-0 items-center justify-center rounded-lg " +
          (tone === "good"
            ? "bg-primary/10 text-primary"
            : tone === "bad"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground")
        }
      >
        <Icon className="size-5" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-2xl font-bold leading-none">{value}</span>
        <span className="mt-1 text-xs text-muted-foreground">{label}</span>
      </div>
    </Card>
  )
}

export function ChecksClient({ checks, compliance }: { checks: RecentCheckRow[]; compliance: Compliance }) {
  const { t, dir, locale } = useI18n()
  const ar = locale === "ar"
  const [q, setQ] = useState("")
  const [openId, setOpenId] = useState<number | null>(null)

  const compliancePct = compliance.totalActive
    ? Math.round((compliance.checkedToday / compliance.totalActive) * 100)
    : 0

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return checks
    return checks.filter(
      (c) =>
        c.code.toLowerCase().includes(term) ||
        c.fleetNo.toLowerCase().includes(term) ||
        c.plateNumber.toLowerCase().includes(term) ||
        c.operatorName.toLowerCase().includes(term),
    )
  }, [q, checks])

  const shiftLabel = (s: string) => (ar ? { "1": "الأولى", "2": "الثانية", "3": "الثالثة" }[s] ?? s : `Shift ${s}`)

  return (
    <section className="flex flex-col gap-6" dir={dir}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {ar ? "الوردية الحالية: " : "Current shift: "}
          <span className="font-medium text-foreground">{shiftLabel(compliance.currentShift)}</span>
        </p>
        <Button asChild variant="outline">
          <Link href="/equipment/qr-labels">
            <QrCode data-icon="inline-start" />
            {ar ? "ملصقات QR" : "QR labels"}
          </Link>
        </Button>
      </div>

      {/* مؤشرات اليوم */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={ClipboardCheck}
          label={ar ? "امتثال اليوم" : "Today's compliance"}
          value={`${compliancePct}%`}
          tone={compliancePct >= 90 ? "good" : compliancePct >= 60 ? "default" : "bad"}
        />
        <KpiCard
          icon={ShieldCheck}
          label={ar ? "مفحوصة اليوم" : "Checked today"}
          value={`${compliance.checkedToday}/${compliance.totalActive}`}
          tone="good"
        />
        <KpiCard
          icon={ShieldAlert}
          label={ar ? "خارج الخدمة" : "Out of service"}
          value={String(compliance.outOfService)}
          tone={compliance.outOfService > 0 ? "bad" : "default"}
        />
        <KpiCard
          icon={AlertTriangle}
          label={ar ? "غير مفحوصة (الوردية)" : "Unchecked (shift)"}
          value={String(compliance.uninspectedThisShift.length)}
          tone={compliance.uninspectedThisShift.length > 0 ? "bad" : "good"}
        />
      </div>

      {/* المعدات غير المفحوصة في الوردية الحالية */}
      {compliance.uninspectedThisShift.length > 0 && (
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <h3 className="text-sm font-semibold">
              {ar ? "معدات لم تُفحص في الوردية الحالية" : "Not checked this shift"}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {compliance.uninspectedThisShift.map((e) => (
              <Link
                key={e.id}
                href={`/equipment/check?id=${e.id}`}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium transition-colors hover:bg-accent"
              >
                <Truck className="size-3" />
                <span dir="ltr">{e.fleetNo || e.plateNumber || `#${e.id}`}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* البحث */}
      <div className="relative">
        <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={ar ? "ابحث برقم الفحص أو المعدة أو السائق…" : "Search by check code, equipment, or operator…"}
          className="ps-9"
        />
      </div>

      {/* سجل الفحوصات */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{ar ? "رقم الفحص" : "Check"}</TableHead>
              <TableHead>{ar ? "المعدة" : "Equipment"}</TableHead>
              <TableHead>{ar ? "السائق" : "Operator"}</TableHead>
              <TableHead>{ar ? "الوردية" : "Shift"}</TableHead>
              <TableHead>{ar ? "التاريخ" : "Date"}</TableHead>
              <TableHead>{ar ? "النتيجة" : "Result"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {ar ? "لا توجد فحوصات." : "No checks."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)}>
                  <TableCell dir="ltr" className="font-mono text-xs">
                    {c.code}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span dir="ltr" className="font-medium">
                        {c.fleetNo || c.plateNumber || `#${c.equipmentId}`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {equipmentTypeLabels[c.equipmentType] || c.equipmentType}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{c.operatorName}</TableCell>
                  <TableCell>{shiftLabel(c.shift)}</TableCell>
                  <TableCell dir="ltr" className="font-mono text-xs">
                    {c.checkDate}
                  </TableCell>
                  <TableCell>
                    {c.result === "fit" ? (
                      <Badge variant="default" className="gap-1">
                        <ShieldCheck className="size-3" />
                        {ar ? "صالحة" : "Fit"}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <ShieldAlert className="size-3" />
                        {ar ? "غير صالحة" : "Unfit"}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CheckDetailDialog checkId={openId} onClose={() => setOpenId(null)} />
    </section>
  )
}
