import { Building2, Users, Globe2, Factory } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { DeleteButton } from "@/components/delete-button"
import { IsoClauseBadge } from "@/components/iso-clause-badge"
import { requireModule } from "@/lib/session"
import { getContextIssues, createContextIssue, deleteContextIssue } from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"

type Issue = Awaited<ReturnType<typeof getContextIssues>>[number]

export default async function ContextPage() {
  const user = await requireModule("context")
  const issues = await getContextIssues()
  const { t, locale } = await getServerT()

  const kindOptions = [
    { value: "internal", label: t("contextMod.kindInternal") },
    { value: "external", label: t("contextMod.kindExternal") },
    { value: "interested_party", label: t("contextMod.kindParty") },
  ]
  const impactOptions = [
    { value: "high", label: t("contextMod.impactHigh") },
    { value: "medium", label: t("contextMod.impactMedium") },
    { value: "low", label: t("contextMod.impactLow") },
  ]
  const kindLabel = (v: string) => kindOptions.find((o) => o.value === v)?.label ?? v
  const impactLabel = (v: string) => impactOptions.find((o) => o.value === v)?.label ?? v

  const fields: FieldDef[] = [
    { name: "kind", label: t("contextMod.fKind"), type: "select", options: kindOptions },
    { name: "impact", label: t("contextMod.fImpact"), type: "select", options: impactOptions },
    { name: "title", label: t("contextMod.fTitle"), required: true, full: true, placeholder: t("contextMod.fTitlePlaceholder") },
    { name: "description", label: t("contextMod.fDescription"), type: "textarea", placeholder: t("contextMod.fDescriptionPlaceholder") },
    { name: "needs", label: t("contextMod.fNeeds"), type: "textarea", placeholder: t("contextMod.fNeedsPlaceholder") },
  ]

  const internal = issues.filter((i) => i.kind === "internal").length
  const external = issues.filter((i) => i.kind === "external").length
  const parties = issues.filter((i) => i.kind === "interested_party").length

  const columns: Column<Issue>[] = [
    {
      key: "title",
      header: t("contextMod.colIssue"),
      render: (r) => <span className="font-medium text-foreground">{r.title}</span>,
    },
    {
      key: "kind",
      header: t("contextMod.fKind"),
      render: (r) => (
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
          {kindLabel(r.kind)}
        </span>
      ),
    },
    {
      key: "description",
      header: t("contextMod.fDescription"),
      render: (r) => <span className="line-clamp-2 max-w-xs text-muted-foreground">{r.description || r.needs || "-"}</span>,
    },
    {
      key: "impact",
      header: t("contextMod.fImpact"),
      render: (r) => <span className="text-muted-foreground">{impactLabel(r.impact)}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end">
          <DeleteButton id={r.id} action={deleteContextIssue} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.contextTitle")}
      subtitle={t("pageHeaders.contextSubtitle")}
      user={user}
      action={<RecordDialog title={t("contextMod.dialogTitle")} description={t("contextMod.dialogDesc")} triggerLabel={t("contextMod.trigger")} fields={fields} action={createContextIssue} />}
    >
      <IsoClauseBadge ids={["4.1", "4.2"]} locale={locale} className="mb-4" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("contextMod.kpiTotal")} value={issues.length} icon={Building2} tone="blue" />
        <KpiCard label={t("contextMod.kpiInternal")} value={internal} icon={Factory} tone="primary" />
        <KpiCard label={t("contextMod.kpiExternal")} value={external} icon={Globe2} tone="accent" />
        <KpiCard label={t("contextMod.kpiParties")} value={parties} icon={Users} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("contextMod.registryTitle")}</h2>
        <DataTable columns={columns} rows={issues} emptyMessage={t("contextMod.emptyMessage")} />
      </div>
    </AppShell>
  )
}
