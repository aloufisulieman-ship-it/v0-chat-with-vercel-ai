import { AppShell } from "@/components/app-shell"
import { KpiCard } from "@/components/kpi-card"
import { RecordDetailsDialog } from "@/components/record-details-dialog"
import { Button } from "@/components/ui/button"
import { Eye, Banknote, Ban, CheckCircle2 } from "lucide-react"
import { requireModule } from "@/lib/session"
import { getFinanceViolations, updateFinanceViolation } from "@/app/actions/finance"
import { statusLabels } from "@/lib/labels"
import { categoryLabels } from "@/lib/violation-category"
import { normalizeFinanceStatus } from "@/lib/finance-status"
import { FinanceClosureBlock } from "@/components/finance-closure-block"
import { FinanceActionCard } from "./finance-action-card"

export default async function FinancePage() {
  const user = await requireModule("finance")
  const violations = await getFinanceViolations()

  const pending = violations.filter((v) => normalizeFinanceStatus(v.financeStatus) !== "closed").length
  const closed = violations.filter((v) => normalizeFinanceStatus(v.financeStatus) === "closed").length

  return (
    <AppShell
      title="المالية"
      subtitle="متابعة المخالفات الخارجية المحوّلة إلى المالية وتسجيل رقم الستلمنت وإيصال الدفع"
      user={user}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="مخالفات خارجية" value={violations.length} icon={Ban} tone="blue" />
        <KpiCard label="قيد المعالجة" value={pending} icon={Banknote} tone="accent" />
        <KpiCard label="مغلقة" value={closed} icon={CheckCircle2} tone="primary" />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-foreground">المخالفات الخارجية المحوّلة للمالية</h2>
        {violations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            لا توجد مخالفات خارجية محوّلة إلى المالية.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {violations.map((v) => (
              <FinanceActionCard
                key={v.id}
                id={v.id}
                action={updateFinanceViolation}
                refLabel={`v-${v.id}`}
                financeStatus={v.financeStatus}
                initialSettlement={v.settlementNumber ?? ""}
                initialReceipt={v.paymentReceiptUrl ?? ""}
                closedBy={v.financeClosedBy ?? ""}
                closedAt={v.financeClosedAt ? v.financeClosedAt.toISOString() : ""}
                rows={[
                  { label: "رقم المخالفة", value: <span dir="ltr" className="font-mono text-xs">{v.documentNo || "-"}</span> },
                  { label: "المخالف / الشركة", value: v.companyName || v.employeeName },
                  { label: "نوع المخالفة", value: v.violationType || "-" },
                  { label: "التاريخ", value: <span dir="ltr" className="font-mono text-xs">{v.violationDate ?? "-"}</span> },
                ]}
                details={
                  <RecordDetailsDialog
                    module="violations"
                    recordId={v.id}
                    title={`مخالفة: ${v.companyName || v.employeeName}`}
                    subtitle="نموذج مخالفة رسمي"
                    documentNo={v.documentNo ?? undefined}
                    trigger={
                      <Button type="button" variant="outline" size="sm">
                        <Eye className="size-4" />
                        عرض التفاصيل
                      </Button>
                    }
                    fields={[
                      { label: "اسم المخالف", value: v.employeeName },
                      { label: "اسم الشركة", value: v.companyName || "-" },
                      { label: "نوع المخالفة", value: v.violationType || "-" },
                      { label: "التصنيف", value: categoryLabels[v.category ?? "external"] ?? "-" },
                      { label: "الإجراء الخارجي", value: v.internalAction || "-" },
                      { label: "التاريخ", value: v.violationDate ?? "-" },
                      { label: "المكان", value: v.place || "-" },
                      { label: "وصف المخالفة", value: v.description || "-" },
                      { label: "رقم الستلمنت", value: v.settlementNumber || "-" },
                      { label: "الحالة", value: statusLabels[v.status ?? ""] ?? "-" },
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
    </AppShell>
  )
}
