import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { Button } from "@/components/ui/button"
import { Eye, Users, Ban, AlertTriangle } from "lucide-react"
import { requireModule } from "@/lib/session"
import { getHrViolations, getHrIncidents, updateHrViolation, updateHrIncident } from "@/app/actions/hr"
import { getServerT } from "@/lib/i18n/server"
import { getNotifications } from "@/app/actions/lifecycle"
import { DeptInbox } from "@/components/lifecycle/dept-inbox"
import { statusLabel, severityLabel, categoryLabel } from "@/lib/i18n/labels"
import { formatParties } from "@/lib/incident-types"
import { normalizeHrStatus, parseHrAttachments } from "@/lib/hr-status"
import { HR_OFFICER_SIGNATURE_ROLE } from "@/lib/signature-roles"
import { HrActionCard } from "./hr-action-card"

export default async function HrPage() {
  const user = await requireModule("hr")
  const { t, locale } = await getServerT()
  const [violations, incidents, inbox] = await Promise.all([getHrViolations(), getHrIncidents(), getNotifications("hr")])

  // القوائم النشطة تستبعد المغلقة: بمجرد الإغلاق تختفي المخالفة/الحادثة من قسم HR
  // وتظهر ضمن سجلّي "المخالفات"/"الحوادث" العامّين. عدّادات الـ KPI تبقى على القوائم
  // الكاملة لإظهار الإجمالي الصحيح (لا حذف بيانات — فلترة عرض فقط).
  const activeViolations = violations.filter((v) => normalizeHrStatus(v.hrStatus) !== "closed")
  const activeIncidents = incidents.filter((i) => normalizeHrStatus(i.hrStatus) !== "closed")
  const pendingViolations = activeViolations.length
  const pendingIncidents = activeIncidents.length

  return (
    <AppShell
      title={t("hr.title")}
      subtitle={t("hr.subtitle")}
      user={user}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label={t("hr.kpiViolations")} value={violations.length} icon={Ban} tone="blue" />
        <KpiCard label={t("hr.kpiIncidents")} value={incidents.length} icon={AlertTriangle} tone="accent" />
        <KpiCard label={t("hr.kpiPending")} value={pendingViolations + pendingIncidents} icon={Users} tone="primary" />
      </div>

      <div className="mt-6">
        <DeptInbox dept="hr" items={inbox} locale={locale === "en" ? "en" : "ar"} />
      </div>

      {/* القائمة الأولى: المخالفات المحوّلة للموارد البشرية */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("hr.violationsSection")}</h2>
        {activeViolations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("hr.noViolations")}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {activeViolations.map((v) => (
              <HrActionCard
                key={v.id}
                id={v.id}
                action={updateHrViolation}
                refLabel={`v-${v.id}`}
                hrStatus={v.hrStatus}
                module="violations"
                signatureRole={HR_OFFICER_SIGNATURE_ROLE}
                initialAttachments={parseHrAttachments(v.hrAttachmentUrl)}
                closedBy={v.hrClosedBy ?? ""}
                closedAt={v.hrClosedAt ? v.hrClosedAt.toISOString() : ""}
                rows={[
                  { label: t("hr.violationNo"), value: <span dir="ltr" className="font-mono text-xs">{v.documentNo || "-"}</span> },
                  { label: t("hr.employeeName"), value: v.employeeName },
                  { label: t("hr.violationType"), value: v.violationType || "-" },
                  { label: t("hr.date"), value: <span dir="ltr" className="font-mono text-xs">{v.violationDate ?? "-"}</span> },
                ]}
                initialAction={v.hrAction ?? ""}
                initialDate={v.hrActionDate ?? ""}
                initialNotes={v.hrNotes ?? ""}
                details={
                  <RecordDetailsDialog
                    module="violations"
                    recordId={v.id}
                    title={`${t("hr.violationPrefix")} ${v.employeeName}`}
                    subtitle={t("hr.violationReport")}
                    documentNo={v.documentNo ?? undefined}
                    trigger={
                      <Button type="button" variant="outline" size="sm">
                        <Eye className="size-4" />
                        {t("hr.viewDetails")}
                      </Button>
                    }
                    fields={[
                      { label: t("hr.employeeName"), value: v.employeeName },
                      { label: t("hr.employeeNo"), value: v.employeeNo || "-" },
                      { label: t("hr.violationType"), value: v.violationType || "-" },
                      { label: t("hr.category"), value: categoryLabel(t, v.category ?? "internal") },
                      { label: t("hr.internalAction"), value: v.internalAction || "-" },
                      { label: t("hr.date"), value: v.violationDate ?? "-" },
                      { label: t("hr.place"), value: v.place || "-" },
                      { label: t("hr.violationDesc"), value: v.description || "-" },
                      { label: t("hr.hrAction"), value: v.hrAction || "-" },
                      { label: t("hr.hrActionDate"), value: v.hrActionDate ?? "-" },
                      { label: t("hr.hrNotes"), value: v.hrNotes || "-" },
                      { label: t("hr.status"), value: v.status ? statusLabel(t, v.status) : "-" },
                    ]}
                    initialAttachments={[]}
                  />
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* القائمة الثانية: الحوادث الداخلية المحوّلة (طرف متضرر موظف) */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("hr.incidentsSection")}</h2>
        {activeIncidents.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("hr.noIncidents")}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {activeIncidents.map((i) => (
              <HrActionCard
                key={i.id}
                id={i.id}
                action={updateHrIncident}
                refLabel={`i-${i.id}`}
                hrStatus={i.hrStatus}
                module="incidents"
                signatureRole={HR_OFFICER_SIGNATURE_ROLE}
                initialAttachments={parseHrAttachments(i.hrAttachmentUrl)}
                closedBy={i.hrClosedBy ?? ""}
                closedAt={i.hrClosedAt ? i.hrClosedAt.toISOString() : ""}
                rows={[
                  { label: t("hr.incidentNo"), value: <span dir="ltr" className="font-mono text-xs">{i.documentNo || "-"}</span> },
                  { label: t("hr.type"), value: i.title },
                  { label: t("hr.location"), value: i.location || "-" },
                  { label: t("hr.date"), value: <span dir="ltr" className="font-mono text-xs">{i.incidentDate ?? "-"}</span> },
                ]}
                initialAction={i.hrAction ?? ""}
                initialDate={i.hrActionDate ?? ""}
                initialNotes={i.hrNotes ?? ""}
                details={
                  <RecordDetailsDialog
                    module="incidents"
                    recordId={i.id}
                    title={i.title}
                    subtitle={t("hr.incidentReport")}
                    documentNo={i.documentNo || undefined}
                    trigger={
                      <Button type="button" variant="outline" size="sm">
                        <Eye className="size-4" />
                        {t("hr.viewDetails")}
                      </Button>
                    }
                    fields={[
                      { label: t("hr.incidentNo"), value: i.documentNo || "-" },
                      { label: t("hr.incidentType"), value: i.title },
                      { label: t("hr.location"), value: i.location || "-" },
                      { label: t("hr.incidentDate"), value: i.incidentDate ?? "-" },
                      { label: t("hr.severity"), value: i.severity ? severityLabel(t, i.severity) : "-" },
                      { label: t("hr.description"), value: i.description || "-" },
                      { label: t("hr.parties"), value: formatParties(i.parties) },
                      { label: t("hr.hrAction"), value: i.hrAction || "-" },
                      { label: t("hr.hrActionDate"), value: i.hrActionDate ?? "-" },
                      { label: t("hr.hrNotes"), value: i.hrNotes || "-" },
                      { label: t("hr.status"), value: i.status ? statusLabel(t, i.status) : "-" },
                    ]}
                    initialAttachments={[]}
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
