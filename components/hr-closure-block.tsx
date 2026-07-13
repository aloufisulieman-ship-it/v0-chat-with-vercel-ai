import { FileText } from "lucide-react"
import { HrStatusBadge } from "@/components/hr-status-badge"
import { normalizeHrStatus, parseHrAttachments } from "@/lib/hr-status"

/**
 * كتلة تفاصيل معالجة الموارد البشرية داخل نافذة تفاصيل السجل — تظهر لجميع المستخدمين.
 * عند الإغلاق تعرض تاريخ الإغلاق ومن أغلق والإجراء المتخذ ومعاينة/رابط المرفقات.
 */
export function HrClosureBlock({
  hrStatus,
  hrAction,
  hrActionDate,
  closedBy,
  closedAt,
  attachmentsRaw,
}: {
  hrStatus: string | null | undefined
  hrAction: string | null | undefined
  hrActionDate: string | null | undefined
  closedBy: string | null | undefined
  closedAt: Date | string | null | undefined
  attachmentsRaw: string | null | undefined
}) {
  const status = normalizeHrStatus(hrStatus)
  const isClosed = status === "closed"
  const attachments = parseHrAttachments(attachmentsRaw)
  const closedAtStr = closedAt ? new Date(closedAt).toLocaleString("ar") : ""

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">حالة الموارد البشرية</h4>
        <HrStatusBadge hrStatus={hrStatus} />
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
          {hrActionDate && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">تاريخ الإجراء:</dt>
              <dd className="text-foreground" dir="ltr">{hrActionDate}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="text-muted-foreground">الإجراء المتخذ:</dt>
            <dd className="whitespace-pre-line text-foreground">{hrAction || "-"}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          هذا البند داخلي ومحوّل إلى الموارد البشرية، ولا يزال قيد المعالجة.
        </p>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">المرفقات ({attachments.length})</span>
          <div className="flex flex-wrap gap-2">
            {attachments.map((a, i) =>
              a.startsWith("data:image") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={a || "/placeholder.svg"} alt={`مرفق ${i + 1}`} className="size-20 rounded border border-border object-cover" />
              ) : (
                <a
                  key={i}
                  href={a}
                  download={`hr-attachment-${i + 1}`}
                  className="flex size-20 flex-col items-center justify-center gap-1 rounded border border-border bg-muted/40 text-[10px] text-muted-foreground hover:bg-muted"
                >
                  <FileText className="size-6" />
                  تنزيل الملف
                </a>
              ),
            )}
          </div>
        </div>
      )}
    </section>
  )
}
