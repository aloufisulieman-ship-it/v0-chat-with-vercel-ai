import { Siren, ShieldAlert, CalendarClock, CircleCheck } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { DeleteButton } from "@/components/delete-button"
import { IsoClauseBadge } from "@/components/iso-clause-badge"
import { requireModule } from "@/lib/session"
import { getEmergencyPlans, createEmergencyPlan, deleteEmergencyPlan } from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"

type Plan = Awaited<ReturnType<typeof getEmergencyPlans>>[number]

export default async function EmergencyPage() {
  const user = await requireModule("emergency")
  const rows = await getEmergencyPlans()
  const { t, locale } = await getServerT()

  const typeOptions = [
    { value: "fire", label: t("emergencyMod.typeFire") },
    { value: "chemical", label: t("emergencyMod.typeChemical") },
    { value: "medical", label: t("emergencyMod.typeMedical") },
    { value: "evacuation", label: t("emergencyMod.typeEvacuation") },
    { value: "natural", label: t("emergencyMod.typeNatural") },
  ]
  const statusOptions = [
    { value: "ready", label: t("emergencyMod.statusReady") },
    { value: "needs_review", label: t("emergencyMod.statusNeedsReview") },
    { value: "outdated", label: t("emergencyMod.statusOutdated") },
  ]

  const fields: FieldDef[] = [
    { name: "scenario", label: t("emergencyMod.fScenario"), required: true, full: true, placeholder: t("emergencyMod.fScenarioPlaceholder") },
    { name: "planType", label: t("emergencyMod.fType"), type: "select", options: typeOptions },
    { name: "status", label: t("emergencyMod.fStatus"), type: "select", options: statusOptions },
    { name: "responsibleTeam", label: t("emergencyMod.fTeam"), placeholder: t("emergencyMod.fTeamPlaceholder") },
    { name: "lastDrillDate", label: t("emergencyMod.fLastDrill"), type: "date" },
    { name: "nextDrillDate", label: t("emergencyMod.fNextDrill"), type: "date" },
  ]

  const ready = rows.filter((r) => r.status === "ready").length
  const needsReview = rows.filter((r) => r.status !== "ready").length
  const today = new Date().toISOString().slice(0, 10)
  const overdueDrills = rows.filter((r) => r.nextDrillDate && r.nextDrillDate < today).length

  const typeLabel = (v: string) =>
    ({
      fire: t("emergencyMod.typeFire"),
      chemical: t("emergencyMod.typeChemical"),
      medical: t("emergencyMod.typeMedical"),
      evacuation: t("emergencyMod.typeEvacuation"),
      natural: t("emergencyMod.typeNatural"),
    })[v] ?? v

  const columns: Column<Plan>[] = [
    {
      key: "scenario",
      header: t("emergencyMod.fScenario"),
      render: (r) => <span className="font-medium text-foreground">{r.scenario}</span>,
    },
    {
      key: "planType",
      header: t("emergencyMod.fType"),
      render: (r) => (
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
          {typeLabel(r.planType)}
        </span>
      ),
    },
    { key: "responsibleTeam", header: t("emergencyMod.fTeam"), render: (r) => <span className="text-muted-foreground">{r.responsibleTeam || "-"}</span> },
    { key: "lastDrillDate", header: t("emergencyMod.fLastDrill"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.lastDrillDate ?? "-"}</span> },
    {
      key: "nextDrillDate",
      header: t("emergencyMod.fNextDrill"),
      render: (r) => {
        const overdue = r.nextDrillDate && r.nextDrillDate < today
        return <span className={`font-mono text-xs ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`} dir="ltr">{r.nextDrillDate ?? "-"}</span>
      },
    },
    { key: "status", header: t("emergencyMod.fStatus"), render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end">
          <DeleteButton id={r.id} action={deleteEmergencyPlan} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.emergencyTitle")}
      subtitle={t("pageHeaders.emergencySubtitle")}
      user={user}
      action={<RecordDialog title={t("emergencyMod.dialogTitle")} description={t("emergencyMod.dialogDesc")} triggerLabel={t("emergencyMod.trigger")} fields={fields} action={createEmergencyPlan} />}
    >
      <IsoClauseBadge ids={["8.2"]} locale={locale} className="mb-4" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("emergencyMod.kpiTotal")} value={rows.length} icon={Siren} tone="blue" />
        <KpiCard label={t("emergencyMod.kpiReady")} value={ready} icon={CircleCheck} tone="primary" />
        <KpiCard label={t("emergencyMod.kpiNeedsReview")} value={needsReview} icon={ShieldAlert} tone="accent" />
        <KpiCard label={t("emergencyMod.kpiOverdue")} value={overdueDrills} icon={CalendarClock} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("emergencyMod.registryTitle")}</h2>
        <DataTable columns={columns} rows={rows} emptyMessage={t("emergencyMod.emptyMessage")} />
      </div>
    </AppShell>
  )
}
