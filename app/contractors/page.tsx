import { HardHat, CircleCheck, CircleAlert, Star } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { DeleteButton } from "@/components/delete-button"
import { IsoClauseBadge } from "@/components/iso-clause-badge"
import { requireModule } from "@/lib/session"
import { getContractors, createContractor, deleteContractor } from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"

type Contractor = Awaited<ReturnType<typeof getContractors>>[number]

export default async function ContractorsPage() {
  const user = await requireModule("contractors")
  const rows = await getContractors()
  const { t, locale } = await getServerT()

  const statusOptions = [
    { value: "approved", label: t("contractorsMod.statusApproved") },
    { value: "conditional", label: t("contractorsMod.statusConditional") },
    { value: "rejected", label: t("contractorsMod.statusRejected") },
  ]

  const fields: FieldDef[] = [
    { name: "name", label: t("contractorsMod.fName"), required: true, full: true, placeholder: t("contractorsMod.fNamePlaceholder") },
    { name: "scope", label: t("contractorsMod.fScope"), full: true, placeholder: t("contractorsMod.fScopePlaceholder") },
    { name: "hseRating", label: t("contractorsMod.fRating"), type: "number", min: 0, max: 100, defaultValue: 0 },
    { name: "status", label: t("contractorsMod.fStatus"), type: "select", options: statusOptions },
    { name: "evaluationDate", label: t("contractorsMod.fEvalDate"), type: "date" },
  ]

  const approved = rows.filter((r) => r.status === "approved").length
  const conditional = rows.filter((r) => r.status === "conditional").length
  const avgRating = rows.length ? Math.round(rows.reduce((a, r) => a + (r.hseRating ?? 0), 0) / rows.length) : 0

  const columns: Column<Contractor>[] = [
    {
      key: "name",
      header: t("contractorsMod.fName"),
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{r.name}</span>
          {r.scope ? <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{r.scope}</span> : null}
        </div>
      ),
    },
    {
      key: "hseRating",
      header: t("contractorsMod.fRating"),
      render: (r) => {
        const p = Math.max(0, Math.min(100, r.hseRating ?? 0))
        const tone = p >= 80 ? "bg-primary" : p >= 50 ? "bg-accent" : "bg-destructive"
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${tone}`} style={{ width: `${p}%` }} />
            </div>
            <span className="font-mono text-xs text-muted-foreground" dir="ltr">{p}</span>
          </div>
        )
      },
    },
    { key: "evaluationDate", header: t("contractorsMod.fEvalDate"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.evaluationDate ?? "-"}</span> },
    { key: "status", header: t("contractorsMod.fStatus"), render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end">
          <DeleteButton id={r.id} action={deleteContractor} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.contractorsTitle")}
      subtitle={t("pageHeaders.contractorsSubtitle")}
      user={user}
      action={<RecordDialog title={t("contractorsMod.dialogTitle")} description={t("contractorsMod.dialogDesc")} triggerLabel={t("contractorsMod.trigger")} fields={fields} action={createContractor} />}
    >
      <IsoClauseBadge ids={["8.1.4", "8.1.4.2"]} locale={locale} className="mb-4" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("contractorsMod.kpiTotal")} value={rows.length} icon={HardHat} tone="blue" />
        <KpiCard label={t("contractorsMod.kpiApproved")} value={approved} icon={CircleCheck} tone="primary" />
        <KpiCard label={t("contractorsMod.kpiConditional")} value={conditional} icon={CircleAlert} tone="accent" />
        <KpiCard label={t("contractorsMod.kpiAvgRating")} value={avgRating} icon={Star} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("contractorsMod.registryTitle")}</h2>
        <DataTable columns={columns} rows={rows} emptyMessage={t("contractorsMod.emptyMessage")} />
      </div>
    </AppShell>
  )
}
