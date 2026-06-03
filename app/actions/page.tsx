import { CheckSquare, Clock, AlertTriangle, ListChecks } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge, SeverityBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireUser } from "@/lib/session"
import { getActions, createAction, deleteAction } from "@/app/actions/hse"
import { statusOptions, severityOptions, severityLabels, statusLabels } from "@/lib/labels"

type ActionItem = Awaited<ReturnType<typeof getActions>>[number]

const fields: FieldDef[] = [
  { name: "title", label: "وصف الإجراء", required: true, full: true, placeholder: "مثال: استبدال طفاية الحريق المنتهية" },
  { name: "source", label: "المصدر", placeholder: "مثال: تفتيش / حادثة" },
  { name: "assignedTo", label: "المسؤول" },
  { name: "priority", label: "الأولوية", type: "select", options: severityOptions },
  { name: "status", label: "الحالة", type: "select", options: statusOptions },
  { name: "dueDate", label: "تاريخ الاستحقاق", type: "date" },
]

export default async function ActionsPage() {
  const user = await requireUser()
  const actions = await getActions()

  const overdue = actions.filter((a) => a.status === "overdue").length
  const inProgress = actions.filter((a) => a.status === "in_progress").length
  const open = actions.filter((a) => a.status === "open").length

  const columns: Column<ActionItem>[] = [
    { key: "title", header: "الإجراء", render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    { key: "source", header: "المصدر", render: (r) => <span className="text-muted-foreground">{r.source || "-"}</span> },
    { key: "assignedTo", header: "المسؤول", render: (r) => <span className="text-muted-foreground">{r.assignedTo || "-"}</span> },
    { key: "priority", header: "الأولوية", render: (r) => <SeverityBadge severity={r.priority ?? "medium"} /> },
    { key: "dueDate", header: "الاستحقاق", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.dueDate ?? "-"}</span> },
    { key: "status", header: "الحالة", render: (r) => <StatusBadge status={r.status ?? "open"} /> },
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
            subtitle="إجراء تصحيحي"
            fields={[
              { label: "وصف الإجراء", value: r.title },
              { label: "المصدر", value: r.source || "-" },
              { label: "المسؤول", value: r.assignedTo || "-" },
              { label: "الأولوية", value: severityLabels[r.priority ?? ""] ?? "-" },
              { label: "تاريخ الاستحقاق", value: r.dueDate ?? "-" },
              { label: "الحالة", value: statusLabels[r.status ?? ""] ?? "-" },
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
      title="الإجراءات التصحيحية"
      subtitle="متابعة الإجراءات التصحيحية والوقائية (CAPA) حتى الإغلاق"
      user={user}
      action={<RecordDialog title="إجراء تصحيحي جديد" description="سجّل إجراءً تصحيحياً." triggerLabel="إجراء جديد" fields={fields} action={createAction} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="إجمالي الإجراءات" value={actions.length} icon={ListChecks} tone="blue" />
        <KpiCard label="قيد المعالجة" value={inProgress} icon={Clock} tone="accent" />
        <KpiCard label="مفتوحة" value={open} icon={CheckSquare} tone="primary" />
        <KpiCard label="متأخرة" value={overdue} icon={AlertTriangle} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">قائمة الإجراءات</h2>
        <DataTable columns={columns} rows={actions} emptyMessage="لا توجد إجراءات. أضف إجراءً جديداً للبدء." />
      </div>
    </AppShell>
  )
}
