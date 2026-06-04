import { GraduationCap, Users, Award, BookOpen } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getTrainings, createTraining, deleteTraining } from "@/app/actions/hse"
import { inspectionStatusOptions, statusLabels } from "@/lib/labels"

type Training = Awaited<ReturnType<typeof getTrainings>>[number]

const fields: FieldDef[] = [
  { name: "title", label: "اسم الدورة", required: true, full: true, placeholder: "مثال: السلامة من الحرائق" },
  { name: "trainer", label: "المدرب" },
  { name: "attendees", label: "عدد الحضور", type: "number", min: 0, defaultValue: 0 },
  { name: "status", label: "الحالة", type: "select", options: inspectionStatusOptions },
  { name: "trainingDate", label: "تاريخ الدورة", type: "date" },
]

export default async function TrainingPage() {
  const user = await requireModule("training")
  const trainings = await getTrainings()

  const totalAttendees = trainings.reduce((a, b) => a + (b.attendees ?? 0), 0)
  const completed = trainings.filter((t) => t.status === "closed").length
  const scheduled = trainings.filter((t) => t.status === "scheduled").length

  const columns: Column<Training>[] = [
    { key: "title", header: "الدورة", render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    { key: "trainer", header: "المدرب", render: (r) => <span className="text-muted-foreground">{r.trainer || "-"}</span> },
    { key: "attendees", header: "الحضور", className: "text-center" },
    { key: "status", header: "الحالة", render: (r) => <StatusBadge status={r.status ?? "scheduled"} /> },
    { key: "trainingDate", header: "التاريخ", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.trainingDate ?? "-"}</span> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="training"
            recordId={r.id}
            title={r.title}
            subtitle="سجل تدريب"
            fields={[
              { label: "اسم الدورة", value: r.title },
              { label: "المدرب", value: r.trainer || "-" },
              { label: "عدد الحضور", value: String(r.attendees ?? 0) },
              { label: "الحالة", value: statusLabels[r.status ?? ""] ?? "-" },
              { label: "تاريخ الدورة", value: r.trainingDate ?? "-" },
            ]}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={deleteTraining} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title="التدريب والتأهيل"
      subtitle="إدارة الدورات التدريبية وسجلات التأهيل للموظفين"
      user={user}
      action={<RecordDialog title="دورة تدريبية جديدة" description="سجّل دورة تدريبية." triggerLabel="دورة جديدة" fields={fields} action={createTraining} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="إجمالي الدورات" value={trainings.length} icon={BookOpen} tone="blue" />
        <KpiCard label="إجمالي المتدربين" value={totalAttendees} icon={Users} tone="primary" />
        <KpiCard label="دورات مكتملة" value={completed} icon={Award} tone="accent" />
        <KpiCard label="دورات مجدولة" value={scheduled} icon={GraduationCap} tone="blue" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">برنامج التدريب</h2>
        <DataTable columns={columns} rows={trainings} emptyMessage="لا توجد دورات. أضف دورة جديدة للبدء." />
      </div>
    </AppShell>
  )
}
