"use client"

import Link from "next/link"
import { ArrowRight, Truck, AlertTriangle, FileWarning, ClipboardCheck } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  equipmentTypeLabels, operationalStatusLabels, statusLabels, severityLabels,
} from "@/lib/labels"
import { useI18n } from "@/lib/i18n/client"

type EquipmentItem = {
  id: number
  fleetNo: string
  plateNumber: string
  equipmentType: string
  manufacturer: string
  model: string
  serialNumber: string
  yearMade: number | null
  capacity: string
  operationalStatus: string
  location: string
  purchaseDate: string | null
  lastInspectionDate: string | null
  nextInspectionDate: string | null
  ownerCompany: string
  driverName: string
  internalCode: string
  active: boolean
  notes: string
}

type ViolationRow = { id: number; documentNo: string | null; violationType: string | null; employeeName: string; status: string | null; violationDate: string | null }
type IncidentRow = { id: number; documentNo: string | null; title: string; severity: string | null; status: string | null; incidentDate: string | null }
type InspectionRow = { id: number; title: string; status: string | null; compliance: number | null; inspectionDate: string | null }

function opStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "operational") return "default"
  if (status === "maintenance") return "secondary"
  if (status === "out_of_service") return "destructive"
  return "outline"
}

function InfoRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium text-foreground ${ltr ? "font-mono" : ""}`} dir={ltr ? "ltr" : undefined}>{value || "-"}</span>
    </div>
  )
}

export function EquipmentDetailView({
  item,
  violations,
  incidents,
  inspections,
}: {
  item: EquipmentItem
  violations: ViolationRow[]
  incidents: IncidentRow[]
  inspections: InspectionRow[]
}) {
  const { t, dir } = useI18n()
  const typeLabel = equipmentTypeLabels[item.equipmentType] || item.equipmentType
  const title = item.fleetNo || item.plateNumber || `#${item.id}`

  return (
    <section className="flex flex-col gap-6" dir={dir}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Truck className="size-6" /></div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground" dir="ltr">{title}</h1>
              <Badge variant={opStatusVariant(item.operationalStatus)}>{operationalStatusLabels[item.operationalStatus] || item.operationalStatus}</Badge>
            </div>
            <span className="text-sm text-muted-foreground">{typeLabel}{item.manufacturer ? ` · ${item.manufacturer}` : ""}{item.model ? ` ${item.model}` : ""}</span>
          </div>
        </div>
        <Button asChild variant="outline"><Link href="/equipment"><ArrowRight data-icon="inline-start" />{t("equipmentDetail.backToList")}</Link></Button>
      </div>

      <Tabs defaultValue="overview" dir={dir}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">{t("equipmentDetail.tabOverview")}</TabsTrigger>
          <TabsTrigger value="status">{t("equipmentDetail.tabStatus")}</TabsTrigger>
          <TabsTrigger value="records">{t("equipmentDetail.tabRecords")}</TabsTrigger>
          <TabsTrigger value="notes">{t("equipmentDetail.tabNotes")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{t("equipmentReg.sectionIdentity")}</h3>
              <InfoRow label={t("equipmentReg.fFleetNo")} value={item.fleetNo} ltr />
              <InfoRow label={t("equipmentReg.fPlate")} value={item.plateNumber} ltr />
              <InfoRow label={t("equipmentReg.fType")} value={typeLabel} />
              <InfoRow label={t("equipmentReg.fInternalCode")} value={item.internalCode} ltr />
              <InfoRow label={t("equipmentReg.fOwner")} value={item.ownerCompany} />
              <InfoRow label={t("equipmentReg.fDriver")} value={item.driverName} />
            </Card>
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{t("equipmentReg.sectionSpecs")}</h3>
              <InfoRow label={t("equipmentReg.fManufacturer")} value={item.manufacturer} />
              <InfoRow label={t("equipmentReg.fModel")} value={item.model} />
              <InfoRow label={t("equipmentReg.fSerial")} value={item.serialNumber} ltr />
              <InfoRow label={t("equipmentReg.fYear")} value={item.yearMade ? String(item.yearMade) : ""} ltr />
              <InfoRow label={t("equipmentReg.fCapacity")} value={item.capacity} />
              <InfoRow label={t("equipmentReg.fLocation")} value={item.location} />
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="status">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t("equipmentReg.sectionInspection")}</h3>
            <InfoRow label={t("equipmentReg.fOpStatus")} value={operationalStatusLabels[item.operationalStatus] || item.operationalStatus} />
            <InfoRow label={t("equipmentReg.fStatus")} value={item.active ? t("equipmentReg.statusActive") : t("equipmentReg.statusInactive")} />
            <InfoRow label={t("equipmentReg.fPurchaseDate")} value={item.purchaseDate || ""} ltr />
            <InfoRow label={t("equipmentReg.fLastInspection")} value={item.lastInspectionDate || ""} ltr />
            <InfoRow label={t("equipmentReg.fNextInspection")} value={item.nextInspectionDate || ""} ltr />
          </Card>
        </TabsContent>

        <TabsContent value="records">
          <div className="flex flex-col gap-6">
            {/* المخالفات */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><FileWarning className="size-4 text-muted-foreground" /><h3 className="text-sm font-semibold text-foreground">{t("equipmentDetail.linkedViolations")} ({violations.length})</h3></div>
              {violations.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{t("equipmentDetail.noViolations")}</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader><TableRow><TableHead>{t("equipmentDetail.colDoc")}</TableHead><TableHead>{t("equipmentDetail.colType")}</TableHead><TableHead>{t("equipmentDetail.colEmployee")}</TableHead><TableHead>{t("equipmentDetail.colStatus")}</TableHead><TableHead>{t("equipmentDetail.colDate")}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {violations.map((v) => (
                        <TableRow key={v.id}><TableCell dir="ltr" className="font-mono text-xs">{v.documentNo || "-"}</TableCell><TableCell>{v.violationType || "-"}</TableCell><TableCell>{v.employeeName}</TableCell><TableCell><Badge variant="outline">{statusLabels[v.status || ""] || v.status || "-"}</Badge></TableCell><TableCell dir="ltr" className="font-mono text-xs">{v.violationDate || "-"}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* الحوادث */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><AlertTriangle className="size-4 text-muted-foreground" /><h3 className="text-sm font-semibold text-foreground">{t("equipmentDetail.linkedIncidents")} ({incidents.length})</h3></div>
              {incidents.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{t("equipmentDetail.noIncidents")}</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader><TableRow><TableHead>{t("equipmentDetail.colDoc")}</TableHead><TableHead>{t("equipmentDetail.colTitle")}</TableHead><TableHead>{t("equipmentDetail.colSeverity")}</TableHead><TableHead>{t("equipmentDetail.colStatus")}</TableHead><TableHead>{t("equipmentDetail.colDate")}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {incidents.map((c) => (
                        <TableRow key={c.id}><TableCell dir="ltr" className="font-mono text-xs">{c.documentNo || "-"}</TableCell><TableCell>{c.title}</TableCell><TableCell>{severityLabels[c.severity || ""] || c.severity || "-"}</TableCell><TableCell><Badge variant="outline">{statusLabels[c.status || ""] || c.status || "-"}</Badge></TableCell><TableCell dir="ltr" className="font-mono text-xs">{c.incidentDate || "-"}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* التفتيش */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><ClipboardCheck className="size-4 text-muted-foreground" /><h3 className="text-sm font-semibold text-foreground">{t("equipmentDetail.linkedInspections")} ({inspections.length})</h3></div>
              {inspections.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{t("equipmentDetail.noInspections")}</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader><TableRow><TableHead>{t("equipmentDetail.colTitle")}</TableHead><TableHead>{t("equipmentDetail.colCompliance")}</TableHead><TableHead>{t("equipmentDetail.colStatus")}</TableHead><TableHead>{t("equipmentDetail.colDate")}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {inspections.map((s) => (
                        <TableRow key={s.id}><TableCell>{s.title}</TableCell><TableCell dir="ltr">{s.compliance != null ? `${s.compliance}%` : "-"}</TableCell><TableCell><Badge variant="outline">{statusLabels[s.status || ""] || s.status || "-"}</Badge></TableCell><TableCell dir="ltr" className="font-mono text-xs">{s.inspectionDate || "-"}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notes">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t("equipmentReg.fNotes")}</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{item.notes || t("equipmentDetail.noNotes")}</p>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  )
}
