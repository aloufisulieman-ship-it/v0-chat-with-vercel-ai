import { FileSignature, Flame, CheckCircle2, Clock } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getPermits, createPermit, deletePermit } from "@/app/actions/hse"
import { permitTypeLabels, permitTypeOptions, permitStatusOptions, statusLabels } from "@/lib/labels"

type Permit = Awaited<ReturnType<typeof getPermits>>[number]

const fields: FieldDef[] = [
  { name: "title", label: "عنوان التصريح", required: true, full: true, placeholder: "مثال: لحام خزان المياه" },
  { name: "type", label: "نوع التصريح", type: "select", options: permitTypeOptions },
  { name: "location", label: "الموقع", placeholder: "مثال: السطح الشمالي" },
  { name: "requestedBy", label: "مقدّم الطلب" },
  { name: "status", label: "الحالة", type: "select", options: permitStatusOptions },
  { name: "validFrom", label: "ساري من", type: "date" },
  { name: "validTo", label: "ساري إلى", type: "date" },
]

export default async function PermitsPage() {
  const user = await requireModule("permits")
  const permits = await getPermits()

  const active = permits.filter((p) => p.status === "active" || p.status === "approved").length
  const pending = permits.filter((p) => p.status === "pending").length
  const hot = permits.filter((p) => p.type === "hot_work").length

  const columns: Column<Permit>[] = [
    { key: "title", header: "التصريح", render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    { key: "type", header: "النوع", render: (r) => <span className="text-muted-foreground">{permitTypeLabels[r.type ?? ""] ?? "-"}</span> },
    { key: "location", header: "الموقع", render: (r) => <span className="text-muted-foreground">{r.location || "-"}</span> },
    { key: "requestedBy", header: "مقدّم الطلب", render: (r) => <span className="text-muted-foreground">{r.requestedBy || "-"}</span> },
    { key: "validFrom", header: "من", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.validFrom ?? "-"}</span> },
    { key: "validTo", header: "إلى", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.validTo ?? "-"}</span> },
    { key: "status", header: "الحالة", render: (r) => <StatusBadge status={r.status ?? "pending"} /> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="permits"
            recordId={r.id}
            title={r.title}
            subtitle="تصريح عمل"
            fields={[
              { label: "عنوان التصريح", value: r.title },
              { label: "النوع", value: permitTypeLabels[r.type ?? ""] ?? "-" },
              { label: "الموقع", value: r.location || "-" },
              { label: "مقدّم الطلب", value: r.requestedBy || "-" },
              { label: "ساري من", value: r.validFrom ?? "-" },
              { label: "ساري إلى", value: r.validTo ?? "-" },
              { label: "الحالة", value: statusLabels[r.status ?? ""] ?? "-" },
            ]}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={deletePermit} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title="تصاريح العمل"
      subtitle="إصدار ومراقبة تصاريح العمل عالية الخطورة (PTW)"
      user={user}
      action={<RecordDialog title="إصدار تصريح عمل" description="سجّل تصريح عمل جديد." triggerLabel="إصدار تصريح" fields={fields} action={createPermit} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="إجمالي التصاريح" value={permits.length} icon={FileSignature} tone="blue" />
        <KpiCard label="تصاريح نشطة" value={active} icon={Clock} tone="primary" />
        <KpiCard label="بانتظار الاعتماد" value={pending} icon={CheckCircle2} tone="accent" />
        <KpiCard label="أعمال ساخنة" value={hot} icon={Flame} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">سجل تصاريح العمل</h2>
        <DataTable columns={columns} rows={permits} emptyMessage="لا توجد تصاريح. أصدر تصريحاً جديداً للبدء." />
      </div>
    </AppShell>
  )
}
