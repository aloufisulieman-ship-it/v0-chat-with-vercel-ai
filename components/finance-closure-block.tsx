"use client"

import { FileText, ZoomIn } from "lucide-react"
import { FinanceStatusBadge } from "@/components/finance-status-badge"
import { normalizeFinanceStatus } from "@/lib/finance-status"
import { useI18n } from "@/lib/i18n/client"
import { ImageLightbox, useLightbox, type LightboxImage } from "@/components/image-lightbox"

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
  const { t, formatDateTime } = useI18n()
  const status = normalizeFinanceStatus(financeStatus)
  const isClosed = status === "closed"
  // منسّق مركزي بمنطقة زمنية ثابتة لتجنّب عدم تطابق الترطيب بين الخادم والعميل.
  const closedAtStr = closedAt ? formatDateTime(new Date(closedAt)) : ""
  const hasReceipt = !!receiptUrl && receiptUrl.length > 0
  const isImage = hasReceipt && receiptUrl!.startsWith("data:image")

  // معاينة إيصال الدفع (صورة واحدة) عبر نفس مكوّن ImageLightbox.
  const { openLightbox, lightboxProps } = useLightbox()
  const galleryImages: LightboxImage[] = isImage ? [{ url: receiptUrl!, label: t("lightbox.sourceFinance") }] : []

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{t("closureBlock.financeTitle")}</h4>
        <FinanceStatusBadge financeStatus={financeStatus} />
      </div>

      {isClosed ? (
        <dl className="flex flex-col gap-1.5 text-sm">
          {closedAtStr && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{t("closureBlock.closedDate")}</dt>
              <dd className="text-foreground">{closedAtStr}</dd>
            </div>
          )}
          {closedBy && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{t("closureBlock.closedBy")}</dt>
              <dd className="text-foreground">{closedBy}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t("closureBlock.settlementNumber")}</dt>
            <dd className="text-foreground" dir="ltr">{settlementNumber || "-"}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("closureBlock.financePendingNote")}
        </p>
      )}

      {hasReceipt && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t("closureBlock.paymentReceipt")}</span>
          {isImage ? (
            <button
              type="button"
              onClick={() => openLightbox(galleryImages, 0)}
              className="group relative size-24 cursor-pointer overflow-hidden rounded border border-border transition-colors hover:border-primary"
              aria-label={t("closureBlock.paymentReceipt")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receiptUrl! || "/placeholder.svg"}
                alt={t("closureBlock.paymentReceipt")}
                className="size-full object-cover transition-opacity group-hover:opacity-80"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <ZoomIn className="size-5 text-white" />
              </span>
            </button>
          ) : (
            <a
              href={receiptUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-24 flex-col items-center justify-center gap-1 rounded border border-border bg-muted/40 text-[10px] text-muted-foreground hover:bg-muted"
            >
              <FileText className="size-6" />
              {t("closureBlock.downloadReceipt")}
            </a>
          )}
        </div>
      )}

      <ImageLightbox {...lightboxProps} />
    </section>
  )
}
