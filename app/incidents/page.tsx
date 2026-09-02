import { AlertTriangle, AlertOctagon, CheckCircle2, Clock } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge, SeverityBadge } from "@/components/status-badge"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { DeleteButton } from "@/components/delete-button"
import { requireModule } from "@/lib/session"
import { getIncidents, deleteIncident, getCompany, getIncidentSignatureInfo } from "@/app/actions/hse"
import { AUDITOR_SIGNATURE_ROLE, FINANCE_OFFICER_SIGNATURE_ROLE, HR_OFFICER_SIGNATURE_ROLE } from "@/lib/signature-roles"
import { getServerT } from "@/lib/i18n/server"
import { severityLabel, statusLabel } from "@/lib/i18n/labels"
import { formatParties } from "@/lib/incident-types"
import type { EmailSenderInfo } from "@/lib/email-export"
import { HrStatusBadge } from "@/components/hr-status-badge"
import { HrClosureBlock } from "@/components/hr-closure-block"
import { FinanceStatusBadge } from "@/components/finance-status-badge"
import { FinanceClosureBlock } from "@/components/finance-closure-block"
import { IncidentFormDialog } from "./incident-form"
import { LifecycleFilterBar } from "@/components/lifecycle/lifecycle-filter-bar"
import { DeptBadge, DueDateBadge, LifecycleBadge, SourceBadge } from "@/components/lifecycle/lifecycle-badges"
import { LifecycleActions } from "@/components/lifecycle/lifecycle-actions"
import {
  applyLifecycleFilters,
  classificationLabel,
  isArchived,
  lifecycleLabel,
  lifecycleUi,
  normalizeLifecycle,
} from "@/lib/lifecycle"

type Incident = Awaited<ReturnType<typeof getIncidents>>[number]

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; dept?: string; source?: string }>
}) {
  const user = await requireModule("incidents")
  const [incidents, companyProfile, sp, sigInfo] = await Promise.all([
    getIncidents(),
    getCompany().catch(() => null),
    searchParams,
    getIncidentSignatureInfo().catch(() => ({}) as Awaited<ReturnType<typeof getIncidentSignatureInfo>>),
  ])
  const { t, locale } = await getServerT()
  const isAdmin = user.role === "admin"
  const emailLocale = locale === "en" ? "en" : "ar"
  const lc = lifecycleUi(emailLocale)
  const lf = applyLifecycleFilters(incidents, sp)
  const notifiedLabel = (v: string | null) => (v === "yes" ? t("incidents.yes") : t("incidents.no"))
  // بيانات المُرسل المُلحقة تلقائياً بتوقيع رسالة البريد الرسمية.
  const emailSender: EmailSenderInfo = {
    companyName: companyProfile?.name || undefined,
    phone: companyProfile?.phone || undefined,
    email: companyProfile?.email || undefined,
    address: companyProfile?.address || undefined,
  }
  // وصف الإصابات في نص الرسالة: الأطراف المتضررة المسجّلة في الحادث (سطر واحد لكل طرف).
  const injuriesText = (r: Incident) => {
    const p = formatParties(r.parties)
    return p === "-" ? "" : p.replace(/\n/g, "؛ ")
  }

  const open = incidents.filter((i) => i.status === "open" || i.status === "in_progress" || i.status === "investigating").length
  const closed = incidents.filter((i) => i.status === "closed").length
  const critical = incidents.filter((i) => i.severity === "critical" || i.severity === "high").length

  const columns: Column<Incident>[] = [
    { key: "documentNo", header: t("incidents.fIncidentNo"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.documentNo || "-"}</span> },
    { key: "title", header: t("incidents.colType"), render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    { key: "location", header: t("incidents.colLocation"), render: (r) => <span className="text-muted-foreground">{r.location || "-"}</span> },
    { key: "reportedBy", header: t("incidents.colReporter"), render: (r) => <span className="text-muted-foreground">{r.reportedBy || "-"}</span> },
    { key: "severity", header: t("incidents.colSeverity"), render: (r) => <SeverityBadge severity={r.severity ?? "low"} /> },
    { key: "status", header: t("incidents.colStatus"), render: (r) => <LifecycleBadge status={r.lifecycleStatus} locale={emailLocale} /> },
    { key: "source", header: lc.source, render: (r) => <SourceBadge source={r.source} locale={emailLocale} /> },
    { key: "incidentDate", header: t("incidents.colDate"), render: (r) => <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.incidentDate ?? "-"}</span> },
    {
      key: "classification",
      header: lc.classification,
      render: (r) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">{classificationLabel(r.classification, emailLocale)}</span>
      ),
    },
    { key: "routedTo", header: t("incidents.colRoutedTo"), render: (r) => <DeptBadge dept={r.assignedDept ?? r.routedTo} locale={emailLocale} /> },
    { key: "dueDate", header: lc.dueDateCol, render: (r) => <DueDateBadge dueDate={r.dueDate} status={r.lifecycleStatus} locale={emailLocale} /> },
    {
      key: "actions",
      header: "",
      className: "text-left",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <LifecycleActions
            module="incidents"
            recordId={r.id}
            status={r.lifecycleStatus}
            assignedDept={r.assignedDept}
            classification={r.classification}
            isAdmin={isAdmin}
            locale={emailLocale}
          />
          <RecordDetailsDialog
            module="incidents"
            recordId={r.id}
            title={r.title}
            subtitle={t("incidents.reportTitle")}
            documentNo={r.documentNo || undefined}
            fields={[
              { label: t("incidents.fIncidentNo"), value: r.documentNo || "-" },
              { label: t("incidents.fIncidentType"), value: r.title },
              { label: lc.classification, value: classificationLabel(r.classification, emailLocale) },
              { label: t("incidents.fRoutedTo"), value: r.routedTo === "hr" ? t("incidents.routedHr") : r.routedTo === "finance" ? t("incidents.routedFinance") : t("incidents.notRouted") },
              { label: t("incidents.fLocation"), value: r.location || "-" },
              { label: t("incidents.fIncidentDate"), value: r.incidentDate ?? "-" },
              { label: t("incidents.fIncidentTime"), value: r.incidentTime || "-" },
              { label: t("incidents.fSeverity"), value: r.severity ? severityLabel(t, r.severity) : "-" },
              { label: t("incidents.fStatus"), value: lifecycleLabel(normalizeLifecycle(r.lifecycleStatus), emailLocale) },
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
            // قسم التوقيعات الرسمية (5 خانات، بلا تكرار): المُبلّغ، مدير السلامة، المدقّق،
            // ثم توقيع الجهة المعالجة وفق التصنيف (HR للداخلية / المالية للخارجية)، والمدير العام.
            // توقيع HR من النموذج وتوقيع مسؤول HR المرفق يُوحَّدان في خانة واحدة (الأحدث يغلب).
            signatures={[
              { label: t("incidents.sigReporter"), value: r.reporterSignature || "" },
              { label: t("incidents.sigSafety"), value: r.safetySignature || "" },
              { label: AUDITOR_SIGNATURE_ROLE.label, value: sigInfo[r.id]?.auditor || "" },
              r.classification === "external"
                ? { label: FINANCE_OFFICER_SIGNATURE_ROLE.label, value: sigInfo[r.id]?.financeOfficer || "" }
                : { label: t("incidents.sigHr"), value: sigInfo[r.id]?.hrOfficer || r.hrSignature || "" },
              { label: t("incidents.sigGm"), value: r.gmSignature || "" },
            ]}
            extraSignatureRoles={[
              AUDITOR_SIGNATURE_ROLE,
              r.classification === "external" ? FINANCE_OFFICER_SIGNATURE_ROLE : HR_OFFICER_SIGNATURE_ROLE,
            ]}
            initialAttachments={[]}
            lifecycle={{ status: r.lifecycleStatus, source: r.source, assignedDept: r.assignedDept ?? r.routedTo }}
            emailSender={emailSender}
            emailContext={{
              kind: "incident",
              number: r.documentNo || String(r.id),
              type: r.title,
              date: r.incidentDate ?? "",
              time: r.incidentTime || "",
              location: r.location || "",
              severity: r.severity ? severityLabel(t, r.severity) : "",
              injuries: injuriesText(r),
              status: lifecycleLabel(normalizeLifecycle(r.lifecycleStatus), emailLocale),
            }}
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
          {!isArchived(r) && <DeleteButton id={r.id} action={deleteIncident} />}
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

      <div className="mt-6 flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">{t("incidents.registryTitle")}</h2>
        <LifecycleFilterBar locale={emailLocale} counts={lf.counts} status={lf.status} dept={lf.dept} source={lf.source} />
        <DataTable columns={columns} rows={lf.filtered} emptyMessage={t("incidents.emptyMessage")} />
      </div>
    </AppShell>
  )
}
