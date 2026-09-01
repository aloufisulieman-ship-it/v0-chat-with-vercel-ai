import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { Button } from "@/components/ui/button"
import { Eye, Banknote, Ban, CheckCircle2 } from "lucide-react"
import { requireModule } from "@/lib/session"
import { getFinanceIncidents, getFinanceViolations, updateFinanceIncident, updateFinanceViolation } from "@/app/actions/finance"
import { getServerT } from "@/lib/i18n/server"
import { statusLabel, categoryLabel } from "@/lib/i18n/labels"
import { normalizeFinanceStatus } from "@/lib/finance-status"
import { FINANCE_OFFICER_SIGNATURE_ROLE } from "@/lib/signature-roles"
import { FinanceClosureBlock } from "@/components/finance-closure-block"
import { FinanceActionCard } from "./finance-action-card"

export default async function FinancePage() {
  const user = await requireModule("finance")
  const { t } = await getServerT()
  const [violations, incidents] = await Promise.all([getFinanceViolations(), getFinanceIncidents()])

  const allItems = [...violations, ...incidents]
  const pending = allItems.filter((v) => normalizeFinanceStatus(v.financeStatus) !== "closed").length
  const closed = allItems.filter((v) => normalizeFinanceStatus(v.financeStatus) === "closed").length

  // القوائم النشطة تستبعد المغلقة: بمجرد الإغلاق تختفي المخالفة/الحادثة من قسم المالية
  // وتظهر ضمن سجلّي "المخالفات"/"الحوادث" العامّين. عدّادات الـ KPI تبقى على القوائم
  // الكاملة (بما فيها عدّاد "المغلقة") لإظهار الإجمالي الصحيح — فلترة عرض فقط، بلا حذف.
  const activeViolations = violations.filter((v) => normalizeFinanceStatus(v.financeStatus) !== "closed")
  const activeIncidents = incidents.filter((i) => normalizeFinanceStatus(i.financeStatus) !== "closed")

  return (
    <AppShell
      title={t("finance.title")}
      subtitle={t("finance.subtitle")}
      user={user}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("finance.kpiExternal")} value={violations.length} icon={Ban} tone="blue" />
        <KpiCard label={t("finance.kpiIncidents")} value={incidents.length} icon={Banknote} tone="blue" />
        <KpiCard label={t("finance.kpiPending")} value={pending} icon={Banknote} tone="accent" />
        <KpiCard label={t("finance.kpiClosed")} value={closed} icon={CheckCircle2} tone="primary" />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("finance.violationsSection")}</h2>
        {activeViolations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("finance.noViolations")}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {activeViolations.map((v) => (
              <FinanceActionCard
                key={v.id}
                id={v.id}
                action={updateFinanceViolation}
                refLabel={`v-${v.id}`}
                financeStatus={v.financeStatus}
                module="violations"
                signatureRole={FINANCE_OFFICER_SIGNATURE_ROLE}
                initialSettlement={v.settlementNumber ?? ""}
                initialReceipt={v.paymentReceiptUrl ?? ""}
                closedBy={v.financeClosedBy ?? ""}
                closedAt={v.financeClosedAt ? v.financeClosedAt.toISOString() : ""}
                rows={[
                  { label: t("finance.violationNo"), value: <span dir="ltr" className="font-mono text-xs">{v.documentNo || "-"}</span> },
                  { label: t("finance.offenderCompany"), value: v.companyName || v.employeeName },
                  { label: t("finance.violationType"), value: v.violationType || "-" },
                  { label: t("finance.date"), value: <span dir="ltr" className="font-mono text-xs">{v.violationDate ?? "-"}</span> },
                ]}
                details={
                  <RecordDetailsDialog
                    module="violations"
                    recordId={v.id}
                    title={`${t("finance.violationPrefix")} ${v.companyName || v.employeeName}`}
                    subtitle={t("finance.violationReport")}
                    documentNo={v.documentNo ?? undefined}
                    trigger={
                      <Button type="button" variant="outline" size="sm">
                        <Eye className="size-4" />
                        {t("finance.viewDetails")}
                      </Button>
                    }
                    fields={[
                      { label: t("finance.offenderName"), value: v.employeeName },
                      { label: t("finance.companyName"), value: v.companyName || "-" },
                      { label: t("finance.violationType"), value: v.violationType || "-" },
                      { label: t("finance.category"), value: categoryLabel(t, v.category ?? "external") },
                      { label: t("finance.externalAction"), value: v.internalAction || "-" },
                      { label: t("finance.date"), value: v.violationDate ?? "-" },
                      { label: t("finance.place"), value: v.place || "-" },
                      { label: t("finance.violationDesc"), value: v.description || "-" },
                      { label: t("finance.settlementNo"), value: v.settlementNumber || "-" },
                      { label: t("finance.status"), value: v.status ? statusLabel(t, v.status) : "-" },
                    ]}
                    initialAttachments={[]}
                    extraSection={
                      <FinanceClosureBlock
                        financeStatus={v.financeStatus}
                        settlementNumber={v.settlementNumber}
                        closedBy={v.financeClosedBy}
                        closedAt={v.financeClosedAt}
                        receiptUrl={v.paymentReceiptUrl}
                      />
                    }
                  />
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("finance.incidentsSection")}</h2>
        {activeIncidents.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("finance.noIncidents")}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {activeIncidents.map((incident) => (
              <FinanceActionCard
                key={incident.id}
                id={incident.id}
                action={updateFinanceIncident}
                refLabel={`i-${incident.id}`}
                financeStatus={incident.financeStatus}
                module="incidents"
                signatureRole={FINANCE_OFFICER_SIGNATURE_ROLE}
                initialSettlement={incident.settlementNumber ?? ""}
                initialReceipt={incident.paymentReceiptUrl ?? ""}
                closedBy={incident.financeClosedBy ?? ""}
                closedAt={incident.financeClosedAt ? incident.financeClosedAt.toISOString() : ""}
                rows={[
                  { label: t("finance.incidentNo"), value: <span dir="ltr" className="font-mono text-xs">{incident.documentNo || "-"}</span> },
                  { label: t("finance.incidentType"), value: incident.title },
                  { label: t("finance.location"), value: incident.location || "-" },
                  { label: t("finance.date"), value: <span dir="ltr" className="font-mono text-xs">{incident.incidentDate ?? "-"}</span> },
                ]}
                details={
                  <RecordDetailsDialog
                    module="incidents"
                    recordId={incident.id}
                    title={`${t("finance.incidentPrefix")} ${incident.title}`}
                    subtitle={t("finance.incidentReport")}
                    documentNo={incident.documentNo ?? undefined}
                    trigger={<Button type="button" variant="outline" size="sm"><Eye className="size-4" />{t("finance.viewDetails")}</Button>}
                    fields={[
                      { label: t("finance.incidentType"), value: incident.title },
                      { label: t("finance.location"), value: incident.location || "-" },
                      { label: t("finance.date"), value: incident.incidentDate ?? "-" },
                      { label: t("finance.reporter"), value: incident.reportedBy || "-" },
                      { label: t("finance.description"), value: incident.description || "-" },
                      { label: t("finance.damageCost"), value: incident.damageCost || "-" },
                      { label: t("finance.settlementNo"), value: incident.settlementNumber || "-" },
                      { label: t("finance.status"), value: incident.status ? statusLabel(t, incident.status) : "-" },
                    ]}
                    initialAttachments={[]}
                    extraSection={
                      <FinanceClosureBlock
                        financeStatus={incident.financeStatus}
                        settlementNumber={incident.settlementNumber}
                        closedBy={incident.financeClosedBy}
                        closedAt={incident.financeClosedAt}
                        receiptUrl={incident.paymentReceiptUrl}
                      />
                    }
                  />
                }
              />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  )
}
