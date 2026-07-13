import { FileText } from "lucide-react"
import { FinanceStatusBadge } from "@/components/finance-status-badge"
import { normalizeFinanceStatus } from "@/lib/finance-status"

/**
 * كتلة تفاصيل معالجة المالية داخل نافذة تفاصيل السجل — تظهر لجميع المستخدمين.
 * عند الإغلاق تعرض تاريخ الإغلاق ومن أغلق ورقم الستلمنت ومعاينة/رابط إيصال الدفع.
 */
export function FinanceClosureBlock({
  financeStatus,
  settlementNumber,
  closedBy,
  closedAt,
  receiptUrl,
}: {
  financeStatus: string | null | undefined
  settlementNumber: string | null | undefined
  closedBy: string | null | undefined
  closedAt: Date | string | null | undefined
  receiptUrl: string | null | undefined
}) {
  const status = normalizeFinanceStatus(financeStatus)
  const isClosed = status === "closed"
  const closedAtStr = closedAt ? new Date(closedAt).toLocaleString("ar") : ""
  const hasReceipt = !!receiptUrl && receiptUrl.length > 0
  const isImage = hasReceipt && receiptUrl!.startsWith("data:image")

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">حالة المالية</h4>
        <FinanceStatusBadge financeStatus={financeStatus} />
      </div>

      {isClosed ? (
        <dl className="flex flex-col gap-1.5 text-sm">
          {closedAtStr && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">تاريخ الإغلاق:</dt>
              <dd className="text-foreground">{closedAtStr}</dd>
            </div>
          )}
          {closedBy && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">أُغلقت بواسطة:</dt>
              <dd className="text-foreground">{closedBy}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="text-muted-foreground">رقم الستلمنت:</dt>
            <dd className="text-foreground" dir="ltr">{settlementNumber || "-"}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          هذه المخالفة خارجية ومحوّلة إلى المالية، ولا تزال قيد المعالجة.
        </p>
      )}

      {hasReceipt && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">إيصال الدفع</span>
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={receiptUrl! || "/placeholder.svg"} alt="إيصال الدفع" className="size-24 rounded border border-border object-cover" />
          ) : (
            <a
              href={receiptUrl!}
              download="payment-receipt"
              className="flex size-24 flex-col items-center justify-center gap-1 rounded border border-border bg-muted/40 text-[10px] text-muted-foreground hover:bg-muted"
            >
              <FileText className="size-6" />
              تنزيل الإيصال
            </a>
          )}
        </div>
      )}
    </section>
  )
}
