import { ClipboardCheck, CircleCheck, Loader, TriangleAlert } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { DeleteButton } from "@/components/delete-button"
import { IsoClauseBadge } from "@/components/iso-clause-badge"
import { requireModule } from "@/lib/session"
import { getInternalAudits, createInternalAudit, deleteInternalAudit } from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"

type Audit = Awaited<ReturnType<typeof getInternalAudits>>[number]

export default async function InternalAuditPage() {
  const user = await requireModule("internal-audit")
  const rows = await getInternalAudits()
  const { t, locale } = await getServerT()

  const statusOptions = [
    { value: "planned", label: t("internalAuditMod.statusPlanned") },
    { value: "in_progress", label: t("internalAuditMod.statusInProgress") },
    { value: "completed", label: t("internalAuditMod.statusCompleted") },
  ]

  const fields: FieldDef[] = [
    { name: "title", label: t("internalAuditMod.fTitle"), required: true, full: true, placeholder: t("internalAuditMod.fTitlePlaceholder") },
    { name: "scope", label: t("internalAuditMod.fScope"), full: true, placeholder: t("internalAuditMod.fScopePlaceholder") },
    { name: "auditor", label: t("internalAuditMod.fAuditor"), placeholder: t("internalAuditMod.fAuditorPlaceholder") },
    { name: "auditDate", label: t("internalAuditMod.fDate"), type: "date" },
    { name: "nonconformities", label: t("internalAuditMod.fNonconformities"), type: "number", min: 0, defaultValue: 0 },
    { name: "status", label: t("internalAuditMod.fStatus"), type: "select", options: statusOptions },
    { name: "result", label: t("internalAuditMod.fResult"), type: "textarea", full: true, placeholder: t("internalAuditMod.fResultPlaceholder") },
  ]

  const completed = rows.filter((r) => r.status === "completed").length
  const inProgress = rows.filter((r) => r.status === "in_progress").length
  const totalNC = rows.reduce((a, r) => a + (r.nonconformities ?? 0), 0)

  const columns: Column<Audit>[] = [
    {
      key: "title",
      header: t("internalAuditMod.fTitle"),
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{r.title}</span>
          {r.scope ? <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{r.scope}</span> : null}
        </div>
      ),
    },
    { key: "auditor", header: t("internalAuditMod.fAuditor"), render: (r) => <span className="text-muted-foreground">{r.auditor || "-"}</span> },
    { key: "auditDate", header: t("internalAuditMod.fDate"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.auditDate ?? "-"}</span> },
    {
      key: "nonconformities",
      header: t("internalAuditMod.fNonconformities"),
      render: (r) => {
        const n = r.nonconformities ?? 0
        return <span className={`font-mono text-sm font-semibold ${n > 0 ? "text-destructive" : "text-muted-foreground"}`} dir="ltr">{n}</span>
      },
    },
    { key: "status", header: t("internalAuditMod.fStatus"), render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end">
          <DeleteButton id={r.id} action={deleteInternalAudit} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.internalAuditTitle")}
      subtitle={t("pageHeaders.internalAuditSubtitle")}
      user={user}
      action={<RecordDialog title={t("internalAuditMod.dialogTitle")} description={t("internalAuditMod.dialogDesc")} triggerLabel={t("internalAuditMod.trigger")} fields={fields} action={createInternalAudit} />}
    >
      <IsoClauseBadge ids={["9.2", "9.2.1", "9.2.2"]} locale={locale} className="mb-4" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("internalAuditMod.kpiTotal")} value={rows.length} icon={ClipboardCheck} tone="blue" />
        <KpiCard label={t("internalAuditMod.kpiCompleted")} value={completed} icon={CircleCheck} tone="primary" />
        <KpiCard label={t("internalAuditMod.kpiInProgress")} value={inProgress} icon={Loader} tone="accent" />
        <KpiCard label={t("internalAuditMod.kpiNonconformities")} value={totalNC} icon={TriangleAlert} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("internalAuditMod.registryTitle")}</h2>
        <DataTable columns={columns} rows={rows} emptyMessage={t("internalAuditMod.emptyMessage")} />
      </div>
    </AppShell>
  )
}
