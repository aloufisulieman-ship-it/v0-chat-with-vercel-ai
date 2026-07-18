import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getViolations, getEmployees, deleteViolation } from "@/app/actions/hse"
import { statusLabels } from "@/lib/labels"
import { categoryLabels } from "@/lib/violation-category"
import { effectiveViolationStatus, isViolationClosed } from "@/lib/violation-status"
import { FileWarning, Clock, CheckCircle2 } from "lucide-react"
import { MissingOriginalField } from "@/components/missing-original-field"
import { HrStatusBadge } from "@/components/hr-status-badge"
import { HrClosureBlock } from "@/components/hr-closure-block"
import { FinanceStatusBadge } from "@/components/finance-status-badge"
import { FinanceClosureBlock } from "@/components/finance-closure-block"
import { EntryModeBadge } from "@/components/entry-mode-badge"
import { ViolationFormDialog } from "./violation-form"
import { ViolationEditDialog } from "./violation-edit-dialog"

// النص الظاهر في نافذة التفاصيل للحقول غير الموجودة أصلاً بالسجل المستورد.
const NOT_IN_SOURCE = "غير متوفر بالسجل الأصلي"

type Violation = Awaited<ReturnType<typeof getViolations>>[number]

async function handleDelete(id: number) {
  "use server"
  await deleteViolation(id)
}

export default async function ViolationsPage() {
  const user = await requireModule("violations")
  const [violations, employees] = await Promise.all([getViolations(), getEmployees()])
  const isAdmin = user.role === "admin"

  // العدادات تعتمد الحالة الفعلية (وفق مسار الإحالة) لا الحالة المخزّنة.
  const closed = violations.filter((v) => isViolationClosed(v)).length
  const open = violations.length - closed

  const columns: Column<Violation>[] = [
    { key: "employeeName", header: "الموظف", render: (r) => <span className="font-medium">{r.employeeName}</span> },
    { key: "employeeNo", header: "الرقم الوظيفي", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.employeeNo || "-"}</span> },
    { key: "description", header: "وصف المخالفة", render: (r) => r.description ? <span className="text-muted-foreground line-clamp-1 max-w-xs">{r.description}</span> : <MissingOriginalField value={null} /> },
    { key: "place", header: "المكان", render: (r) => <MissingOriginalField value={r.place} /> },
    { key: "violationDate", header: "التاريخ", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.violationDate ?? "-"}</span> },
    { key: "status", header: "الحالة", render: (r) => <StatusBadge status={effectiveViolationStatus(r)} /> },
    { key: "entryMode", header: "المصدر", render: (r) => <EntryModeBadge entryMode={r.entryMode} /> },
    {
      key: "referral", header: "الإحالة",
      render: (r) =>
        r.category === "external" ? (
          <FinanceStatusBadge financeStatus={r.financeStatus} />
        ) : (
          <HrStatusBadge hrStatus={r.hrStatus} />
        ),
    },
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
              { label: "نوع المخالفة", value: r.violationType || "-" },
              { label: "التصنيف", value: categoryLabels[r.category ?? "internal"] ?? "-" },
              { label: "الإجراء الداخلي", value: r.internalAction || "-" },
              { label: "التاريخ", value: r.violationDate ?? "-" },
              { label: "الوقت", value: r.violationTime || "-" },
              { label: "المكان", value: r.place || NOT_IN_SOURCE },
              { label: "وصف المخالفة", value: r.description || NOT_IN_SOURCE },
              { label: "الشهود", value: r.witnesses || "-" },
              { label: "الإجراء المقترح", value: r.proposedAction || "-" },
              { label: "الحالة", value: statusLabels[effectiveViolationStatus(r)] ?? "-" },
            ]}
            signatures={[
              { label: "توقيع المخالف", value: r.violatorSignature || "" },
              { label: "توقيع المُبلِّغ / المشرف", value: r.editorSignature || "" },
              { label: "توقيع مدير السلامة", value: r.managerSignature || "" },
            ]}
            initialAttachments={[]}
            extraSection={
              r.category === "external" ? (
                <FinanceClosureBlock
                  financeStatus={r.financeStatus}
                  settlementNumber={r.settlementNumber}
                  closedBy={r.financeClosedBy}
                  closedAt={r.financeClosedAt}
                  receiptUrl={r.paymentReceiptUrl}
                />
              ) : (
                <HrClosureBlock
                  hrStatus={r.hrStatus}
                  hrAction={r.hrAction}
                  hrActionDate={r.hrActionDate}
                  closedBy={r.hrClosedBy}
                  closedAt={r.hrClosedAt}
                  attachmentsRaw={r.hrAttachmentUrl}
                />
              )
            }
          />
          {isAdmin && <ViolationEditDialog violation={r} />}
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
      action={<ViolationFormDialog employees={employees} />}
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
