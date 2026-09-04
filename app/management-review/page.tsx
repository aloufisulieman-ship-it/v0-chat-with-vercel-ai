import { Gavel, CalendarClock, ListChecks } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { DeleteButton } from "@/components/delete-button"
import { IsoClauseBadge } from "@/components/iso-clause-badge"
import { requireModule } from "@/lib/session"
import { getManagementReviews, createManagementReview, deleteManagementReview } from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"

type Review = Awaited<ReturnType<typeof getManagementReviews>>[number]

export default async function ManagementReviewPage() {
  const user = await requireModule("management-review")
  const rows = await getManagementReviews()
  const { t, locale } = await getServerT()

  const fields: FieldDef[] = [
    { name: "title", label: t("mgmtReviewMod.fTitle"), required: true, full: true, placeholder: t("mgmtReviewMod.fTitlePlaceholder") },
    { name: "reviewDate", label: t("mgmtReviewMod.fReviewDate"), type: "date" },
    { name: "nextReviewDate", label: t("mgmtReviewMod.fNextReviewDate"), type: "date" },
    { name: "attendees", label: t("mgmtReviewMod.fAttendees"), full: true, placeholder: t("mgmtReviewMod.fAttendeesPlaceholder") },
    { name: "inputs", label: t("mgmtReviewMod.fInputs"), type: "textarea", full: true, placeholder: t("mgmtReviewMod.fInputsPlaceholder") },
    { name: "decisions", label: t("mgmtReviewMod.fDecisions"), type: "textarea", full: true, placeholder: t("mgmtReviewMod.fDecisionsPlaceholder") },
  ]

  const today = new Date().toISOString().slice(0, 10)
  const thisYear = new Date().getFullYear().toString()
  const reviewsThisYear = rows.filter((r) => r.reviewDate && r.reviewDate.startsWith(thisYear)).length
  const upcoming = rows.filter((r) => r.nextReviewDate && r.nextReviewDate >= today).length

  const columns: Column<Review>[] = [
    {
      key: "title",
      header: t("mgmtReviewMod.fTitle"),
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{r.title}</span>
          {r.attendees ? <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{r.attendees}</span> : null}
        </div>
      ),
    },
    { key: "reviewDate", header: t("mgmtReviewMod.fReviewDate"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.reviewDate ?? "-"}</span> },
    {
      key: "decisions",
      header: t("mgmtReviewMod.fDecisions"),
      render: (r) => <span className="text-sm text-muted-foreground line-clamp-2 max-w-md">{r.decisions || "-"}</span>,
    },
    {
      key: "nextReviewDate",
      header: t("mgmtReviewMod.fNextReviewDate"),
      render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.nextReviewDate ?? "-"}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end">
          <DeleteButton id={r.id} action={deleteManagementReview} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.mgmtReviewTitle")}
      subtitle={t("pageHeaders.mgmtReviewSubtitle")}
      user={user}
      action={<RecordDialog title={t("mgmtReviewMod.dialogTitle")} description={t("mgmtReviewMod.dialogDesc")} triggerLabel={t("mgmtReviewMod.trigger")} fields={fields} action={createManagementReview} />}
    >
      <IsoClauseBadge ids={["9.3"]} locale={locale} className="mb-4" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label={t("mgmtReviewMod.kpiTotal")} value={rows.length} icon={Gavel} tone="blue" />
        <KpiCard label={t("mgmtReviewMod.kpiThisYear")} value={reviewsThisYear} icon={ListChecks} tone="primary" />
        <KpiCard label={t("mgmtReviewMod.kpiUpcoming")} value={upcoming} icon={CalendarClock} tone="accent" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("mgmtReviewMod.registryTitle")}</h2>
        <DataTable columns={columns} rows={rows} emptyMessage={t("mgmtReviewMod.emptyMessage")} />
      </div>
    </AppShell>
  )
}
