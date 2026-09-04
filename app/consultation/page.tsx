import { MessagesSquare, Users, Vote, CalendarCheck } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { DeleteButton } from "@/components/delete-button"
import { IsoClauseBadge } from "@/components/iso-clause-badge"
import { requireModule } from "@/lib/session"
import { getConsultations, createConsultation, deleteConsultation } from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"

type Consultation = Awaited<ReturnType<typeof getConsultations>>[number]

export default async function ConsultationPage() {
  const user = await requireModule("consultation")
  const rows = await getConsultations()
  const { t, locale } = await getServerT()

  const typeOptions = [
    { value: "consultation", label: t("consultationMod.typeConsultation") },
    { value: "participation", label: t("consultationMod.typeParticipation") },
  ]
  const methodOptions = [
    { value: "meeting", label: t("consultationMod.methodMeeting") },
    { value: "survey", label: t("consultationMod.methodSurvey") },
    { value: "committee", label: t("consultationMod.methodCommittee") },
    { value: "suggestion", label: t("consultationMod.methodSuggestion") },
  ]

  const fields: FieldDef[] = [
    { name: "topic", label: t("consultationMod.fTopic"), required: true, full: true, placeholder: t("consultationMod.fTopicPlaceholder") },
    { name: "activityType", label: t("consultationMod.fType"), type: "select", options: typeOptions },
    { name: "method", label: t("consultationMod.fMethod"), type: "select", options: methodOptions },
    { name: "participants", label: t("consultationMod.fParticipants"), type: "number", min: 0, defaultValue: 0 },
    { name: "activityDate", label: t("consultationMod.fDate"), type: "date" },
    { name: "outcome", label: t("consultationMod.fOutcome"), type: "textarea", full: true, placeholder: t("consultationMod.fOutcomePlaceholder") },
  ]

  const participationCount = rows.filter((r) => r.activityType === "participation").length
  const committeeCount = rows.filter((r) => r.method === "committee").length
  const totalParticipants = rows.reduce((a, r) => a + (r.participants ?? 0), 0)

  const methodLabel = (m: string) =>
    m === "meeting"
      ? t("consultationMod.methodMeeting")
      : m === "survey"
        ? t("consultationMod.methodSurvey")
        : m === "committee"
          ? t("consultationMod.methodCommittee")
          : t("consultationMod.methodSuggestion")

  const columns: Column<Consultation>[] = [
    {
      key: "topic",
      header: t("consultationMod.fTopic"),
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{r.topic}</span>
          <span className="text-xs text-muted-foreground">
            {r.activityType === "participation" ? t("consultationMod.typeParticipation") : t("consultationMod.typeConsultation")}
          </span>
        </div>
      ),
    },
    {
      key: "method",
      header: t("consultationMod.fMethod"),
      render: (r) => (
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
          {methodLabel(r.method)}
        </span>
      ),
    },
    {
      key: "participants",
      header: t("consultationMod.fParticipants"),
      render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.participants ?? 0}</span>,
    },
    {
      key: "activityDate",
      header: t("consultationMod.fDate"),
      render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.activityDate ?? "-"}</span>,
    },
    {
      key: "outcome",
      header: t("consultationMod.fOutcome"),
      render: (r) => <span className="text-sm text-muted-foreground line-clamp-2 max-w-xs">{r.outcome || "-"}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end">
          <DeleteButton id={r.id} action={deleteConsultation} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.consultationTitle")}
      subtitle={t("pageHeaders.consultationSubtitle")}
      user={user}
      action={<RecordDialog title={t("consultationMod.dialogTitle")} description={t("consultationMod.dialogDesc")} triggerLabel={t("consultationMod.trigger")} fields={fields} action={createConsultation} />}
    >
      <IsoClauseBadge ids={["5.4"]} locale={locale} className="mb-4" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("consultationMod.kpiTotal")} value={rows.length} icon={MessagesSquare} tone="blue" />
        <KpiCard label={t("consultationMod.kpiParticipation")} value={participationCount} icon={Vote} tone="primary" />
        <KpiCard label={t("consultationMod.kpiCommittees")} value={committeeCount} icon={CalendarCheck} tone="accent" />
        <KpiCard label={t("consultationMod.kpiParticipants")} value={totalParticipants} icon={Users} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("consultationMod.registryTitle")}</h2>
        <DataTable columns={columns} rows={rows} emptyMessage={t("consultationMod.emptyMessage")} />
      </div>
    </AppShell>
  )
}
