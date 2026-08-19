import { AlertTriangle, AlertOctagon, CheckCircle2, Clock } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge, SeverityBadge } from "@/components/status-badge"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getIncidents, deleteIncident } from "@/app/actions/hse"
import { getServerT } from "@/lib/i18n/server"
import { severityLabel, statusLabel } from "@/lib/i18n/labels"
import { formatParties } from "@/lib/incident-types"
import { HrStatusBadge } from "@/components/hr-status-badge"
import { HrClosureBlock } from "@/components/hr-closure-block"
import { FinanceStatusBadge } from "@/components/finance-status-badge"
import { FinanceClosureBlock } from "@/components/finance-closure-block"
import { IncidentFormDialog } from "./incident-form"

type Incident = Awaited<ReturnType<typeof getIncidents>>[number]

export default async function IncidentsPage() {
  const user = await requireModule("incidents")
  const incidents = await getIncidents()
  const { t } = await getServerT()
  const notifiedLabel = (v: string | null) => (v === "yes" ? t("incidents.yes") : t("incidents.no"))

  const open = incidents.filter((i) => i.status === "open" || i.status === "in_progress" || i.status === "investigating").length
  const closed = incidents.filter((i) => i.status === "closed").length
  const critical = incidents.filter((i) => i.severity === "critical" || i.severity === "high").length

  const columns: Column<Incident>[] = [
    { key: "documentNo", header: t("incidents.fIncidentNo"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.documentNo || "-"}</span> },
    { key: "title", header: t("incidents.colType"), render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    { key: "location", header: t("incidents.colLocation"), render: (r) => <span className="text-muted-foreground">{r.location || "-"}</span> },
    { key: "reportedBy", header: t("incidents.colReporter"), render: (r) => <span className="text-muted-foreground">{r.reportedBy || "-"}</span> },
    { key: "severity", header: t("incidents.colSeverity"), render: (r) => <SeverityBadge severity={r.severity ?? "low"} /> },
    { key: "status", header: t("incidents.colStatus"), render: (r) => <StatusBadge status={r.status ?? "open"} /> },
    { key: "incidentDate", header: t("incidents.colDate"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.incidentDate ?? "-"}</span> },
    {
      key: "routedTo", header: t("incidents.colRoutedTo"),
      render: (r) => r.routedTo === "hr"
        ? <HrStatusBadge hrStatus={r.hrStatus} />
        : r.routedTo === "finance"
          ? <FinanceStatusBadge financeStatus={r.financeStatus} />
          : <span className="text-xs text-muted-foreground">{t("incidents.notRouted")}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RecordDetailsDialog
            module="incidents"
            recordId={r.id}
            title={r.title}
            subtitle={t("incidents.reportTitle")}
            documentNo={r.documentNo || undefined}
            fields={[
              { label: t("incidents.fIncidentNo"), value: r.documentNo || "-" },
              { label: t("incidents.fIncidentType"), value: r.title },
              { label: t("incidents.fRoutedTo"), value: r.routedTo === "hr" ? t("incidents.routedHr") : r.routedTo === "finance" ? t("incidents.routedFinance") : t("incidents.notRouted") },
              { label: t("incidents.fLocation"), value: r.location || "-" },
              { label: t("incidents.fIncidentDate"), value: r.incidentDate ?? "-" },
              { label: t("incidents.fIncidentTime"), value: r.incidentTime || "-" },
              { label: t("incidents.fSeverity"), value: r.severity ? severityLabel(t, r.severity) : "-" },
              { label: t("incidents.fStatus"), value: r.status ? statusLabel(t, r.status) : "-" },
              { label: t("incidents.fReporter"), value: r.reportedBy || "-" },
              { label: t("incidents.fDescription"), value: r.description || "-" },
              { label: t("incidents.fDirectCauses"), value: r.directCauses || "-" },
              { label: t("incidents.fRootCauses"), value: r.rootCauses || "-" },
              { label: t("incidents.fPropertyDamage"), value: r.propertyDamage || "-" },
              { label: t("incidents.fDamageCost"), value: r.damageCost || "-" },
              { label: t("incidents.fImmediateActions"), value: r.immediateActions || "-" },
              { label: t("incidents.fParties"), value: formatParties(r.parties) },
              { label: t("incidents.fWitnesses"), value: r.witnesses || "-" },
              { label: t("incidents.fAuthoritiesNotified"), value: notifiedLabel(r.authoritiesNotified) },
              { label: t("incidents.fAuthorityName"), value: r.authorityName || "-" },
              { label: t("incidents.fRecommendations"), value: r.recommendations || "-" },
            ]}
            signatures={[
              { label: t("incidents.sigReporter"), value: r.reporterSignature || "" },
              { label: t("incidents.sigSafety"), value: r.safetySignature || "" },
              { label: t("incidents.sigHr"), value: r.hrSignature || "" },
              { label: t("incidents.sigGm"), value: r.gmSignature || "" },
            ]}
            initialAttachments={[]}
            extraSection={
              r.routedTo === "hr" ? (
                <HrClosureBlock
                  hrStatus={r.hrStatus}
                  hrAction={r.hrAction}
                  hrActionDate={r.hrActionDate}
                  closedBy={r.hrClosedBy}
                  closedAt={r.hrClosedAt}
                  attachmentsRaw={r.hrAttachmentUrl}
                />
              ) : r.routedTo === "finance" ? (
                <FinanceClosureBlock
                  financeStatus={r.financeStatus}
                  settlementNumber={r.settlementNumber}
                  receiptUrl={r.paymentReceiptUrl}
                  closedBy={r.financeClosedBy}
                  closedAt={r.financeClosedAt}
                />
              ) : undefined
            }
          />
          <DeleteButton id={r.id} action={deleteIncident} />
        </div>
      ),
    },
  ]

  return (
    <AppShell
      title={t("pageHeaders.incidentsTitle")}
      subtitle={t("pageHeaders.incidentsSubtitle")}
      user={user}
      action={<IncidentFormDialog defaultReporter={user.name ?? ""} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("incidents.kpiTotal")} value={incidents.length} icon={AlertOctagon} tone="blue" />
        <KpiCard label={t("incidents.kpiOpen")} value={open} icon={Clock} tone="accent" />
        <KpiCard label={t("incidents.kpiCritical")} value={critical} icon={AlertTriangle} tone="destructive" />
        <KpiCard label={t("incidents.kpiClosed")} value={closed} icon={CheckCircle2} tone="primary" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("incidents.registryTitle")}</h2>
        <DataTable columns={columns} rows={incidents} emptyMessage={t("incidents.emptyMessage")} />
      </div>
    </AppShell>
  )
}
