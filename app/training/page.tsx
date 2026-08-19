import { GraduationCap, Users, Award, BookOpen } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { TrainingFormDialog } from "./training-form"
import { ToolboxTalkTab } from "./toolbox-talk"
import { EmployeeRegistry } from "./employee-registry"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requireModule } from "@/lib/session"
import { getTrainings, getAllTrainingAttendees, getEmployees, getToolboxSessions, deleteTraining } from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"
import { statusLabel } from "@/lib/i18n/labels"
import type { TFunction } from "@/lib/i18n/translate"

type Training = Awaited<ReturnType<typeof getTrainings>>[number]
type Attendee = Awaited<ReturnType<typeof getAllTrainingAttendees>>[number][number]

function understoodLabel(t: TFunction, v: string | null) {
  return v === "no" ? t("trainingMod.understoodNo") : t("trainingMod.understoodYes")
}

// Escapes user text before embedding it in the PDF HTML string.
function esc(v: string | number | null | undefined) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Builds the attendance table HTML for the PDF export (MHS-IMS-FR-HSE-2).
function buildAttendanceHtml(t: TFunction, rows: Attendee[]) {
  if (rows.length === 0) return ""
  const headers = [
    t("trainingMod.attHeaderNo"),
    t("trainingMod.attHeaderName"),
    t("trainingMod.attHeaderDesignation"),
    t("trainingMod.attHeaderCompany"),
    t("trainingMod.attHeaderCard"),
    t("trainingMod.attHeaderUnderstood"),
    t("trainingMod.attHeaderSignature"),
  ]
  const head = headers.map(
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
        <td style="border:1px solid black;padding:5px;text-align:center;font-size:11pt;">${understoodLabel(t, r.understood)}</td>
        <td style="border:1px solid black;padding:5px;text-align:center;">${sig}</td>
      </tr>`
    })
    .join("")
  return `<h2 style="font-size:14pt;color:#0f766e;margin:0 0 8px;">${t("trainingMod.attendanceLog")} (${rows.length})</h2>
    <table style="width:100%;border-collapse:collapse;border:2px solid black;">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>`
}

// On-screen attendance table shown inside the details dialog.
function AttendanceTable({ t, rows }: { t: TFunction; rows: Attendee[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4 text-center text-sm text-muted-foreground">
        {t("trainingMod.noAttendeesRegistered")}
      </div>
    )
  }
  const headers = [
    t("trainingMod.attHeaderNo"),
    t("trainingMod.attHeaderName"),
    t("trainingMod.attHeaderDesignation"),
    t("trainingMod.attHeaderCompany"),
    t("trainingMod.attHeaderCard"),
    t("trainingMod.attHeaderUnderstood"),
    t("trainingMod.attHeaderSignature"),
  ]
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="size-4 text-muted-foreground" /> {t("trainingMod.attendanceLog")} ({rows.length})
      </h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              {headers.map((h) => (
                <th key={h} className="border border-border px-3 py-2 text-start font-semibold text-foreground">
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
                <td className="border border-border px-3 py-2 text-center">{understoodLabel(t, r.understood)}</td>
                <td className="border border-border px-3 py-2 text-center">
                  {(r.signature ?? "").startsWith("data:image") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.signature || "/placeholder.svg"} alt={t("trainingMod.traineeSignatureAlt")} className="mx-auto h-10 max-w-[120px] object-contain" />
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
  const [trainings, attendeesByTraining, employees, toolboxSessions] = await Promise.all([
    getTrainings(),
    getAllTrainingAttendees(),
    getEmployees(),
    getToolboxSessions(),
  ])
  const { t, dir } = await getServerT()

  const totalAttendees = trainings.reduce((a, b) => a + (b.attendees ?? 0), 0)
  const completed = trainings.filter((tr) => tr.status === "closed").length
  const scheduled = trainings.filter((tr) => tr.status === "scheduled").length

  const columns: Column<Training>[] = [
    { key: "title", header: t("trainingMod.colCourse"), render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    { key: "trainer", header: t("trainingMod.colTrainer"), render: (r) => <span className="text-muted-foreground">{r.trainer || "-"}</span> },
    { key: "attendees", header: t("trainingMod.colAttendance"), className: "text-center" },
    { key: "status", header: t("trainingMod.colStatus"), render: (r) => <StatusBadge status={r.status ?? "scheduled"} /> },
    { key: "trainingDate", header: t("trainingMod.colDate"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.trainingDate ?? "-"}</span> },
    {
      key: "actions",
      header: "",
      className: "text-end",
      render: (r) => {
        const attendees = attendeesByTraining[r.id] ?? []
        return (
          <div className="flex items-center justify-end gap-1">
            <RecordDetailsDialog
              module="training"
              recordId={r.id}
              title={r.title}
              subtitle={t("trainingMod.detailsSubtitle")}
              fields={[
                { label: t("trainingMod.dCourseName"), value: r.title },
                { label: t("trainingMod.dConductedBy"), value: r.trainer || "-" },
                { label: t("trainingMod.dAttendeeCount"), value: String(r.attendees ?? 0) },
                { label: t("trainingMod.dStatus"), value: r.status ? statusLabel(t, r.status) : "-" },
                { label: t("trainingMod.dCourseDate"), value: r.trainingDate ?? "-" },
              ]}
              initialAttachments={[]}
              extraSection={<AttendanceTable t={t} rows={attendees} />}
              extraReportHtml={buildAttendanceHtml(t, attendees)}
              suppressReportAttachments
            />
            <DeleteButton id={r.id} action={deleteTraining} />
          </div>
        )
      },
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.trainingTitle")}
      subtitle={t("pageHeaders.trainingSubtitle")}
      user={user}
      action={<TrainingFormDialog />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("trainingMod.kpiTotalCourses")} value={trainings.length} icon={BookOpen} tone="blue" />
        <KpiCard label={t("trainingMod.kpiTotalTrainees")} value={totalAttendees} icon={Users} tone="primary" />
        <KpiCard label={t("trainingMod.kpiCompleted")} value={completed} icon={Award} tone="accent" />
        <KpiCard label={t("trainingMod.kpiScheduled")} value={scheduled} icon={GraduationCap} tone="blue" />
      </div>

      <Tabs defaultValue="training" dir={dir} className="mt-6 gap-4">
        <TabsList>
          <TabsTrigger value="training">{t("trainingMod.tabProgram")}</TabsTrigger>
          <TabsTrigger value="toolbox">{t("trainingMod.tabToolbox")}</TabsTrigger>
          <TabsTrigger value="employees">{t("trainingMod.tabEmployees")}</TabsTrigger>
        </TabsList>

        <TabsContent value="training">
          <h2 className="mb-3 text-lg font-semibold text-foreground">{t("trainingMod.programHeading")}</h2>
          <DataTable columns={columns} rows={trainings} emptyMessage={t("trainingMod.pageEmptyMessage")} />
        </TabsContent>

        <TabsContent value="toolbox">
          <ToolboxTalkTab employees={employees} initialSessions={toolboxSessions} />
        </TabsContent>

        <TabsContent value="employees">
          <EmployeeRegistry employees={employees} />
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}
