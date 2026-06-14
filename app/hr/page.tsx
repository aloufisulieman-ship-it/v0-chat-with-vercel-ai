import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { Button } from "@/components/ui/button"
import { Eye, Users, Ban, AlertTriangle } from "lucide-react"
import { requireModule } from "@/lib/session"
import { getHrViolations, getHrIncidents, updateHrViolation, updateHrIncident } from "@/app/actions/hr"
import { statusLabels, severityLabels } from "@/lib/labels"
import { categoryLabels } from "@/lib/violation-category"
import { formatParties } from "@/lib/incident-types"
import { HrActionCard } from "./hr-action-card"

export default async function HrPage() {
  const user = await requireModule("hr")
  const [violations, incidents] = await Promise.all([getHrViolations(), getHrIncidents()])

  const pendingViolations = violations.filter((v) => v.status !== "closed").length
  const pendingIncidents = incidents.filter((i) => i.status !== "closed").length

  return (
    <AppShell
      title="الموارد البشرية"
      subtitle="متابعة المخالفات والحوادث المحوّلة إلى الموارد البشرية واتخاذ الإجراء المناسب"
      user={user}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="مخالفات محوّلة" value={violations.length} icon={Ban} tone="blue" />
        <KpiCard label="حوادث موظفين" value={incidents.length} icon={AlertTriangle} tone="accent" />
        <KpiCard label="بنود قيد المعالجة" value={pendingViolations + pendingIncidents} icon={Users} tone="primary" />
      </div>

      {/* القائمة الأولى: المخالفات المحوّلة للموارد البشرية */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-foreground">المخالفات المحوّلة للموارد البشرية</h2>
        {violations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            لا توجد مخالفات محوّلة إلى الموارد البشرية.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {violations.map((v) => (
              <HrActionCard
                key={v.id}
                id={v.id}
                action={updateHrViolation}
                refLabel={`v-${v.id}`}
                status={v.status ?? "open"}
                rows={[
                  { label: "رقم المخالفة", value: <span dir="ltr" className="font-mono text-xs">{v.documentNo || "-"}</span> },
                  { label: "اسم الموظف", value: v.employeeName },
                  { label: "نوع المخالفة", value: v.violationType || "-" },
                  { label: "التاريخ", value: <span dir="ltr" className="font-mono text-xs">{v.violationDate ?? "-"}</span> },
                ]}
                initialAction={v.hrAction ?? ""}
                initialDate={v.hrActionDate ?? ""}
                initialNotes={v.hrNotes ?? ""}
                details={
                  <RecordDetailsDialog
                    module="violations"
                    recordId={v.id}
                    title={`مخالفة: ${v.employeeName}`}
                    subtitle="نموذج مخالفة رسمي"
                    documentNo={v.documentNo ?? undefined}
                    trigger={
                      <Button type="button" variant="outline" size="sm">
                        <Eye className="size-4" />
                        عرض التفاصيل
                      </Button>
                    }
                    fields={[
                      { label: "اسم الموظف", value: v.employeeName },
                      { label: "الرقم الوظيفي", value: v.employeeNo || "-" },
                      { label: "نوع المخالفة", value: v.violationType || "-" },
                      { label: "التصنيف", value: categoryLabels[v.category ?? "internal"] ?? "-" },
                      { label: "الإجراء الداخلي", value: v.internalAction || "-" },
                      { label: "التاريخ", value: v.violationDate ?? "-" },
                      { label: "المكان", value: v.place || "-" },
                      { label: "وصف المخالفة", value: v.description || "-" },
                      { label: "إجراء الموارد البشرية", value: v.hrAction || "-" },
                      { label: "تاريخ إجراء HR", value: v.hrActionDate ?? "-" },
                      { label: "ملاحظات HR", value: v.hrNotes || "-" },
                      { label: "الحالة", value: statusLabels[v.status ?? ""] ?? "-" },
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
        <h2 className="mb-3 text-lg font-semibold text-foreground">الحوادث الداخلية المحوّلة</h2>
        {incidents.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            لا توجد حوادث داخلية تخص موظفين.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {incidents.map((i) => (
              <HrActionCard
                key={i.id}
                id={i.id}
                action={updateHrIncident}
                refLabel={`i-${i.id}`}
                status={i.status ?? "open"}
                rows={[
                  { label: "رقم الحادثة", value: <span dir="ltr" className="font-mono text-xs">{i.documentNo || "-"}</span> },
                  { label: "النوع", value: i.title },
                  { label: "الموقع", value: i.location || "-" },
                  { label: "التاريخ", value: <span dir="ltr" className="font-mono text-xs">{i.incidentDate ?? "-"}</span> },
                ]}
                initialAction={i.hrAction ?? ""}
                initialDate={i.hrActionDate ?? ""}
                initialNotes={i.hrNotes ?? ""}
                details={
                  <RecordDetailsDialog
                    module="incidents"
                    recordId={i.id}
                    title={i.title}
                    subtitle="تقرير حادثة"
                    documentNo={i.documentNo || undefined}
                    trigger={
                      <Button type="button" variant="outline" size="sm">
                        <Eye className="size-4" />
                        عرض التفاصيل
                      </Button>
                    }
                    fields={[
                      { label: "رقم الحادثة", value: i.documentNo || "-" },
                      { label: "نوع الحادثة", value: i.title },
                      { label: "الموقع", value: i.location || "-" },
                      { label: "تاريخ الحادثة", value: i.incidentDate ?? "-" },
                      { label: "الخطورة", value: severityLabels[i.severity ?? ""] ?? "-" },
                      { label: "وصف تفصيلي", value: i.description || "-" },
                      { label: "الأطراف المتضررة", value: formatParties(i.parties) },
                      { label: "إجراء الموارد البشرية", value: i.hrAction || "-" },
                      { label: "تاريخ إجراء HR", value: i.hrActionDate ?? "-" },
                      { label: "ملاحظات HR", value: i.hrNotes || "-" },
                      { label: "الحالة", value: statusLabels[i.status ?? ""] ?? "-" },
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
