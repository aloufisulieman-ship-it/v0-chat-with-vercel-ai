import { AlertTriangle, AlertOctagon, CheckCircle2, Clock } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge, SeverityBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getIncidents, createIncident, deleteIncident } from "@/app/actions/hse"
import { incidentTypeLabels, severityLabels, statusLabels } from "@/lib/labels"
import { severityOptions, statusOptions, incidentTypeOptions } from "@/lib/labels"

type Incident = Awaited<ReturnType<typeof getIncidents>>[number]

const fields: FieldDef[] = [
  { name: "title", label: "وصف الحادثة", required: true, full: true, placeholder: "مثال: انزلاق في منطقة التحميل" },
  { name: "location", label: "الموقع", placeholder: "مثال: المستودع الرئيسي" },
  { name: "reportedBy", label: "المُبلِّغ" },
  { name: "type", label: "النوع", type: "select", options: incidentTypeOptions },
  { name: "severity", label: "الخطورة", type: "select", options: severityOptions },
  { name: "status", label: "الحالة", type: "select", options: statusOptions },
  { name: "incidentDate", label: "تاريخ الحادثة", type: "date" },
  { name: "description", label: "تفاصيل إضافية", type: "textarea" },
]

export default async function IncidentsPage() {
  const user = await requireModule("incidents")
  const incidents = await getIncidents()

  const open = incidents.filter((i) => i.status === "open" || i.status === "in_progress").length
  const closed = incidents.filter((i) => i.status === "closed").length
  const critical = incidents.filter((i) => i.severity === "critical" || i.severity === "high").length

  const columns: Column<Incident>[] = [
    { key: "title", header: "الوصف", render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    { key: "type", header: "النوع", render: (r) => <span className="text-muted-foreground">{incidentTypeLabels[r.type ?? ""] ?? "-"}</span> },
    { key: "location", header: "الموقع", render: (r) => <span className="text-muted-foreground">{r.location || "-"}</span> },
    { key: "reportedBy", header: "المُبلِّغ", render: (r) => <span className="text-muted-foreground">{r.reportedBy || "-"}</span> },
    { key: "severity", header: "الخطورة", render: (r) => <SeverityBadge severity={r.severity ?? "low"} /> },
    { key: "status", header: "الحالة", render: (r) => <StatusBadge status={r.status ?? "open"} /> },
    { key: "incidentDate", header: "التاريخ", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.incidentDate ?? "-"}</span> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="incidents"
            recordId={r.id}
            title={r.title}
            subtitle="تقرير حادثة"
            fields={[
              { label: "وصف الحادثة", value: r.title },
              { label: "النوع", value: incidentTypeLabels[r.type ?? ""] ?? "-" },
              { label: "الموقع", value: r.location || "-" },
              { label: "المُبلِّغ", value: r.reportedBy || "-" },
              { label: "الخطورة", value: severityLabels[r.severity ?? ""] ?? "-" },
              { label: "الحالة", value: statusLabels[r.status ?? ""] ?? "-" },
              { label: "تاريخ الحادثة", value: r.incidentDate ?? "-" },
              { label: "تفاصيل إضافية", value: r.description || "-" },
            ]}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={deleteIncident} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title="إدارة الحوادث"
      subtitle="تسجيل ومتابعة الحوادث والإصابات والملاحظات الوشيكة"
      user={user}
      action={<RecordDialog title="الإبلاغ عن حادثة" description="سجّل تفاصيل الحادثة." triggerLabel="الإبلاغ عن حادثة" fields={fields} action={createIncident} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="إجمالي الحوادث" value={incidents.length} icon={AlertOctagon} tone="blue" />
        <KpiCard label="مفتوحة / قيد المعالجة" value={open} icon={Clock} tone="accent" />
        <KpiCard label="عالية / حرجة" value={critical} icon={AlertTriangle} tone="destructive" />
        <KpiCard label="مغلقة" value={closed} icon={CheckCircle2} tone="primary" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">سجل الحوادث</h2>
        <DataTable columns={columns} rows={incidents} emptyMessage="لا توجد حوادث مسجلة. أبلغ عن حادثة جديدة للبدء." />
      </div>
    </AppShell>
  )
}
