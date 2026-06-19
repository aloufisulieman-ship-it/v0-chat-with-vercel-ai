import { FileWarning, AlertCircle, CheckCircle2, Clock } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getViolations, deleteViolation } from "@/app/actions/hse"
import { ViolationFormDialog } from "./violation-form"
import { statusLabels } from "@/lib/labels"

type Violation = Awaited<ReturnType<typeof getViolations>>[number]

export default async function ViolationsPage() {
  const user = await requireModule("violations")
  const violations = await getViolations()

  const open = violations.filter((v) => v.status === "open" || v.status === "in_progress").length
  const closed = violations.filter((v) => v.status === "closed").length

  const columns: Column<Violation>[] = [
    {
      key: "documentNo",
      header: "رقم الوثيقة",
      render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.documentNo || "-"}</span>,
    },
    { key: "employeeName", header: "اسم الموظف", render: (r) => <span className="font-medium text-foreground">{r.employeeName}</span> },
    { key: "companyName", header: "الشركة", render: (r) => <span className="text-muted-foreground">{r.companyName || "-"}</span> },
    { key: "place", header: "المكان", render: (r) => <span className="text-muted-foreground">{r.place || "-"}</span> },
    {
      key: "violationDate",
      header: "التاريخ",
      render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.violationDate ?? "-"}</span>,
    },
    { key: "status", header: "الحالة", render: (r) => <StatusBadge status={r.status ?? "open"} /> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="violations"
            recordId={r.id}
            title={r.employeeName}
            subtitle="محضر مخالفة"
            fields={[
              { label: "رقم الوثيقة", value: r.documentNo || "-" },
              { label: "اسم الموظف", value: r.employeeName },
              { label: "الرقم الوظيفي", value: r.employeeNo || "-" },
              { label: "الجنسية", value: r.nationality || "-" },
              { label: "الشركة", value: r.companyName || "-" },
              { label: "تاريخ المخالفة", value: r.violationDate ?? "-" },
              { label: "وقت المخالفة", value: r.violationTime || "-" },
              { label: "المكان", value: r.place || "-" },
              { label: "وصف المخالفة", value: r.description || "-" },
              { label: "الشهود", value: r.witnesses || "-" },
              { label: "الإجراء المقترح", value: r.proposedAction || "-" },
              { label: "الحالة", value: statusLabels[r.status ?? ""] ?? "-" },
            ]}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={deleteViolation} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title="المخالفات"
      subtitle="تسجيل ومتابعة محاضر مخالفات السلامة"
      user={user}
      action={<ViolationFormDialog />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="إجمالي المخالفات" value={violations.length} icon={FileWarning} tone="blue" />
        <KpiCard label="مفتوحة / قيد المعالجة" value={open} icon={Clock} tone="accent" />
        <KpiCard label="مغلقة" value={closed} icon={CheckCircle2} tone="primary" />
        <KpiCard label="بحاجة لمتابعة" value={open} icon={AlertCircle} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">سجل المخالفات</h2>
        <DataTable columns={columns} rows={violations} emptyMessage="لا توجد مخالفات مسجلة. سجّل مخالفة جديدة للبدء." />
      </div>
    </AppShell>
  )
}
