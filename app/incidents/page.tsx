import { AlertTriangle, AlertOctagon, CheckCircle2, Clock } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge, SeverityBadge } from "@/components/status-badge"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getIncidents, deleteIncident } from "@/app/actions/hse"
import { severityLabels, statusLabels } from "@/lib/labels"
import { formatParties } from "@/lib/incident-types"
import { IncidentFormDialog } from "./incident-form"

type Incident = Awaited<ReturnType<typeof getIncidents>>[number]

const notifiedLabel = (v: string | null) => (v === "yes" ? "نعم" : "لا")

export default async function IncidentsPage() {
  const user = await requireModule("incidents")
  const incidents = await getIncidents()

  const open = incidents.filter((i) => i.status === "open" || i.status === "in_progress" || i.status === "investigating").length
  const closed = incidents.filter((i) => i.status === "closed").length
  const critical = incidents.filter((i) => i.severity === "critical" || i.severity === "high").length

  const columns: Column<Incident>[] = [
    { key: "documentNo", header: "رقم الحادثة", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.documentNo || "-"}</span> },
    { key: "title", header: "النوع", render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
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
            documentNo={r.documentNo || undefined}
            fields={[
              { label: "رقم الحادثة", value: r.documentNo || "-" },
              { label: "نوع الحادثة", value: r.title },
              { label: "الموقع", value: r.location || "-" },
              { label: "تاريخ الحادثة", value: r.incidentDate ?? "-" },
              { label: "وقت الحادثة", value: r.incidentTime || "-" },
              { label: "الخطورة", value: severityLabels[r.severity ?? ""] ?? "-" },
              { label: "الحالة", value: statusLabels[r.status ?? ""] ?? "-" },
              { label: "المُبلِّغ عن الحادثة", value: r.reportedBy || "-" },
              { label: "وصف تفصيلي", value: r.description || "-" },
              { label: "الأسباب المباشرة", value: r.directCauses || "-" },
              { label: "الأسباب الجذرية", value: r.rootCauses || "-" },
              { label: "الأضرار المادية", value: r.propertyDamage || "-" },
              { label: "تقدير التكلفة (ريال)", value: r.damageCost || "-" },
              { label: "الإجراءات الفورية", value: r.immediateActions || "-" },
              { label: "الأطراف المتضررة", value: formatParties(r.parties) },
              { label: "الشهود", value: r.witnesses || "-" },
              { label: "إبلاغ الجهات المختصة", value: notifiedLabel(r.authoritiesNotified) },
              { label: "الجهة المبلَّغة", value: r.authorityName || "-" },
              { label: "توصيات منع التكرار", value: r.recommendations || "-" },
            ]}
            signatures={[
              { label: "توقيع المبلّغ", value: r.reporterSignature || "" },
              { label: "توقيع مدير السلامة", value: r.managerSignature || "" },
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
      action={<IncidentFormDialog defaultReporter={user.name ?? ""} />}
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
