import { Siren, AlertTriangle, CheckCircle2, Clock } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge, SeverityBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getNearMisses, createNearMiss, deleteNearMiss } from "@/app/actions/hse"
import {
  severityOptions,
  severityLabels,
  statusLabels,
  nearMissStatusOptions,
  nearMissCategoryOptions,
  nearMissCategoryLabels,
} from "@/lib/labels"

type NearMiss = Awaited<ReturnType<typeof getNearMisses>>[number]

const fields: FieldDef[] = [
  { name: "missDate", label: "التاريخ", type: "date" },
  { name: "missTime", label: "الوقت", type: "text", placeholder: "مثال: 14:30" },
  { name: "location", label: "الموقع", placeholder: "مثال: مستودع المواد الخام" },
  { name: "department", label: "القسم", placeholder: "مثال: العمليات" },
  { name: "reportedBy", label: "المُبلِّغ" },
  { name: "category", label: "التصنيف", type: "select", options: nearMissCategoryOptions },
  { name: "severity", label: "الخطورة", type: "select", options: severityOptions },
  { name: "status", label: "الحالة", type: "select", options: nearMissStatusOptions },
  { name: "assignedTo", label: "مُسند إلى" },
  { name: "description", label: "ماذا حدث؟", type: "textarea", required: true, placeholder: "وصف الحادث الوشيك" },
  { name: "potentialConsequence", label: "ماذا كان يمكن أن يحدث؟", type: "textarea", placeholder: "العواقب المحتملة" },
  { name: "immediateAction", label: "الإجراء الفوري المتخذ", type: "textarea", placeholder: "الإجراء المتخذ في الموقع" },
]

export default async function NearMissPage() {
  const user = await requireModule("near-miss")
  const records = await getNearMisses()

  const open = records.filter((r) => r.status === "open" || r.status === "under_review").length
  const closed = records.filter((r) => r.status === "closed").length
  const critical = records.filter((r) => r.severity === "critical" || r.severity === "high").length

  const columns: Column<NearMiss>[] = [
    {
      key: "nearMissNumber",
      header: "الرقم",
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
          {r.nearMissNumber || "-"}
        </span>
      ),
    },
    {
      key: "description",
      header: "الوصف",
      render: (r) => <span className="font-medium text-foreground line-clamp-1">{r.description || "-"}</span>,
    },
    {
      key: "category",
      header: "التصنيف",
      render: (r) => <span className="text-muted-foreground">{nearMissCategoryLabels[r.category ?? ""] ?? "-"}</span>,
    },
    { key: "location", header: "الموقع", render: (r) => <span className="text-muted-foreground">{r.location || "-"}</span> },
    { key: "severity", header: "الخطورة", render: (r) => <SeverityBadge severity={r.severity ?? "low"} /> },
    { key: "status", header: "الحالة", render: (r) => <StatusBadge status={r.status ?? "open"} /> },
    {
      key: "missDate",
      header: "التاريخ",
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
          {r.missDate ?? "-"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="near-miss"
            recordId={r.id}
            title={r.description || "حادث وشيك"}
            subtitle="تقرير حادث وشيك"
            documentNo={r.nearMissNumber || undefined}
            fields={[
              { label: "رقم البلاغ", value: r.nearMissNumber || "-" },
              { label: "التاريخ", value: r.missDate ?? "-" },
              { label: "الوقت", value: r.missTime || "-" },
              { label: "الموقع", value: r.location || "-" },
              { label: "القسم", value: r.department || "-" },
              { label: "المُبلِّغ", value: r.reportedBy || "-" },
              { label: "التصنيف", value: nearMissCategoryLabels[r.category ?? ""] ?? "-" },
              { label: "الخطورة", value: severityLabels[r.severity ?? ""] ?? "-" },
              { label: "الحالة", value: statusLabels[r.status ?? ""] ?? "-" },
              { label: "مُسند إلى", value: r.assignedTo || "-" },
              { label: "ماذا حدث؟", value: r.description || "-" },
              { label: "ماذا كان يمكن أن يحدث؟", value: r.potentialConsequence || "-" },
              { label: "الإجراء الفوري المتخذ", value: r.immediateAction || "-" },
              { label: "تاريخ الإغلاق", value: r.closureDate ?? "-" },
            ]}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={deleteNearMiss} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title="الحوادث الوشيكة"
      subtitle="تسجيل ومتابعة الملاحظات والحوادث الوشيكة قبل وقوع الإصابات"
      user={user}
      action={
        <RecordDialog
          title="بلاغ حادث وشيك"
          description="سجّل ملاحظة أو حادثاً وشيكاً جديداً."
          triggerLabel="بلاغ جديد"
          fields={fields}
          action={createNearMiss}
        />
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="إجمالي البلاغات" value={records.length} icon={Siren} tone="blue" />
        <KpiCard label="مفتوحة / قيد المراجعة" value={open} icon={Clock} tone="accent" />
        <KpiCard label="عالية / حرجة" value={critical} icon={AlertTriangle} tone="destructive" />
        <KpiCard label="مغلقة" value={closed} icon={CheckCircle2} tone="primary" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">سجل الحوادث الوشيكة</h2>
        <DataTable
          columns={columns}
          rows={records}
          emptyMessage="لا توجد بلاغات حوادث وشيكة. أضف بلاغاً جديداً للبدء."
        />
      </div>
    </AppShell>
  )
}
