import { Scale, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { RecordDialog, type FieldDef } from "@/components/record-dialog"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { IsoClauseBadge } from "@/components/iso-clause-badge"
import { requireModule } from "@/lib/session"
import { getLegalRequirements, createLegalRequirement, deleteLegalRequirement } from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"

type Req = Awaited<ReturnType<typeof getLegalRequirements>>[number]

const statusStyle: Record<string, string> = {
  compliant: "bg-primary/10 text-primary border-primary/20",
  partial: "bg-accent/15 text-amber-700 dark:text-amber-400 border-accent/30",
  non_compliant: "bg-destructive/10 text-destructive border-destructive/20",
}

export default async function LegalRegisterPage() {
  const user = await requireModule("legal-register")
  const requirements = await getLegalRequirements()
  const { t, locale } = await getServerT()

  const statusOptions = [
    { value: "compliant", label: t("legalMod.statusCompliant") },
    { value: "partial", label: t("legalMod.statusPartial") },
    { value: "non_compliant", label: t("legalMod.statusNonCompliant") },
  ]
  const statusLbl = (v: string) => statusOptions.find((o) => o.value === v)?.label ?? v

  const fields: FieldDef[] = [
    { name: "title", label: t("legalMod.fTitle"), required: true, full: true, placeholder: t("legalMod.fTitlePlaceholder") },
    { name: "reference", label: t("legalMod.fReference"), placeholder: t("legalMod.fReferencePlaceholder") },
    { name: "authority", label: t("legalMod.fAuthority"), placeholder: t("legalMod.fAuthorityPlaceholder") },
    { name: "category", label: t("legalMod.fCategory") },
    { name: "applicability", label: t("legalMod.fApplicability"), type: "textarea", placeholder: t("legalMod.fApplicabilityPlaceholder") },
    { name: "complianceStatus", label: t("legalMod.fStatus"), type: "select", options: statusOptions },
    { name: "lastReviewDate", label: t("legalMod.fLastReview"), type: "date" },
  ]

  const compliant = requirements.filter((r) => r.complianceStatus === "compliant").length
  const partial = requirements.filter((r) => r.complianceStatus === "partial").length
  const nonCompliant = requirements.filter((r) => r.complianceStatus === "non_compliant").length

  const columns: Column<Req>[] = [
    {
      key: "title",
      header: t("legalMod.colRequirement"),
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{r.title}</span>
          {r.reference ? <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.reference}</span> : null}
        </div>
      ),
    },
    { key: "authority", header: t("legalMod.fAuthority"), render: (r) => <span className="text-muted-foreground">{r.authority || "-"}</span> },
    { key: "category", header: t("legalMod.fCategory"), render: (r) => <span className="text-muted-foreground">{r.category || "-"}</span> },
    { key: "lastReviewDate", header: t("legalMod.fLastReview"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.lastReviewDate ?? "-"}</span> },
    {
      key: "complianceStatus",
      header: t("legalMod.fStatus"),
      render: (r) => (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${statusStyle[r.complianceStatus] ?? "bg-muted text-muted-foreground border-border"}`}>
          {statusLbl(r.complianceStatus)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="legal-register"
            recordId={r.id}
            title={r.title}
            subtitle={r.reference || t("legalMod.title")}
            fields={[
              { label: t("legalMod.fReference"), value: r.reference || "-" },
              { label: t("legalMod.fAuthority"), value: r.authority || "-" },
              { label: t("legalMod.fCategory"), value: r.category || "-" },
              { label: t("legalMod.fApplicability"), value: r.applicability || "-" },
              { label: t("legalMod.fStatus"), value: statusLbl(r.complianceStatus) },
              { label: t("legalMod.fLastReview"), value: r.lastReviewDate ?? "-" },
            ]}
            initialAttachments={[]}
          />
          <DeleteButton id={r.id} action={deleteLegalRequirement} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.legalTitle")}
      subtitle={t("pageHeaders.legalSubtitle")}
      user={user}
      action={<RecordDialog title={t("legalMod.dialogTitle")} description={t("legalMod.dialogDesc")} triggerLabel={t("legalMod.trigger")} fields={fields} action={createLegalRequirement} />}
    >
      <IsoClauseBadge ids={["6.1.3", "9.1.2"]} locale={locale} className="mb-4" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("legalMod.kpiTotal")} value={requirements.length} icon={Scale} tone="blue" />
        <KpiCard label={t("legalMod.kpiCompliant")} value={compliant} icon={ShieldCheck} tone="primary" />
        <KpiCard label={t("legalMod.kpiPartial")} value={partial} icon={ShieldAlert} tone="accent" />
        <KpiCard label={t("legalMod.kpiNonCompliant")} value={nonCompliant} icon={ShieldX} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("legalMod.registryTitle")}</h2>
        <DataTable columns={columns} rows={requirements} emptyMessage={t("legalMod.emptyMessage")} />
      </div>
    </AppShell>
  )
}
