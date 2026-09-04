import { Target, TrendingUp, CircleCheck, TriangleAlert } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { DeleteButton } from "@/components/delete-button"
import { IsoClauseBadge } from "@/components/iso-clause-badge"
import { requireModule } from "@/lib/session"
import { getObjectives, createObjective, deleteObjective } from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"

type Objective = Awaited<ReturnType<typeof getObjectives>>[number]

export default async function ObjectivesPage() {
  const user = await requireModule("objectives")
  const objectives = await getObjectives()
  const { t, locale } = await getServerT()

  const statusOptions = [
    { value: "not_started", label: t("objectivesMod.statusNotStarted") },
    { value: "on_track", label: t("objectivesMod.statusOnTrack") },
    { value: "at_risk", label: t("objectivesMod.statusAtRisk") },
    { value: "achieved", label: t("objectivesMod.statusAchieved") },
  ]

  const fields: FieldDef[] = [
    { name: "title", label: t("objectivesMod.fTitle"), required: true, full: true, placeholder: t("objectivesMod.fTitlePlaceholder") },
    { name: "indicator", label: t("objectivesMod.fIndicator"), placeholder: t("objectivesMod.fIndicatorPlaceholder") },
    { name: "responsible", label: t("objectivesMod.fResponsible") },
    { name: "baseline", label: t("objectivesMod.fBaseline") },
    { name: "target", label: t("objectivesMod.fTarget") },
    { name: "progress", label: t("objectivesMod.fProgress"), type: "number", min: 0, max: 100, defaultValue: 0 },
    { name: "status", label: t("objectivesMod.fStatus"), type: "select", options: statusOptions },
    { name: "dueDate", label: t("objectivesMod.fDueDate"), type: "date" },
  ]

  const achieved = objectives.filter((o) => o.status === "achieved").length
  const atRisk = objectives.filter((o) => o.status === "at_risk").length
  const avgProgress = objectives.length
    ? Math.round(objectives.reduce((a, o) => a + (o.progress ?? 0), 0) / objectives.length)
    : 0

  const columns: Column<Objective>[] = [
    {
      key: "title",
      header: t("objectivesMod.colObjective"),
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{r.title}</span>
          {r.indicator ? <span className="text-xs text-muted-foreground">{r.indicator}</span> : null}
        </div>
      ),
    },
    { key: "responsible", header: t("objectivesMod.fResponsible"), render: (r) => <span className="text-muted-foreground">{r.responsible || "-"}</span> },
    {
      key: "target",
      header: t("objectivesMod.targetVsBaseline"),
      render: (r) => (
        <span className="text-xs text-muted-foreground" dir="ltr">
          {(r.baseline || "-") + " → " + (r.target || "-")}
        </span>
      ),
    },
    {
      key: "progress",
      header: t("objectivesMod.fProgress"),
      render: (r) => {
        const p = Math.max(0, Math.min(100, r.progress ?? 0))
        const tone = p >= 100 ? "bg-primary" : p >= 50 ? "bg-accent" : "bg-destructive"
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${tone}`} style={{ width: `${p}%` }} />
            </div>
            <span className="font-mono text-xs text-muted-foreground" dir="ltr">{p}%</span>
          </div>
        )
      },
    },
    { key: "dueDate", header: t("objectivesMod.fDueDate"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.dueDate ?? "-"}</span> },
    { key: "status", header: t("objectivesMod.fStatus"), render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end">
          <DeleteButton id={r.id} action={deleteObjective} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.objectivesTitle")}
      subtitle={t("pageHeaders.objectivesSubtitle")}
      user={user}
      action={<RecordDialog title={t("objectivesMod.dialogTitle")} description={t("objectivesMod.dialogDesc")} triggerLabel={t("objectivesMod.trigger")} fields={fields} action={createObjective} />}
    >
      <IsoClauseBadge ids={["6.2", "6.2.1", "6.2.2"]} locale={locale} className="mb-4" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("objectivesMod.kpiTotal")} value={objectives.length} icon={Target} tone="blue" />
        <KpiCard label={t("objectivesMod.kpiAchieved")} value={achieved} icon={CircleCheck} tone="primary" />
        <KpiCard label={t("objectivesMod.kpiAtRisk")} value={atRisk} icon={TriangleAlert} tone="destructive" />
        <KpiCard label={t("objectivesMod.kpiAvgProgress")} value={`${avgProgress}%`} icon={TrendingUp} tone="accent" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("objectivesMod.registryTitle")}</h2>
        <DataTable columns={columns} rows={objectives} emptyMessage={t("objectivesMod.emptyMessage")} />
      </div>
    </AppShell>
  )
}
