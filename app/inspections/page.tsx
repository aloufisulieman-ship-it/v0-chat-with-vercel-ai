import { ClipboardCheck, Gauge, AlertCircle, TrendingUp } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getInspections, createInspection, deleteInspection } from "@/app/actions/hse"
import { inspectionStatusOptions } from "@/lib/labels"
import { getServerT } from "@/lib/i18n/server"
import { statusLabel } from "@/lib/i18n/labels"
import { cn } from "@/lib/utils"

type Inspection = Awaited<ReturnType<typeof getInspections>>[number]

function ScoreBar({ score }: { score: number }) {
  const tone = score >= 90 ? "bg-primary" : score >= 75 ? "bg-accent" : "bg-destructive"
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-foreground">{score}%</span>
    </div>
  )
}

export default async function InspectionsPage() {
  const user = await requireModule("inspections")
  const inspections = await getInspections()
  const { t } = await getServerT()

  const fields: FieldDef[] = [
    { name: "title", label: t("inspectionsMod.fType"), required: true, full: true, placeholder: t("inspectionsMod.fTypePlaceholder") },
    { name: "area", label: t("inspectionsMod.fArea"), placeholder: t("inspectionsMod.fAreaPlaceholder") },
    { name: "inspector", label: t("inspectionsMod.fInspector") },
    { name: "compliance", label: t("inspectionsMod.fCompliancePct"), type: "number", min: 0, max: 100, defaultValue: 100 },
    { name: "findings", label: t("inspectionsMod.fFindings"), type: "number", min: 0, defaultValue: 0 },
    { name: "status", label: t("inspectionsMod.fStatus"), type: "select", options: inspectionStatusOptions.map((o) => ({ value: o.value, label: statusLabel(t, o.value) })) },
    { name: "inspectionDate", label: t("inspectionsMod.fDate"), type: "date" },
  ]

  const avg = inspections.length ? Math.round(inspections.reduce((a, b) => a + (b.compliance ?? 0), 0) / inspections.length) : 0
  const findings = inspections.reduce((a, b) => a + (b.findings ?? 0), 0)
  const open = inspections.filter((i) => i.status !== "closed").length

  const columns: Column<Inspection>[] = [
    { key: "title", header: t("inspectionsMod.fType"), render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    { key: "area", header: t("inspectionsMod.fArea"), render: (r) => <span className="text-muted-foreground">{r.area || "-"}</span> },
    { key: "inspector", header: t("inspectionsMod.fInspector"), render: (r) => <span className="text-muted-foreground">{r.inspector || "-"}</span> },
    { key: "compliance", header: t("inspectionsMod.fComplianceCol"), render: (r) => <ScoreBar score={r.compliance ?? 0} /> },
    { key: "findings", header: t("inspectionsMod.fFindingsCol"), className: "text-center" },
    { key: "status", header: t("inspectionsMod.fStatus"), render: (r) => <StatusBadge status={r.status ?? "scheduled"} /> },
    { key: "inspectionDate", header: t("inspectionsMod.fDateCol"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.inspectionDate ?? "-"}</span> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="inspections"
            recordId={r.id}
            title={r.title}
            subtitle={t("inspectionsMod.detailsSubtitle")}
            fields={[
              { label: t("inspectionsMod.fType"), value: r.title },
              { label: t("inspectionsMod.fArea"), value: r.area || "-" },
              { label: t("inspectionsMod.fInspector"), value: r.inspector || "-" },
              { label: t("inspectionsMod.fCompliance"), value: `${r.compliance ?? 0}%` },
              { label: t("inspectionsMod.fFindings"), value: String(r.findings ?? 0) },
              { label: t("inspectionsMod.fStatus"), value: r.status ? statusLabel(t, r.status) : "-" },
              { label: t("inspectionsMod.fDate"), value: r.inspectionDate ?? "-" },
            ]}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={deleteInspection} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.inspectionsTitle")}
      subtitle={t("pageHeaders.inspectionsSubtitle")}
      user={user}
      action={<RecordDialog title={t("inspectionsMod.dialogTitle")} description={t("inspectionsMod.dialogDesc")} triggerLabel={t("inspectionsMod.trigger")} fields={fields} action={createInspection} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("inspectionsMod.kpiTotal")} value={inspections.length} icon={ClipboardCheck} tone="blue" />
        <KpiCard label={t("inspectionsMod.kpiAvg")} value={avg} unit="%" icon={Gauge} tone="primary" />
        <KpiCard label={t("inspectionsMod.kpiFindings")} value={findings} icon={AlertCircle} tone="accent" />
        <KpiCard label={t("inspectionsMod.kpiOpen")} value={open} icon={TrendingUp} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("inspectionsMod.registryTitle")}</h2>
        <DataTable columns={columns} rows={inspections} emptyMessage={t("inspectionsMod.emptyMessage")} />
      </div>
    </AppShell>
  )
}
