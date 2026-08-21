import { CheckSquare, Clock, AlertTriangle, ListChecks } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge, SeverityBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getActions, createAction, deleteAction } from "@/app/actions/hse"
import { statusOptions, severityOptions } from "@/lib/labels"
import { getServerT } from "@/lib/i18n/server"
import { statusLabel, severityLabel } from "@/lib/i18n/labels"

type ActionItem = Awaited<ReturnType<typeof getActions>>[number]

export default async function ActionsPage() {
  const user = await requireModule("actions")
  const actions = await getActions()
  const { t } = await getServerT()

  const fields: FieldDef[] = [
    { name: "title", label: t("actionsMod.fTitle"), required: true, full: true, placeholder: t("actionsMod.fTitlePlaceholder") },
    { name: "source", label: t("actionsMod.fSource"), placeholder: t("actionsMod.fSourcePlaceholder") },
    { name: "assignedTo", label: t("actionsMod.fAssignedTo") },
    { name: "priority", label: t("actionsMod.fPriority"), type: "select", options: severityOptions.map((o) => ({ value: o.value, label: severityLabel(t, o.value) })) },
    { name: "status", label: t("actionsMod.fStatus"), type: "select", options: statusOptions.map((o) => ({ value: o.value, label: statusLabel(t, o.value) })) },
    { name: "dueDate", label: t("actionsMod.fDueDate"), type: "date" },
  ]

  const overdue = actions.filter((a) => a.status === "overdue").length
  const inProgress = actions.filter((a) => a.status === "in_progress").length
  const open = actions.filter((a) => a.status === "open").length

  const columns: Column<ActionItem>[] = [
    { key: "title", header: t("actionsMod.colAction"), render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    { key: "source", header: t("actionsMod.fSource"), render: (r) => <span className="text-muted-foreground">{r.source || "-"}</span> },
    { key: "assignedTo", header: t("actionsMod.fAssignedTo"), render: (r) => <span className="text-muted-foreground">{r.assignedTo || "-"}</span> },
    { key: "priority", header: t("actionsMod.fPriority"), render: (r) => <SeverityBadge severity={r.priority ?? "medium"} /> },
    { key: "dueDate", header: t("actionsMod.fDueDateCol"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.dueDate ?? "-"}</span> },
    { key: "status", header: t("actionsMod.fStatus"), render: (r) => <StatusBadge status={r.status ?? "open"} /> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="actions"
            recordId={r.id}
            title={r.title}
            subtitle={t("actionsMod.detailsSubtitle")}
            fields={[
              { label: t("actionsMod.fTitle"), value: r.title },
              { label: t("actionsMod.fSource"), value: r.source || "-" },
              { label: t("actionsMod.fAssignedTo"), value: r.assignedTo || "-" },
              { label: t("actionsMod.fPriority"), value: r.priority ? severityLabel(t, r.priority) : "-" },
              { label: t("actionsMod.fDueDate"), value: r.dueDate ?? "-" },
              { label: t("actionsMod.fStatus"), value: r.status ? statusLabel(t, r.status) : "-" },
            ]}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={deleteAction} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.actionsTitle")}
      subtitle={t("pageHeaders.actionsSubtitle")}
      user={user}
      action={<RecordDialog title={t("actionsMod.dialogTitle")} description={t("actionsMod.dialogDesc")} triggerLabel={t("actionsMod.trigger")} fields={fields} action={createAction} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("actionsMod.kpiTotal")} value={actions.length} icon={ListChecks} tone="blue" />
        <KpiCard label={t("actionsMod.kpiInProgress")} value={inProgress} icon={Clock} tone="accent" />
        <KpiCard label={t("actionsMod.kpiOpen")} value={open} icon={CheckSquare} tone="primary" />
        <KpiCard label={t("actionsMod.kpiOverdue")} value={overdue} icon={AlertTriangle} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("actionsMod.registryTitle")}</h2>
        <DataTable columns={columns} rows={actions} emptyMessage={t("actionsMod.emptyMessage")} />
      </div>
    </AppShell>
  )
}
