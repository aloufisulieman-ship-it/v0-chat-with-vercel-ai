import { FolderKanban, FileText, FileClock, FileCheck2 } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getDocuments, createDocument, deleteDocument } from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"
import { statusLabel } from "@/lib/i18n/labels"

type DocItem = Awaited<ReturnType<typeof getDocuments>>[number]

export default async function DocumentsPage() {
  const user = await requireModule("documents")
  const documents = await getDocuments()
  const { t } = await getServerT()

  const docStatusOptions = [
    { value: "active", label: t("documentsMod.statusActive") },
    { value: "in_progress", label: t("documentsMod.statusInReview") },
    { value: "expired", label: t("documentsMod.statusExpired") },
  ]

  const fields: FieldDef[] = [
    { name: "title", label: t("documentsMod.fName"), required: true, full: true, placeholder: t("documentsMod.fNamePlaceholder") },
    { name: "category", label: t("documentsMod.fCategory"), placeholder: t("documentsMod.fCategoryPlaceholder") },
    { name: "version", label: t("documentsMod.fVersion"), defaultValue: "1.0" },
    { name: "owner", label: t("documentsMod.fOwner") },
    { name: "status", label: t("documentsMod.fStatus"), type: "select", options: docStatusOptions },
    { name: "reviewDate", label: t("documentsMod.fReviewDate"), type: "date" },
  ]

  const active = documents.filter((d) => d.status === "active").length
  const review = documents.filter((d) => d.status === "in_progress").length
  const expired = documents.filter((d) => d.status === "expired").length

  const columns: Column<DocItem>[] = [
    {
      key: "title",
      header: t("documentsMod.colDoc"),
      render: (r) => (
        <span className="flex items-center gap-2 font-medium text-foreground">
          <FileText className="size-4 text-muted-foreground" />
          {r.title}
        </span>
      ),
    },
    { key: "category", header: t("documentsMod.fCategory"), render: (r) => <span className="text-muted-foreground">{r.category || "-"}</span> },
    { key: "version", header: t("documentsMod.fVersion"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.version}</span> },
    { key: "owner", header: t("documentsMod.fOwner"), render: (r) => <span className="text-muted-foreground">{r.owner || "-"}</span> },
    { key: "reviewDate", header: t("documentsMod.fReviewDate"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.reviewDate ?? "-"}</span> },
    { key: "status", header: t("documentsMod.fStatus"), render: (r) => <StatusBadge status={r.status ?? "active"} /> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="documents"
            recordId={r.id}
            title={r.title}
            subtitle={t("documentsMod.detailsSubtitle")}
            fields={[
              { label: t("documentsMod.fName"), value: r.title },
              { label: t("documentsMod.fCategory"), value: r.category || "-" },
              { label: t("documentsMod.fVersion"), value: r.version || "-" },
              { label: t("documentsMod.fOwner"), value: r.owner || "-" },
              { label: t("documentsMod.fReviewDate"), value: r.reviewDate ?? "-" },
              { label: t("documentsMod.fStatus"), value: r.status ? statusLabel(t, r.status) : "-" },
            ]}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={deleteDocument} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.documentsTitle")}
      subtitle={t("pageHeaders.documentsSubtitle")}
      user={user}
      action={<RecordDialog title={t("documentsMod.dialogTitle")} description={t("documentsMod.dialogDesc")} triggerLabel={t("documentsMod.trigger")} fields={fields} action={createDocument} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("documentsMod.kpiTotal")} value={documents.length} icon={FolderKanban} tone="blue" />
        <KpiCard label={t("documentsMod.kpiActive")} value={active} icon={FileCheck2} tone="primary" />
        <KpiCard label={t("documentsMod.kpiReview")} value={review} icon={FileClock} tone="accent" />
        <KpiCard label={t("documentsMod.kpiExpired")} value={expired} icon={FileText} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("documentsMod.registryTitle")}</h2>
        <DataTable columns={columns} rows={documents} emptyMessage={t("documentsMod.emptyMessage")} />
      </div>
    </AppShell>
  )
}
