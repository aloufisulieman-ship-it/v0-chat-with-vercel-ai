import { GraduationCap, Users, Award, BookOpen } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { TrainingFormDialog } from "./training-form"
import { requireModule } from "@/lib/session"
import { getTrainings, getAllTrainingAttendees, deleteTraining } from "@/app/actions/hse"
import { statusLabels } from "@/lib/labels"

type Training = Awaited<ReturnType<typeof getTrainings>>[number]
type Attendee = Awaited<ReturnType<typeof getAllTrainingAttendees>>[number][number]

const ATTENDEE_HEADERS = [
  "الرقم",
  "الاسم",
  "الوظيفة",
  "اسم الشركة",
  "رقم البطاقة/الكود",
  "فهم التدريب",
  "التوقيع",
] as const

function understoodLabel(v: string | null) {
  return v === "no" ? "لا" : "نعم"
}

// Escapes user text before embedding it in the PDF HTML string.
function esc(v: string | number | null | undefined) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Builds the attendance table HTML for the PDF export (Arabic RTL, MHS-IMS-FR-HSE-2).
function buildAttendanceHtml(rows: Attendee[]) {
  if (rows.length === 0) return ""
  const head = ATTENDEE_HEADERS.map(
    (h) =>
      `<th style="border:1px solid black;background:#f0f0f0;padding:6px;font-size:11pt;font-weight:bold;">${h}</th>`,
  ).join("")
  const body = rows
    .map((r) => {
      const sig = (r.signature ?? "").startsWith("data:image")
        ? `<img src="${r.signature}" style="max-height:42px;max-width:120px;" />`
        : ""
      return `<tr>
        <td style="border:1px solid black;padding:5px;text-align:center;font-size:11pt;">${r.rowNo ?? ""}</td>
        <td style="border:1px solid black;padding:5px;font-size:11pt;">${esc(r.name)}</td>
        <td style="border:1px solid black;padding:5px;font-size:11pt;">${esc(r.designation)}</td>
        <td style="border:1px solid black;padding:5px;font-size:11pt;">${esc(r.company)}</td>
        <td style="border:1px solid black;padding:5px;font-size:11pt;">${esc(r.cardCode)}</td>
        <td style="border:1px solid black;padding:5px;text-align:center;font-size:11pt;">${understoodLabel(r.understood)}</td>
        <td style="border:1px solid black;padding:5px;text-align:center;">${sig}</td>
      </tr>`
    })
    .join("")
  return `<h2 style="font-size:14pt;color:#0f766e;margin:0 0 8px;">سجل الحضور (${rows.length})</h2>
    <table style="width:100%;border-collapse:collapse;border:2px solid black;" dir="rtl">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>`
}

// On-screen attendance table shown inside the details dialog.
function AttendanceTable({ rows }: { rows: Attendee[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4 text-center text-sm text-muted-foreground">
        لا يوجد متدربون مسجّلون في هذه الدورة.
      </div>
    )
  }
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="size-4 text-muted-foreground" /> سجل الحضور ({rows.length})
      </h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm" dir="rtl">
          <thead>
            <tr className="bg-muted">
              {ATTENDEE_HEADERS.map((h) => (
                <th key={h} className="border border-border px-3 py-2 text-right font-semibold text-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="even:bg-muted/40">
                <td className="border border-border px-3 py-2 text-center">{r.rowNo}</td>
                <td className="border border-border px-3 py-2 font-medium text-foreground">{r.name || "-"}</td>
                <td className="border border-border px-3 py-2">{r.designation || "-"}</td>
                <td className="border border-border px-3 py-2">{r.company || "-"}</td>
                <td className="border border-border px-3 py-2" dir="ltr">{r.cardCode || "-"}</td>
                <td className="border border-border px-3 py-2 text-center">{understoodLabel(r.understood)}</td>
                <td className="border border-border px-3 py-2 text-center">
                  {(r.signature ?? "").startsWith("data:image") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.signature || "/placeholder.svg"} alt="توقيع المتدرب" className="mx-auto h-10 max-w-[120px] object-contain" />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
    { key: "trainer", header: "المدرب", render: (r) => <span className="text-muted-foreground">{r.trainer || "-"}</span> },
    { key: "attendees", header: "الحضور", className: "text-center" },
    { key: "status", header: "الحالة", render: (r) => <StatusBadge status={r.status ?? "scheduled"} /> },
    { key: "trainingDate", header: "التاريخ", render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.trainingDate ?? "-"}</span> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => {
        const attendees = attendeesByTraining[r.id] ?? []
        return (
          <div className="flex items-center justify-end gap-1">
            <RecordDetailsDialog
              module="training"
              recordId={r.id}
              title={r.title}
              subtitle="سجل تدريب — نموذج MHS-IMS-FR-HSE-2"
              fields={[
                { label: "اسم الدورة", value: r.title },
                { label: "من قام بالتدريب", value: r.trainer || "-" },
                { label: "عدد الحضور", value: String(r.attendees ?? 0) },
                { label: "الحالة", value: statusLabels[r.status ?? ""] ?? "-" },
                { label: "تاريخ الدورة", value: r.trainingDate ?? "-" },
              ]}
              initialAttachments={[]}
              extraSection={<AttendanceTable rows={attendees} />}
              extraReportHtml={buildAttendanceHtml(attendees)}
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
