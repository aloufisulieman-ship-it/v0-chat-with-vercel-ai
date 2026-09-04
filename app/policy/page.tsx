import { ScrollText, BadgeCheck, CalendarClock, FileText } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { IsoClauseBadge } from "@/components/iso-clause-badge"
import { requireModule } from "@/lib/session"
import { getPolicies, createPolicy, deletePolicy } from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"
import { statusLabel } from "@/lib/i18n/labels"

type Policy = Awaited<ReturnType<typeof getPolicies>>[number]

export default async function PolicyPage() {
  const user = await requireModule("policy")
  const policies = await getPolicies()
  const { t, locale } = await getServerT()

  const statusOptions = [
    { value: "draft", label: t("policyMod.statusDraft") },
    { value: "active", label: t("policyMod.statusActive") },
    { value: "archived", label: t("policyMod.statusArchived") },
  ]

  const fields: FieldDef[] = [
    { name: "title", label: t("policyMod.fTitle"), required: true, full: true, placeholder: t("policyMod.fTitlePlaceholder") },
    { name: "statement", label: t("policyMod.fStatement"), type: "textarea", required: true, placeholder: t("policyMod.fStatementPlaceholder") },
    { name: "version", label: t("policyMod.fVersion"), defaultValue: "1.0" },
    { name: "status", label: t("policyMod.fStatus"), type: "select", options: statusOptions },
    { name: "approvedBy", label: t("policyMod.fApprovedBy") },
    { name: "approvedDate", label: t("policyMod.fApprovedDate"), type: "date" },
    { name: "reviewDate", label: t("policyMod.fReviewDate"), type: "date" },
  ]

  const activePolicy = policies.find((p) => p.status === "active")

  const columns: Column<Policy>[] = [
    {
      key: "title",
      header: t("policyMod.colTitle"),
      render: (r) => (
        <span className="flex items-center gap-2 font-medium text-foreground">
          <ScrollText className="size-4 text-muted-foreground" />
          {r.title || "-"}
        </span>
      ),
    },
    { key: "version", header: t("policyMod.fVersion"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.version}</span> },
    { key: "approvedBy", header: t("policyMod.fApprovedBy"), render: (r) => <span className="text-muted-foreground">{r.approvedBy || "-"}</span> },
    { key: "approvedDate", header: t("policyMod.fApprovedDate"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.approvedDate ?? "-"}</span> },
    { key: "reviewDate", header: t("policyMod.fReviewDate"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.reviewDate ?? "-"}</span> },
    { key: "status", header: t("policyMod.fStatus"), render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="policy"
            recordId={r.id}
            title={r.title || t("policyMod.title")}
            subtitle={`${t("policyMod.fVersion")} ${r.version}`}
            fields={[
              { label: t("policyMod.fStatement"), value: r.statement || "-" },
              { label: t("policyMod.fApprovedBy"), value: r.approvedBy || "-" },
              { label: t("policyMod.fApprovedDate"), value: r.approvedDate ?? "-" },
              { label: t("policyMod.fReviewDate"), value: r.reviewDate ?? "-" },
              { label: t("policyMod.fStatus"), value: statusLabel(t, r.status) },
            ]}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={deletePolicy} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.policyTitle")}
      subtitle={t("pageHeaders.policySubtitle")}
      user={user}
      action={<RecordDialog title={t("policyMod.dialogTitle")} description={t("policyMod.dialogDesc")} triggerLabel={t("policyMod.trigger")} fields={fields} action={createPolicy} />}
    >
      <IsoClauseBadge ids="5.2" locale={locale} className="mb-4" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label={t("policyMod.kpiTotal")} value={policies.length} icon={FileText} tone="blue" />
        <KpiCard label={t("policyMod.kpiActive")} value={policies.filter((p) => p.status === "active").length} icon={BadgeCheck} tone="primary" />
        <KpiCard label={t("policyMod.kpiDrafts")} value={policies.filter((p) => p.status === "draft").length} icon={CalendarClock} tone="accent" />
      </div>

      {activePolicy && (
        <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-6">
          <div className="mb-2 flex items-center gap-2">
            <BadgeCheck className="size-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{activePolicy.title || t("policyMod.currentPolicy")}</h2>
            <StatusBadge status={activePolicy.status} />
          </div>
          <p className="whitespace-pre-line leading-relaxed text-pretty text-muted-foreground">{activePolicy.statement}</p>
          {activePolicy.approvedBy && (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("policyMod.fApprovedBy")}: <span className="font-medium text-foreground">{activePolicy.approvedBy}</span>
              {activePolicy.approvedDate ? <span dir="ltr"> · {activePolicy.approvedDate}</span> : null}
            </p>
          )}
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("policyMod.registryTitle")}</h2>
        <DataTable columns={columns} rows={policies} emptyMessage={t("policyMod.emptyMessage")} />
      </div>
    </AppShell>
  )
}
