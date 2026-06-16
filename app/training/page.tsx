import { GraduationCap, Users, Award, BookOpen } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getTrainings, getAllTrainingAttendees, deleteTraining } from "@/app/actions/hse"
import { statusLabels } from "@/lib/labels"
import { TrainingFormDialog } from "./training-form"

type Training = Awaited<ReturnType<typeof getTrainings>>[number]
type Attendee = Awaited<ReturnType<typeof getAllTrainingAttendees>>[number][number]

function escapeHtml(s: string) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// جدول الحضور بصيغة نموذج MHS-IMS-FR-HSE-2 لتضمينه في PDF (RTL)
function attendeesTableHtml(rows: Attendee[]) {
  if (rows.length === 0) return ""
  const th = (t: string) =>
    `<th style="border:1px solid black;background:#e6eef7;padding:6px;font-size:11pt;font-weight:bold;">${t}</th>`
  const td = (t: string, center = false) =>
    `<td style="border:1px solid black;padding:6px;font-size:11pt;${center ? "text-align:center;" : ""}">${t}</td>`
  const sigCell = (sig: string) =>
    sig && sig.startsWith("data:image")
      ? `<td style="border:1px solid black;padding:2px;text-align:center;"><img src="${sig}" style="max-height:42px;max-width:140px;" /></td>`
      : td("", true)

  const body = rows
    .map(
      (r, i) =>
        `<tr>
          ${td(String(r.rowNo || i + 1), true)}
          ${td(escapeHtml(r.name ?? ""))}
          ${td(escapeHtml(r.designation ?? ""))}
          ${td(escapeHtml(r.company ?? ""))}
          ${td(escapeHtml(r.cardCode ?? ""), true)}
          ${td(r.understood === "no" ? "لا" : "نعم", true)}
          ${sigCell(r.signature ?? "")}
        </tr>`,
    )
    .join("")

  return `
    <h3 style="font-size:13pt;font-weight:bold;color:#0f172a;margin:0 0 8px;">سجل الحضور / Attendance Record</h3>
    <table style="width:100%;border-collapse:collapse;border:2px solid black;">
      <thead>
        <tr>
          ${th("الرقم")}${th("الاسم / Name")}${th("الوظيفة / Designation")}${th("الشركة / Company")}${th("الكود / Card No.")}${th("فهم التدريب")}${th("التوقيع / Signature")}
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`
}

// عرض جدول الحضور على الشاشة داخل نافذة التفاصيل
function AttendeesSection({ rows }: { rows: Attendee[] }) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-border py-4 text-center text-sm text-muted-foreground">لا يوجد متدربون مسجّلون في هذه الدورة.</p>
  }
  return (
    <section className="flex flex-col gap-2" dir="rtl">
      <h4 className="text-sm font-semibold text-foreground">سجل الحضور ({rows.length})</h4>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-right text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="border-b border-border p-2 font-medium">#</th>
              <th className="border-b border-border p-2 font-medium">الاسم</th>
              <th className="border-b border-border p-2 font-medium">الوظيفة</th>
              <th className="border-b border-border p-2 font-medium">الشركة</th>
              <th className="border-b border-border p-2 font-medium">الكود</th>
              <th className="border-b border-border p-2 font-medium">فهم التدريب</th>
              <th className="border-b border-border p-2 font-medium">التوقيع</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="text-foreground">
                <td className="border-b border-border p-2 text-center">{r.rowNo || i + 1}</td>
                <td className="border-b border-border p-2">{r.name || "-"}</td>
                <td className="border-b border-border p-2">{r.designation || "-"}</td>
                <td className="border-b border-border p-2">{r.company || "-"}</td>
                <td className="border-b border-border p-2 text-center">{r.cardCode || "-"}</td>
                <td className="border-b border-border p-2 text-center">{r.understood === "no" ? "لا" : "نعم"}</td>
                <td className="border-b border-border p-2 text-center">
                  {r.signature?.startsWith("data:image") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.signature || "/placeholder.svg"} alt="توقيع" className="mx-auto h-8 bg-white object-contain" />
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default async function TrainingPage() {
  const user = await requireModule("training")
  const trainings = await getTrainings()
  const attendeesByTraining = await getAllTrainingAttendees()

  const totalAttendees = trainings.reduce((a, b) => a + (b.attendees ?? 0), 0)
  const completed = trainings.filter((t) => t.status === "closed").length
  const scheduled = trainings.filter((t) => t.status === "scheduled").length

  const columns: Column<Training>[] = [
    { key: "title", header: "الدورة", render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    { key: "trainer", header: "المدرب", render: (r) => <span className="text-muted-foreground">{r.conductedBy || r.trainer || "-"}</span> },
    { key: "attendees", header: "الحضور", className: "text-center" },
    { key: "status", header: "الحالة", render: (r) => <StatusBadge status={r.status ?? "scheduled"} /> },
    { key: "trainingDate", header: "التاريخ", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.trainingDate ?? "-"}</span> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => {
        const rows = attendeesByTraining[r.id] ?? []
        return (
          <div className="flex items-center justify-end gap-1">
            <RecordDetailsDialog
              module="training"
              recordId={r.id}
              title={r.title}
              subtitle="سجل تدريب — MHS-IMS-FR-HSE-2"
              fields={[
                { label: "الموضوع / اسم الدورة", value: r.title },
                { label: "تاريخ الدورة", value: r.trainingDate ?? "-" },
                { label: "من قام بالتدريب", value: r.conductedBy || r.trainer || "-" },
                { label: "اللغة", value: r.language || "-" },
                { label: "عدد الحضور", value: String(r.attendees ?? rows.length) },
                { label: "الحالة", value: statusLabels[r.status ?? ""] ?? "-" },
              ]}
              signatures={[{ label: "توقيع المدرب", value: r.trainerSignature || "" }]}
              extraSection={<AttendeesSection rows={rows} />}
              extraReportHtml={attendeesTableHtml(rows)}
              initialAttachments={[]}
            />
            <DeleteButton id={r.id} action={deleteTraining} />
          </div>
        )
      },
    },
  ]

  return (
    <AppShell
      title="التدريب والتأهيل"
      subtitle="إدارة الدورات التدريبية وسجلات التأهيل للموظفين"
      user={user}
      action={<TrainingFormDialog />}
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
