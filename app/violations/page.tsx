import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getViolations, deleteViolation } from "@/app/actions/hse"
import { statusLabels } from "@/lib/labels"
import { FileWarning, Clock, CheckCircle2 } from "lucide-react"
import { ViolationFormDialog } from "./violation-form"

type Violation = Awaited<ReturnType<typeof getViolations>>[number]

async function handleDelete(id: number) {
  "use server"
  await deleteViolation(id)
}

export default async function ViolationsPage() {
  const user = await requireModule("violations")
  const violations = await getViolations()

  const open = violations.filter((v) => v.status === "open" || v.status === "in_progress").length
  const closed = violations.filter((v) => v.status === "closed").length

  const columns: Column<Violation>[] = [
    { key: "employeeName", header: "الموظف", render: (r) => <span className="font-medium">{r.employeeName}</span> },
    { key: "employeeNo", header: "الرقم الوظيفي", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.employeeNo || "-"}</span> },
    { key: "description", header: "وصف المخالفة", render: (r) => <span className="text-muted-foreground line-clamp-1 max-w-xs">{r.description || "-"}</span> },
    { key: "place", header: "المكان", render: (r) => <span className="text-muted-foreground">{r.place || "-"}</span> },
    { key: "violationDate", header: "التاريخ", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.violationDate ?? "-"}</span> },
    { key: "status", header: "الحالة", render: (r) => <StatusBadge status={r.status ?? "open"} /> },
    {
      key: "actions", header: "", className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="violations"
            recordId={r.id}
            title={`مخالفة: ${r.employeeName}`}
            subtitle="نموذج مخالفة رسمي"
            documentNo={r.documentNo ?? "MHS-IMS-PR-HSE-647"}
            fields={[
              { label: "اسم الموظف", value: r.employeeName },
              { label: "الرقم الوظيفي", value: r.employeeNo || "-" },
              { label: "اسم الشركة", value: r.companyName || "-" },
              { label: "التاريخ", value: r.violationDate ?? "-" },
              { label: "الوقت", value: r.violationTime || "-" },
              { label: "المكان", value: r.place || "-" },
              { label: "وصف المخالفة", value: r.description || "-" },
              { label: "الشهود", value: r.witnesses || "-" },
              { label: "الإجراء المقترح", value: r.proposedAction || "-" },
              { label: "الحالة", value: statusLabels[r.status ?? ""] ?? "-" },
            ]}
            signatures={[
              { label: "توقيع المخالف", value: r.violatorSignature || "" },
              { label: "توقيع المُبلِّغ / المشرف", value: r.editorSignature || "" },
              { label: "توقيع مدير السلامة", value: r.managerSignature || "" },
            ]}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={handleDelete} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title="إدارة المخالفات"
      subtitle="تسجيل ومتابعة المخالفات وفق النموذج الرسمي (MHS-IMS-PR-HSE-647)"
      user={user}
      action={<ViolationFormDialog />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="إجمالي المخالفات" value={violations.length} icon={FileWarning} tone="blue" />
        <KpiCard label="مفتوحة / قيد المعالجة" value={open} icon={Clock} tone="accent" />
        <KpiCard label="مغلقة" value={closed} icon={CheckCircle2} tone="primary" />
      </div>
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">سجل المخالفات</h2>
        <DataTable columns={columns} rows={violations} emptyMessage="لا توجد مخالفات مسجلة." />
      </div>
    </AppShell>
  )
}
